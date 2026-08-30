import * as THREE from "three";
import type { TickFn } from "./atmosphere";
import { WEATHER_PROFILES } from "../lib/season";
import type { WeatherId } from "../lib/season";

export * from "../lib/season";

/* ------------------------------------------------------------------ */
/*  Hệ hạt thời tiết                                                   */
/* ------------------------------------------------------------------ */

const FIELD_RADIUS = 78;
const FIELD_HEIGHT = 46;
const RAIN_MAX = 1100;
const FLAKE_MAX = 520;

function flakeTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.72)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface FlakeProfile {
  count: number;
  color: number;
  size: number;
  opacity: number;
  fall: number;
  swayX: number;
  swayZ: number;
  spin: number;
  additive: boolean;
  /** hạt bay lên thay vì rơi xuống (đom đóm) */
  float: boolean;
  yRange: [number, number];
}

const FLAKE_PROFILES: Partial<Record<WeatherId, FlakeProfile>> = {
  snow: { count: 480, color: 0xf2f8ff, size: 0.42, opacity: 0.82, fall: 2.1, swayX: 1.5, swayZ: 1.2, spin: 0.3, additive: false, float: false, yRange: [0, FIELD_HEIGHT] },
  petals: { count: 300, color: 0xffc6da, size: 0.34, opacity: 0.8, fall: 1.5, swayX: 2.6, swayZ: 2.2, spin: 0.9, additive: false, float: false, yRange: [0, 34] },
  leaves: { count: 260, color: 0xd9903c, size: 0.4, opacity: 0.85, fall: 1.9, swayX: 3.0, swayZ: 2.6, spin: 1.1, additive: false, float: false, yRange: [0, 30] },
  mist: { count: 220, color: 0xbcd4d6, size: 2.6, opacity: 0.13, fall: 0.18, swayX: 3.4, swayZ: 3.0, spin: 0.05, additive: false, float: false, yRange: [0, 9] },
  fireflies: { count: 150, color: 0xffe38a, size: 0.3, opacity: 0.95, fall: 0.12, swayX: 2.2, swayZ: 2.0, spin: 0.2, additive: true, float: true, yRange: [1, 12] },
};

export interface WeatherSystem {
  group: THREE.Group;
  tick: TickFn;
  /** Đặt thời tiết hiện hành. `intensity` 0..1 cho phép giảm tải trên máy yếu. */
  set(weather: WeatherId, intensity: number): void;
  /** Giữ trường hạt bám quanh camera để không bao giờ thấy mép. */
  setCenter(x: number, z: number): void;
  /** 0..1 — độ sáng cú chớp ở khung hình hiện tại. */
  readonly flash: number;
}

