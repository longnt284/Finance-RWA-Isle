import * as THREE from "three";
import { phaseForHour } from "../lib/season";
import type { DayPhase } from "../lib/season";

/* ------------------------------------------------------------------ */
/*  Bầu trời, mặt trời, mặt trăng, sao — tất cả điều khiển bằng uniform */
/* ------------------------------------------------------------------ */

export type TickFn = (t: number, dt: number) => void;
export type { DayPhase };

export interface SkyState {
  /** 0 = đêm đen, 1 = giữa trưa */
  daylight: number;
  /** 0..1 — đậm nhất quanh bình minh và hoàng hôn */
  dusk: number;
  /** hướng mặt trời đã chuẩn hoá */
  sunDir: THREE.Vector3;
  /** hướng mặt trăng đã chuẩn hoá */
  moonDir: THREE.Vector3;
  /** 0 = trăng non, 0.5 = trăng tròn, 1 = trăng non kế tiếp */
  moonPhase: number;
  phase: DayPhase;
}

const SKY_RADIUS = 620;

/** Tuổi trăng xấp xỉ theo chu kỳ giao hội 29,53 ngày, mốc trăng non 2000-01-06. */
export function moonPhaseFor(date: Date): number {
  const synodic = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const age = ((days % synodic) + synodic) % synodic;
  return age / synodic;
}

/**
 * Cung thiên thể bị nén xuống còn khoảng 32° ở đỉnh.
 *
 * Với cung thật (90°) thì giữa trưa và nửa đêm cả mặt trời lẫn mặt trăng đều
 * nằm cao hơn phần trời mà camera chạm tới được — người chơi không bao giờ nhìn
 * thấy chúng, chỉ thấy ánh sáng. Nén cung lại giữ nguyên nhịp mọc–lặn nhưng đưa
 * cả hai vào khung hình.
 */
const ARC_HEIGHT = 0.58;

/**
 * Vị trí thiên thể từ giờ trong ngày. Mặt trời lên đỉnh lúc 12h,
 * mặt trăng đi lệch pha nửa vòng để đêm luôn có nguồn sáng.
 */
export function skyStateFor(date: Date): SkyState {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const solar = Math.sin(((hour - 6) / 12) * Math.PI);
  const daylight = THREE.MathUtils.smoothstep(solar, -0.12, 0.42);
  const dusk = Math.max(0, 1 - Math.min(1, Math.abs(solar) * 3.2));
  const sunAzimuth = ((hour - 12) / 24) * Math.PI * 2;
  const sunDir = new THREE.Vector3(
    Math.cos(sunAzimuth),
    0.04 + Math.max(-0.35, solar) * ARC_HEIGHT,
    Math.sin(sunAzimuth)
  ).normalize();

  const lunar = Math.sin(((hour - 18) / 12) * Math.PI);
  const moonAzimuth = ((hour - 24) / 24) * Math.PI * 2;
  const moonDir = new THREE.Vector3(
    Math.cos(moonAzimuth),
    0.05 + Math.max(-0.3, lunar) * ARC_HEIGHT,
    Math.sin(moonAzimuth)
  ).normalize();

  return { daylight, dusk, sunDir, moonDir, moonPhase: moonPhaseFor(date), phase: phaseForHour(hour) };
}

/* ------------------------------------------------------------------ */
/*  Sắc trời dùng chung                                                */
/* ------------------------------------------------------------------ */

/**
 * Đúng những hằng số mà shader vòm trời dùng, nhưng ở phía JavaScript.
 *
 * Mặt nước phải phản chiếu **chính bầu trời đang treo trên đầu nó**. Trước đây
 * nó mượn tạm sắc sương mù, mà sương mù thì nhạt và ngả ấm, nên hễ nhìn lướt
 * là cả mặt biển bạc trắng ra như sữa. Chia sẻ đúng bộ màu này giữ cho nước và
 * trời luôn là một.
 *
 * Giá trị ở không gian tuyến tính vì shader nước cũng làm việc tuyến tính rồi
 * mới tone-map ở cuối.
 */
