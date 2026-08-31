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
  const geo = new THREE.SphereGeometry(SKY_RADIUS, 40, 24);
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

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float night = 1.0 - uDaylight;

        /* --- nền trời phân tầng --- */
        /* Các giá trị đêm cố ý rất thấp: chúng đi qua tone mapping rồi mã hoá
           sRGB, nên 0.02 tuyến tính đã hiện ra thành xám xanh đủ thấy. Đặt cao
           hơn là bầu trời 22h trông như hoàng hôn. */
        vec3 nightTop = vec3(0.0018, 0.0055, 0.019);
        vec3 dayTop   = vec3(0.055, 0.24, 0.44);
        vec3 nightMid = vec3(0.005, 0.014, 0.038);
        vec3 dayMid   = vec3(0.16, 0.44, 0.58);
        vec3 nightHor = vec3(0.012, 0.023, 0.050);
        vec3 dayHor   = vec3(0.52, 0.70, 0.72);
        vec3 top = mix(nightTop, dayTop, uDaylight);
        vec3 mid = mix(nightMid, dayMid, uDaylight);
        vec3 hor = mix(nightHor, dayHor, uDaylight);
        vec3 col = mix(hor, mid, smoothstep(-0.02, 0.28, h));
        col = mix(col, top, smoothstep(0.20, 0.78, h));

        /* --- dải sao, chỉ hiện khi trời tối --- */
        float starMask = night * (1.0 - uOvercast * 0.9) * smoothstep(-0.02, 0.22, h);
        if (starMask > 0.004) {
          vec2 sp = d.xz / (abs(d.y) + 0.32);
          vec2 cell = floor(sp * 190.0);
          float rnd = hash21(cell);
          float star = smoothstep(0.9942, 0.9992, rnd);
          float twinkle = 0.55 + 0.45 * sin(uTime * (1.4 + rnd * 5.0) + rnd * 40.0);
          vec3 starTint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.9, 0.74), hash21(cell + 7.3));
          col += starTint * star * twinkle * starMask * 1.7;

          /* dải Ngân Hà nghiêng */
          float band = exp(-pow((d.y * 2.1 - d.x * 0.75) * 2.4, 2.0));
          float milky = noise(sp * 5.2) * 0.55 + noise(sp * 13.0) * 0.3;
          col += vec3(0.30, 0.36, 0.58) * band * milky * starMask * 0.22;
        }

        /* --- quầng sáng quanh mặt trời --- */
        float sunCos = max(dot(d, normalize(uSunDir)), 0.0);
        float sunGlow = pow(sunCos, 220.0) * 1.5 + pow(sunCos, 12.0) * 0.32 + pow(sunCos, 3.0) * 0.10;
        vec3 sunTint = mix(vec3(1.0, 0.48, 0.20), vec3(1.0, 0.93, 0.76), uDaylight);
        col += sunTint * sunGlow * (0.22 + uDaylight * 0.95);

        /* --- quầng trăng --- */
        float moonCos = max(dot(d, normalize(uMoonDir)), 0.0);
        col += vec3(0.62, 0.72, 0.92) * pow(moonCos, 26.0) * night * 0.28;

        /* --- dải hoàng hôn ôm sát đường chân trời --- */
        float band = exp(-abs(h - 0.015) * 15.0);
        vec3 warm = mix(vec3(0.95, 0.36, 0.13), vec3(0.98, 0.62, 0.30), uDaylight);
        float sunSide = 0.35 + 0.65 * max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
        col += warm * band * uDusk * sunSide * 0.95;

        /* --- mây mù khi bão --- */
        if (uOvercast > 0.01) {
          float clouds = noise(d.xz * 2.4 / (abs(d.y) + 0.45) + uTime * 0.012);
          clouds = clouds * 0.6 + noise(d.xz * 6.0 / (abs(d.y) + 0.45) - uTime * 0.02) * 0.4;
          vec3 cloudCol = mix(vec3(0.10, 0.13, 0.17), vec3(0.52, 0.56, 0.60), uDaylight);
          col = mix(col, cloudCol, uOvercast * smoothstep(0.0, 0.45, h) * (0.42 + clouds * 0.5));
        }

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

export function makeCloudLayer(count = 9): CloudLayer {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xa9c4c0,
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    fog: false,
  });
  const puffs: THREE.Group[] = [];
  const geometry = new THREE.SphereGeometry(1, 10, 7);
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Group();
    const lobes: [number, number, number, number][] = [
      [0, 0, 0, 1.9], [1.7, 0.16, 0.3, 1.25], [-1.6, 0.1, -0.22, 1.15], [0.6, 0.35, 0.5, 0.95],
    ];
    for (const [x, y, z, r] of lobes) {
      const lobe = new THREE.Mesh(geometry, material);
      lobe.position.set(x, y, z);
      lobe.scale.set(r, r * 0.42, r);
      puff.add(lobe);
    }
    const azimuth = (i / count) * Math.PI * 2;
    const radius = 92 + Math.random() * 66;
    puff.position.set(Math.cos(azimuth) * radius, 46 + Math.random() * 22, Math.sin(azimuth) * radius);
    puff.scale.setScalar(1.4 + Math.random() * 1.5);
    group.add(puff);
    puffs.push(puff);
  }

  return {
    group,
    setCover(cover, tint) {
      material.opacity = 0.05 + cover * 0.30;
      material.color.copy(tint);
    },
    tick: (t, dt) => {
      puffs.forEach((puff, i) => {
        puff.position.x += dt * (0.5 + i * 0.07);
        if (puff.position.x > 190) puff.position.x = -190;
        puff.position.y += Math.sin(t * 0.28 + i) * 0.004;
      });
    },
  };
}