export function makeWeather(): WeatherSystem {
  const group = new THREE.Group();
  group.frustumCulled = false;

  /* ---------- mưa: các đoạn thẳng nghiêng, rẻ và đọc đúng như mưa ---------- */
  const rainGeometry = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(RAIN_MAX * 6);
  const rainSeeds = new Float32Array(RAIN_MAX * 3);
  for (let i = 0; i < RAIN_MAX; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * FIELD_RADIUS;
    rainSeeds[i * 3] = Math.cos(angle) * radius;
    rainSeeds[i * 3 + 1] = Math.random() * FIELD_HEIGHT;
    rainSeeds[i * 3 + 2] = Math.sin(angle) * radius;
  }
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0xbfe4f2, transparent: true, opacity: 0.34, depthWrite: false, fog: true });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  /* ---------- hạt bay: tuyết, cánh hoa, lá, sương, đom đóm ---------- */
  const flakeGeometry = new THREE.BufferGeometry();
  const flakePositions = new Float32Array(FLAKE_MAX * 3);
  const flakeSeeds = new Float32Array(FLAKE_MAX * 4);
  for (let i = 0; i < FLAKE_MAX; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * FIELD_RADIUS;
    flakeSeeds[i * 4] = Math.cos(angle) * radius;
    flakeSeeds[i * 4 + 1] = Math.random();
    flakeSeeds[i * 4 + 2] = Math.sin(angle) * radius;
    flakeSeeds[i * 4 + 3] = Math.random() * Math.PI * 2;
  }
  flakeGeometry.setAttribute("position", new THREE.BufferAttribute(flakePositions, 3));
  const flakeMaterial = new THREE.PointsMaterial({
    map: flakeTexture(),
    color: 0xffffff,
    size: 0.4,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const flakes = new THREE.Points(flakeGeometry, flakeMaterial);
  flakes.frustumCulled = false;
  flakes.visible = false;
  group.add(flakes);

  let current: WeatherId = "clear";
  let intensity = 1;
  let profile: FlakeProfile | null = null;
  let rainCount = 0;
  let flakeCount = 0;
  let flashValue = 0;
  let nextStrike = 6 + Math.random() * 12;

  function applyProfile() {
    const spec = WEATHER_PROFILES[current];
    rainCount = Math.round(RAIN_MAX * spec.rain * intensity);
    rain.visible = rainCount > 0;
    rainMaterial.opacity = 0.2 + spec.rain * 0.24;
    rainGeometry.setDrawRange(0, rainCount * 2);

    profile = FLAKE_PROFILES[current] ?? null;
    flakeCount = profile ? Math.round(profile.count * intensity) : 0;
    flakes.visible = flakeCount > 0;
    if (profile) {
      flakeMaterial.color.setHex(profile.color);
      flakeMaterial.size = profile.size;
      flakeMaterial.opacity = profile.opacity;
      flakeMaterial.blending = profile.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      flakeMaterial.needsUpdate = true;
    }
    flakeGeometry.setDrawRange(0, flakeCount);
    if (!spec.lightning) flashValue = 0;
  }

  const wrap = (value: number, span: number) => ((value % span) + span) % span;

  return {
    group,
    set(weather, nextIntensity) {
      const clamped = THREE.MathUtils.clamp(nextIntensity, 0, 1);
      if (weather === current && Math.abs(clamped - intensity) < 0.01) return;
      current = weather;
      intensity = clamped;
      applyProfile();
    },
    setCenter(x, z) {
      group.position.set(x, 0, z);
    },
    get flash() {
      return flashValue;
    },
    tick: (t, dt) => {
      if (rainCount > 0) {
        const attribute = rainGeometry.attributes.position as THREE.BufferAttribute;
        const speed = 26 + WEATHER_PROFILES[current].rain * 16;
        const slant = Math.sin(t * 0.21) * 0.16;
        for (let i = 0; i < rainCount; i++) {
          const x = rainSeeds[i * 3];
          const z = rainSeeds[i * 3 + 2];
          const y = FIELD_HEIGHT - wrap(rainSeeds[i * 3 + 1] + t * speed, FIELD_HEIGHT);
          const head = i * 6;
          attribute.array[head] = x + y * slant;
          attribute.array[head + 1] = y;
          attribute.array[head + 2] = z;
          attribute.array[head + 3] = x + (y - 1.5) * slant + slant * 1.2;
          attribute.array[head + 4] = y - 1.5;
          attribute.array[head + 5] = z;
        }
        attribute.needsUpdate = true;
      }

      if (flakeCount > 0 && profile) {
        const attribute = flakeGeometry.attributes.position as THREE.BufferAttribute;
        const [low, high] = profile.yRange;
        const span = high - low;
        for (let i = 0; i < flakeCount; i++) {
          const seedX = flakeSeeds[i * 4];
          const seedZ = flakeSeeds[i * 4 + 2];
          const phase = flakeSeeds[i * 4 + 3];
          const travel = profile.float
            ? wrap(flakeSeeds[i * 4 + 1] * span + Math.sin(t * 0.5 + phase) * span * 0.4, span)
            : span - wrap(flakeSeeds[i * 4 + 1] * span + t * profile.fall, span);
          attribute.setXYZ(
            i,
            seedX + Math.sin(t * profile.spin + phase) * profile.swayX,
            low + travel,
            seedZ + Math.cos(t * profile.spin * 0.83 + phase) * profile.swayZ
          );
        }
        attribute.needsUpdate = true;
      }

      if (WEATHER_PROFILES[current].lightning) {
        nextStrike -= dt;
        if (nextStrike <= 0) {
          flashValue = 1;
          nextStrike = 5 + Math.random() * 14;
        } else {
          flashValue = Math.max(0, flashValue - dt * 4.2);
        }
      }
    },
  };
}