const linear = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
const SKY_NIGHT_TOP = linear(0.0018, 0.0055, 0.019);
const SKY_DAY_TOP = linear(0.055, 0.24, 0.44);
const SKY_NIGHT_MID = linear(0.005, 0.014, 0.038);
const SKY_DAY_MID = linear(0.16, 0.44, 0.58);
const SKY_OVERCAST = linear(0.16, 0.18, 0.20);

/** Ghi sắc đỉnh trời và sắc vòm gần chân trời vào hai màu cho sẵn. */
export function skyGradient(state: SkyState, overcast: number, top: THREE.Color, horizon: THREE.Color): void {
  top.copy(SKY_NIGHT_TOP).lerp(SKY_DAY_TOP, state.daylight);
  horizon.copy(SKY_NIGHT_MID).lerp(SKY_DAY_MID, state.daylight);
  if (overcast > 0.01) {
    /* Trời u ám thì vòm xám lại, và mặt nước phải xám theo. */
    top.lerp(SKY_OVERCAST, overcast * 0.75);
    horizon.lerp(SKY_OVERCAST, overcast * 0.6);
  }
}

/* ------------------------------------------------------------------ */
/*  Vòm trời                                                           */
/* ------------------------------------------------------------------ */

export interface Sky {
  mesh: THREE.Mesh;
  apply(state: SkyState, overcast: number): void;
  tick: TickFn;
}

export function makeSky(): Sky {
  const geo = new THREE.SphereGeometry(SKY_RADIUS, 64, 40);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDaylight: { value: 0.72 },
      uDusk: { value: 0.35 },
      uOvercast: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylight;
      uniform float uDusk;
      uniform float uOvercast;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      varying vec3 vDir;

      float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
                   mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm2(vec2 p) {
        return noise(p) * 0.62 + noise(p * 2.13 + 7.7) * 0.26 + noise(p * 4.41 + 3.1) * 0.12;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float night = 1.0 - uDaylight;
        vec3 sunN = normalize(uSunDir);

        /* --- nền trời phân tầng + Rayleigh ấm ở chân trời --- */
        vec3 nightTop = vec3(0.0016, 0.0048, 0.017);
        vec3 dayTop   = vec3(0.048, 0.225, 0.46);
        vec3 nightMid = vec3(0.004, 0.012, 0.034);
        vec3 dayMid   = vec3(0.145, 0.42, 0.585);
        vec3 nightHor = vec3(0.010, 0.020, 0.046);
        vec3 dayHor   = vec3(0.55, 0.71, 0.73);
        vec3 top = mix(nightTop, dayTop, uDaylight);
        vec3 mid = mix(nightMid, dayMid, uDaylight);
        vec3 hor = mix(nightHor, dayHor, uDaylight);
        vec3 col = mix(hor, mid, smoothstep(-0.03, 0.26, h));
        col = mix(col, top, smoothstep(0.18, 0.80, h));
        /* Haze ấm ôm chân trời phía mặt trời — bầu trời có chiều sâu khí quyển. */
        float sunSideH = max(dot(normalize(vec3(d.x, 0.0, d.z) + vec3(1e-4)), normalize(vec3(sunN.x, 0.0, sunN.z) + vec3(1e-4))), 0.0);
        float haze = exp(-max(h, 0.0) * 7.5) * (0.25 + 0.75 * pow(sunSideH, 2.0));
        vec3 hazeTint = mix(vec3(0.10, 0.05, 0.09), vec3(1.0, 0.62, 0.34), uDaylight);
        col += hazeTint * haze * (0.10 + uDaylight * 0.30 + uDusk * 0.35) * (1.0 - uOvercast * 0.7);

        /* --- sao: 2 mật độ + magnitude + twinkle lệch pha --- */
        float starMask = night * (1.0 - uOvercast * 0.92) * smoothstep(-0.02, 0.20, h);
        if (starMask > 0.003) {
          vec2 sp = d.xz / (abs(d.y) + 0.32);
          vec2 cell = floor(sp * 230.0);
          float rnd = hash21(cell);
          float mag = pow(hash21(cell + 3.7), 2.2);
          float star = smoothstep(0.9955 - mag * 0.004, 0.9996, rnd);
          float tw = 0.5 + 0.5 * sin(uTime * (1.2 + rnd * 6.0) + rnd * 43.0);
          tw *= 0.65 + 0.35 * sin(uTime * 7.3 + rnd * 91.0);
          vec3 starTint = mix(vec3(0.70, 0.83, 1.0), vec3(1.0, 0.90, 0.74), hash21(cell + 7.3));
          col += starTint * star * tw * starMask * (1.2 + mag * 2.2);
          /* lớp sao mờ thứ hai cho bầu trời dày */
          vec2 cell2 = floor(sp * 110.0 + 17.0);
          float rnd2 = hash21(cell2);
          float star2 = smoothstep(0.9975, 1.0, rnd2);
          col += vec3(0.8, 0.88, 1.0) * star2 * (0.4 + 0.6 * tw) * starMask * 0.7;

          float band = exp(-pow((d.y * 2.1 - d.x * 0.75) * 2.4, 2.0));
          float milky = fbm2(sp * 4.6) * 0.6 + noise(sp * 12.0) * 0.28;
          float dust = fbm2(sp * 2.2 + 4.0);
          col += vec3(0.30, 0.37, 0.60) * band * milky * starMask * 0.30 * (0.5 + dust * 0.7);
          col *= 1.0 - band * (1.0 - dust) * starMask * 0.25;
        }

        /* --- mặt trời: đĩa + Mie halo + forward scattering --- */
        float sunCos = max(dot(d, sunN), 0.0);
        float disc = smoothstep(0.99988, 0.99997, sunCos);
        float mie = pow(sunCos, 650.0) * 2.2 + pow(sunCos, 90.0) * 0.55 + pow(sunCos, 9.0) * 0.30 + pow(sunCos, 2.5) * 0.10;
        vec3 sunTint = mix(vec3(1.0, 0.42, 0.16), vec3(1.0, 0.94, 0.78), clamp(uDaylight * 1.2, 0.0, 1.0));
        col += sunTint * (mie * (0.20 + uDaylight * 1.0) + disc * 3.2 * (0.25 + uDaylight));

        /* --- quầng trăng + halo băng --- */
        float moonCos = max(dot(d, normalize(uMoonDir)), 0.0);
        col += vec3(0.60, 0.71, 0.92) * (pow(moonCos, 34.0) * 0.34 + pow(moonCos, 220.0) * 1.1) * night;
        col += vec3(0.55, 0.65, 0.90) * exp(-pow((acos(clamp(moonCos, -1.0, 1.0)) - 0.38) * 9.0, 2.0)) * night * 0.10;

        /* --- dải hoàng hôn 2 tầng: lõi nóng + tàn lửa lan --- */
        float bandLow = exp(-abs(h - 0.012) * 17.0);
        float bandHigh = exp(-abs(h - 0.10) * 6.5);
        vec3 warmLow = mix(vec3(1.0, 0.32, 0.10), vec3(1.0, 0.60, 0.28), uDaylight);
        vec3 warmHigh = mix(vec3(0.55, 0.18, 0.28), vec3(1.0, 0.55, 0.42), uDaylight);
        float sunSide = 0.30 + 0.70 * sunSideH;
        col += warmLow * bandLow * uDusk * sunSide * 1.15 * (1.0 - uOvercast * 0.75);
        col += warmHigh * bandHigh * uDusk * sunSide * 0.38 * (1.0 - uOvercast * 0.8);

        /* --- mây: 2 tầng FBM + viền bạc khi ngược sáng --- */
        vec2 cuv = d.xz / (abs(d.y) + 0.42);
        float cirrus = fbm2(cuv * 1.4 + vec2(uTime * 0.010, uTime * 0.004));
        cirrus = smoothstep(0.52, 0.85, cirrus) * smoothstep(0.03, 0.35, h) * (1.0 - uOvercast * 0.4);
        vec3 cirrusCol = mix(vec3(0.05, 0.07, 0.12), vec3(1.02, 0.95, 0.88), uDaylight);
        float silver = pow(sunCos, 18.0) * 0.9;
        cirrusCol += vec3(1.0, 0.55, 0.30) * silver * (0.3 + uDusk * 0.9);
        col = mix(col, cirrusCol, cirrus * 0.42);
        if (uOvercast > 0.01) {
          float clouds = fbm2(cuv * 2.2 + vec2(uTime * 0.014, -uTime * 0.009));
          clouds = clouds * 0.62 + noise(cuv * 5.6 - uTime * 0.02) * 0.38;
          float cover = smoothstep(1.0 - uOvercast * 0.85, 1.05 - uOvercast * 0.35, clouds);
          vec3 cloudDark = mix(vec3(0.055, 0.075, 0.10), vec3(0.30, 0.33, 0.37), uDaylight);
          vec3 cloudLit = mix(vec3(0.10, 0.12, 0.16), vec3(0.72, 0.74, 0.76), uDaylight);
          vec3 cloudCol = mix(cloudDark, cloudLit, 0.35 + 0.65 * pow(sunCos * 0.5 + 0.5, 2.0));
          cloudCol += vec3(1.0, 0.5, 0.25) * pow(sunCos, 6.0) * uDusk * 0.5;
          col = mix(col, cloudCol, cover * smoothstep(-0.02, 0.30, h) * 0.92);
        }

        /* dither chống banding ngay trong vòm trời */
        col += (hash21(gl_FragCoord.xy * 0.7) - 0.5) * (1.0 / 255.0);
        gl_FragColor = vec4(col, 1.0);
        /* ShaderMaterial thô không tự nhận tone mapping và chuyển sang sRGB như
           vật liệu dựng sẵn. Thiếu hai chunk này, mọi giá trị tuyến tính bị ghi
           thẳng vào buffer sRGB nên cả bầu trời tối đi thấy rõ. */
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;

  return {
    mesh,
    apply(state, overcast) {
      const u = material.uniforms;
      u.uDaylight.value = state.daylight;
      u.uDusk.value = state.dusk;
      u.uOvercast.value = overcast;
      (u.uSunDir.value as THREE.Vector3).copy(state.sunDir);
      (u.uMoonDir.value as THREE.Vector3).copy(state.moonDir);
    },
    tick: (t) => {
      material.uniforms.uTime.value = t;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Đĩa mặt trời                                                       */
/* ------------------------------------------------------------------ */

function radialTexture(stops: [number, string][], size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 1, half, half, half);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface CelestialBody {
  sprite: THREE.Sprite;
  apply(state: SkyState): void;
}

export function makeSun(): CelestialBody {
  const texture = radialTexture([
    [0, "rgba(255,255,246,1)"],
    [0.12, "rgba(255,242,205,0.96)"],
    [0.3, "rgba(255,197,110,0.45)"],
    [0.62, "rgba(250,150,70,0.14)"],
    [1, "rgba(250,140,60,0)"],
  ]);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    opacity: 0.9,
  });
  const sprite = new THREE.Sprite(material);
  /* Sau mặt nước (-10) nên vầng mặt trời vẫn nằm trên mặt biển như bản trước:
     mặt nước giờ trong mờ, nếu để nó vẽ sau thì nó sẽ xoá mất đĩa mặt trời lúc
     hoàng hôn. */
  sprite.renderOrder = -5;
  sprite.scale.set(58, 58, 1);
  sprite.frustumCulled = false;

  const warm = new THREE.Color(0xff8a3d);
  const pale = new THREE.Color(0xfff3d6);
  return {
    sprite,
    apply(state) {
      sprite.position.copy(state.sunDir).multiplyScalar(SKY_RADIUS * 0.82);
      const low = 1 - THREE.MathUtils.clamp(state.sunDir.y * 2.4, 0, 1);
      // Mặt trời phình và ngả đỏ khi sát chân trời — đúng như cảm nhận thật.
      sprite.scale.setScalar(52 + low * 26);
      material.color.copy(warm).lerp(pale, 1 - low);
      material.opacity = THREE.MathUtils.clamp(0.1 + state.daylight * 0.85 + state.dusk * 0.3, 0, 1) * (state.sunDir.y > -0.05 ? 1 : 0);
    },
  };
}

/** Mặt trăng có miệng hố và pha khuyết vẽ trực tiếp lên canvas. */
export function makeMoon(): CelestialBody {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const craters: [number, number, number, number][] = [
    [0.42, 0.36, 0.10, 0.16], [0.60, 0.52, 0.07, 0.13], [0.34, 0.60, 0.06, 0.11],
    [0.55, 0.28, 0.045, 0.10], [0.68, 0.68, 0.05, 0.12], [0.30, 0.45, 0.035, 0.09],
    [0.50, 0.70, 0.04, 0.10], [0.72, 0.40, 0.03, 0.08],
  ];

  let paintedPhase = -1;
  function paint(phase: number) {
    if (!ctx || Math.abs(phase - paintedPhase) < 0.004) return;
    paintedPhase = phase;
    const half = size / 2;
    const radius = size * 0.36;
    ctx.clearRect(0, 0, size, size);

    // hào quang mềm quanh đĩa
    const halo = ctx.createRadialGradient(half, half, radius * 0.85, half, half, half);
    halo.addColorStop(0, "rgba(206,222,255,0.34)");
    halo.addColorStop(1, "rgba(180,205,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, radius, 0, Math.PI * 2);
    ctx.clip();
    const body = ctx.createRadialGradient(half - radius * 0.28, half - radius * 0.28, radius * 0.15, half, half, radius);
    body.addColorStop(0, "#fdfbf3");
    body.addColorStop(0.7, "#e2e6ee");
    body.addColorStop(1, "#b9c2d3");
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, size, size);
    for (const [cx, cy, cr, alpha] of craters) {
      ctx.beginPath();
      ctx.arc(cx * size, cy * size, cr * size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120,132,152,${alpha})`;
      ctx.fill();
    }

    // vùng khuất: một đĩa bóng trượt ngang tạo ra pha trăng
    const illum = Math.cos(phase * Math.PI * 2); // 1 = trăng non, -1 = trăng tròn
    const shadowOffset = illum * radius * 2.02;
    ctx.beginPath();
    ctx.arc(half + shadowOffset, half, radius * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(6,12,24,0.94)";
    ctx.fill();
    ctx.restore();
    texture.needsUpdate = true;
  }
  paint(0.5);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = -4;
  sprite.scale.set(34, 34, 1);
  sprite.frustumCulled = false;

  return {
    sprite,
    apply(state) {
      paint(state.moonPhase);
      sprite.position.copy(state.moonDir).multiplyScalar(SKY_RADIUS * 0.8);
      const above = THREE.MathUtils.smoothstep(state.moonDir.y, -0.05, 0.2);
      material.opacity = above * (0.25 + (1 - state.daylight) * 0.72);
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Sao băng                                                           */
/* ------------------------------------------------------------------ */

export interface ShootingStars {
  group: THREE.Group;
  tick: TickFn;
  setActive(active: boolean): void;
}

/** Vệt sao băng thưa thớt, chỉ chạy khi trời đủ tối và không có bão. */
export function makeShootingStars(count = 3): ShootingStars {
  const group = new THREE.Group();
  group.frustumCulled = false;
  const material = new THREE.MeshBasicMaterial({
    color: 0xdcecff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  interface Streak {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    life: number;
    delay: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
  }
  const streaks: Streak[] = [];
  for (let i = 0; i < count; i++) {
    const own = material.clone();
    const geometry = new THREE.PlaneGeometry(46, 0.9);
    geometry.translate(23, 0, 0);
    const mesh = new THREE.Mesh(geometry, own);
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    streaks.push({ mesh, material: own, life: 0, delay: 3 + i * 9 + Math.random() * 14, from: new THREE.Vector3(), to: new THREE.Vector3() });
  }
  let active = true;

  function launch(streak: Streak) {
    const azimuth = Math.random() * Math.PI * 2;
    const radius = SKY_RADIUS * 0.62;
    streak.from.set(Math.cos(azimuth) * radius, radius * (0.34 + Math.random() * 0.34), Math.sin(azimuth) * radius);
    const drift = azimuth + (Math.random() > 0.5 ? 0.55 : -0.55);
    streak.to.set(Math.cos(drift) * radius * 1.05, radius * (0.06 + Math.random() * 0.12), Math.sin(drift) * radius * 1.05);
    streak.mesh.position.copy(streak.from);
    streak.mesh.lookAt(streak.to);
    streak.mesh.rotateY(-Math.PI / 2);
    streak.mesh.visible = true;
    streak.life = 1;
  }

  return {
    group,
    setActive(next) {
      active = next;
      if (!next) {
        for (const streak of streaks) {
          streak.mesh.visible = false;
          streak.life = 0;
        }
      }
    },
    tick: (_t, dt) => {
      for (const streak of streaks) {
        if (streak.life > 0) {
          streak.life -= dt * 1.25;
          if (streak.life <= 0) {
            streak.mesh.visible = false;
            streak.delay = 8 + Math.random() * 26;
            continue;
          }
          streak.mesh.position.lerpVectors(streak.to, streak.from, streak.life);
          streak.material.opacity = Math.sin(streak.life * Math.PI) * 0.85;
        } else if (active) {
          streak.delay -= dt;
          if (streak.delay <= 0) launch(streak);
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Mây thể tích nhẹ                                                   */
/* ------------------------------------------------------------------ */

export interface CloudLayer {
  group: THREE.Group;
  tick: TickFn;
  setCover(cover: number, tint: THREE.Color): void;
}

export function makeCloudLayer(count = 12): CloudLayer {
  const group = new THREE.Group();
  /* Mây billboard xốp: 3 sprite puff chồng lệch nhau cho mỗi cụm, rìa feather
     sâu nên không còn viền cầu cứng như bản sphere. Luôn quay về camera nên
     dù ở góc nào mây cũng mềm và có khối. */
  const baseColor = new THREE.Color(0xcfdfe0);
  const materials: THREE.SpriteMaterial[] = [];
  const puffs: THREE.Sprite[] = [];
  let puffTexture: THREE.Texture | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      const blobs: [number, number, number, number][] = [
        [0.5, 0.56, 0.30, 0.9], [0.36, 0.59, 0.22, 0.72], [0.64, 0.58, 0.24, 0.74],
        [0.46, 0.46, 0.20, 0.62], [0.58, 0.49, 0.18, 0.56],
      ];
      for (const [cx, cy, r, a] of blobs) {
        const g = ctx.createRadialGradient(cx * 256, cy * 256, 1, cx * 256, cy * 256, r * 256);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.55, `rgba(255,255,255,${(a * 0.42).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
      }
    }
    puffTexture = new THREE.CanvasTexture(canvas);
    puffTexture.colorSpace = THREE.SRGBColorSpace;
  } catch {
    puffTexture = null;
  }
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: puffTexture,
      color: baseColor.clone(),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false,
    });
    materials.push(material);
    /* Mỗi cụm 2-3 sprite chồng để có chiều sâu thay vì một đốm đơn. */
    const cluster = 2 + (i % 2);
    for (let k = 0; k < cluster; k++) {
      const sprite = new THREE.Sprite(k === 0 ? material : material.clone());
      if (k > 0) materials.push(sprite.material as THREE.SpriteMaterial);
      const azimuth = ((i + k * 0.35) / count) * Math.PI * 2;
      const radius = 95 + Math.random() * 75;
      sprite.position.set(
        Math.cos(azimuth) * radius + (Math.random() - 0.5) * 18,
        48 + Math.random() * 26 + k * 3.5,
        Math.sin(azimuth) * radius + (Math.random() - 0.5) * 18
      );
      const w = (22 + Math.random() * 26) * (1 + k * 0.25);
      sprite.scale.set(w, w * 0.42, 1);
      sprite.renderOrder = -50;
      group.add(sprite);
      puffs.push(sprite);
    }
  }

  return {
    group,
    setCover(cover, tint) {
      for (const m of materials) {
        m.opacity = 0.10 + cover * 0.42;
        m.color.copy(tint).lerp(new THREE.Color(0xffffff), 0.18);
      }
    },
    tick: (t, dt) => {
      puffs.forEach((puff, i) => {
        puff.position.x += dt * (0.55 + (i % 7) * 0.09);
        if (puff.position.x > 200) puff.position.x = -200;
        puff.position.y += Math.sin(t * 0.24 + i * 1.7) * 0.006;
        const s = 1 + Math.sin(t * 0.18 + i) * 0.02;
        puff.scale.x *= 1 + (s - 1) * 0.1;
      });
    },
  };
}
