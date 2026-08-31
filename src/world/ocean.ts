import * as THREE from "three";
import type { TickFn } from "./atmosphere";

/* ------------------------------------------------------------------ */
/*  Đại dương tròn, thềm cát nông và vành san hô đánh dấu lãnh thổ      */
/* ------------------------------------------------------------------ */

/** Bán kính đảo chính. */
export const ISLAND_RADIUS = 26;
/** Mép ngoài của thềm cát nông — vùng nước ngọc lam quanh đảo. */
export const SHELF_RADIUS = 41;
/** Vành san hô: ranh giới lãnh thổ, du thuyền không vượt qua được. */
export const TERRITORY_RADIUS = 118;
/** Mặt nước là một đĩa tròn nên đường chân trời không bao giờ lộ góc vuông. */
export const OCEAN_RADIUS = 470;
/** Mặt nước nằm dưới mặt đất một chút để bờ có độ dốc. */
export const WATER_LEVEL = -1.45;

/** Đĩa tròn có mật độ đỉnh dồn về tâm — nơi người chơi thực sự nhìn. */
function oceanGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.RingGeometry(0.4, OCEAN_RADIUS, 140, 64);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const radius = Math.hypot(x, y);
    if (radius < 1e-4) continue;
    /* Vòng trong cùng đôi khi tính ra bán kính nhỏ hơn 0.4 vài phần tỷ vì sai số
       dấu phẩy động. Không kẹp lại thì Math.pow(âm, 2.3) trả NaN và cả tấm lưới
       biến mất. */
    const normalized = THREE.MathUtils.clamp((radius - 0.4) / (OCEAN_RADIUS - 0.4), 0, 1);
    const eased = Math.pow(normalized, 2.3);
    const next = 0.4 + eased * (OCEAN_RADIUS - 0.4);
    position.setXY(i, (x / radius) * next, (y / radius) * next);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export interface Ocean {
  mesh: THREE.Mesh;
  tick: TickFn;
  /** Cập nhật ánh sáng, mùa và mưa cho mặt nước. */
  apply(input: {
    daylight: number;
    sunDir: THREE.Vector3;
    moonDir: THREE.Vector3;
    fog: THREE.Color;
    shallow: THREE.Color;
    rain: number;
  }): void;
}

export function makeOcean(): Ocean {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDaylight: { value: 0.72 },
      uFog: { value: new THREE.Color(0x08222b) },
      uShallow: { value: new THREE.Color(0x30bcc0) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, -0.5) },
      uMoonDir: { value: new THREE.Vector3(-0.4, 0.5, 0.6) },
      uRain: { value: 0 },
      uIsland: { value: ISLAND_RADIUS },
      uShelf: { value: SHELF_RADIUS },
      uTerritory: { value: TERRITORY_RADIUS },
    },
    fog: false,
    vertexShader: `
      varying vec3 vWorld;
      varying float vWave;
      uniform float uTime;
      uniform float uRain;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.055 + uTime * 0.72) * 0.16;
        float w2 = sin(p.y * 0.082 - uTime * 0.54 + p.x * 0.018) * 0.11;
        float w3 = sin((p.x + p.y) * 0.035 + uTime * 0.31) * 0.07;
        float chop = sin(p.x * 0.32 + uTime * 3.1) * sin(p.y * 0.29 - uTime * 2.6) * 0.05 * uRain;
        p.z += w1 + w2 + w3 + chop;
        vWave = w1 + w2 + w3 + chop;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uFog;
      uniform vec3 uShallow;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform float uDaylight;
      uniform float uRain;
      uniform float uIsland;
      uniform float uShelf;
      uniform float uTerritory;
      varying vec3 vWorld;
      varying float vWave;

      float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 p = vWorld.xz;
        float d = length(p);
        float ring = sin(d * 0.34 - uTime * 1.15) * 0.5 + 0.5;
        float drift = sin(p.x * 0.06 + uTime * 0.35) * sin(p.y * 0.05 - uTime * 0.28);

        /* --- ba tầng độ sâu: thềm cát, sườn dốc, biển sâu ---
           Biển xa ngả lam đậm chứ không phải lục xám: dưới ACES tone mapping, sắc
           lục nhạt của bản trước ra màu bùn ngay khi phơi sáng nhích lên. */
        vec3 deep = mix(vec3(0.004, 0.018, 0.058), vec3(0.008, 0.062, 0.150), uDaylight);
        vec3 openSea = mix(vec3(0.012, 0.052, 0.104), vec3(0.028, 0.196, 0.330), uDaylight);
        vec3 lagoon = uShallow * (0.28 + uDaylight * 0.98);
        float shelfMix = 1.0 - smoothstep(uIsland - 1.5, uShelf, d);
        float depthMix = 1.0 - smoothstep(uShelf, uShelf + 46.0, d);
        vec3 col = mix(deep, openSea, depthMix);
        col = mix(col, lagoon, shelfMix * 0.88);
        col = mix(col, col * 1.12, ring * 0.18 + drift * 0.12 + vWave * 0.30);

        /* --- bọt sóng vỗ bờ đảo chính --- */
        float surf = (1.0 - smoothstep(uIsland - 2.2, uIsland + 3.4, d)) * smoothstep(uIsland - 6.5, uIsland - 2.0, d);
        float surfPulse = 0.55 + 0.45 * sin(d * 1.5 - uTime * 2.1);
        col = mix(col, vec3(0.90, 0.97, 0.96), surf * surfPulse * 0.55);

        /* --- vành san hô: ranh giới lãnh thổ, sáng lên bằng bọt trắng --- */
        float reef = exp(-pow((d - uTerritory) * 0.42, 2.0));
        float reefFoam = 0.5 + 0.5 * sin(atan(p.y, p.x) * 42.0 + uTime * 1.4);
        col = mix(col, vec3(0.72, 0.90, 0.88), reef * (0.32 + reefFoam * 0.34));
        /* nước bên trong vành sáng hơn hẳn bên ngoài — thấy ngay đâu là lãnh hải */
        col *= mix(0.72, 1.0, smoothstep(uTerritory + 12.0, uTerritory - 8.0, d));

        /* --- phản chiếu mặt trời và mặt trăng --- */
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 sunHalf = normalize(viewDir + normalize(uSunDir));
        float sunSpec = pow(clamp(sunHalf.y + vWave * 0.2, 0.0, 1.0), 92.0);
        col += vec3(0.96, 0.74, 0.46) * sunSpec * (0.14 + 0.34 * ring) * uDaylight;
        vec3 moonHalf = normalize(viewDir + normalize(uMoonDir));
        float moonSpec = pow(clamp(moonHalf.y + vWave * 0.26, 0.0, 1.0), 60.0);
        col += vec3(0.62, 0.74, 0.96) * moonSpec * (0.10 + 0.28 * ring) * (1.0 - uDaylight);

        float fresnel = pow(1.0 - max(viewDir.y, 0.0), 3.0);
        col = mix(col, mix(vec3(0.10, 0.20, 0.28), vec3(0.18, 0.38, 0.44), uDaylight), fresnel * 0.26);

        /* --- vòng sóng do mưa rơi --- */
        if (uRain > 0.01) {
          vec2 cell = floor(p * 1.9);
          float phase = fract(uTime * 1.7 + hash21(cell));
          float local = length(fract(p * 1.9) - 0.5);
          float ripple = smoothstep(0.06, 0.0, abs(local - phase * 0.5)) * (1.0 - phase);
          col += vec3(0.5, 0.62, 0.66) * ripple * uRain * 0.42;
          col = mix(col, col * 0.82, uRain * 0.25);
        }

        /* Sương chỉ ăn vào mặt nước từ khoảng 190 đơn vị trở ra; gần hơn thế thì
           vùng biển quanh đảo phải giữ nguyên sắc ngọc lam của nó. */
        float fogFactor = smoothstep(190.0, 520.0, distance(cameraPosition, vWorld));
        col = mix(col, uFog, fogFactor);
        gl_FragColor = vec4(col, 1.0);
        /* Cùng lý do với vòm trời: cần tone mapping và mã hoá sRGB tường minh. */
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(oceanGeometry(), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL;
  mesh.renderOrder = -50;
  mesh.frustumCulled = false;

  return {
    mesh,
    apply({ daylight, sunDir, moonDir, fog, shallow, rain }) {
      const u = material.uniforms;
      u.uDaylight.value = daylight;
      (u.uSunDir.value as THREE.Vector3).copy(sunDir);
      (u.uMoonDir.value as THREE.Vector3).copy(moonDir);
      (u.uFog.value as THREE.Color).copy(fog);
      (u.uShallow.value as THREE.Color).copy(shallow);
      u.uRain.value = rain;
    },
    tick: (t) => {
      material.uniforms.uTime.value = t;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Thềm cát dưới nước — thứ làm bãi biển "rộng ra" và sáng lên         */
/* ------------------------------------------------------------------ */

export function makeSandShelf(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(ISLAND_RADIUS - 4.5, SHELF_RADIUS, 96, 8);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const near = new THREE.Color(0xd9c691);
  const far = new THREE.Color(0x5d7c74);
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const radius = Math.hypot(x, y);
    const k = THREE.MathUtils.clamp((radius - (ISLAND_RADIUS - 4.5)) / (SHELF_RADIUS - ISLAND_RADIUS + 4.5), 0, 1);
    // Thềm chìm dần ra xa và gợn nhẹ để không phẳng lì như đĩa.
    const ripple = Math.sin(x * 0.22) * Math.cos(y * 0.19) * 0.28;
    position.setZ(i, -0.35 - Math.pow(k, 1.6) * 5.4 + ripple * (1 - k));
    tint.copy(near).lerp(far, Math.pow(k, 0.85));
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL + 0.05;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------ */
/*  Vành ranh giới — người chơi luôn thấy lãnh thổ của mình tới đâu     */
/* ------------------------------------------------------------------ */

export interface Boundary {
  group: THREE.Group;
  tick: TickFn;
  /** 0 = ở xa, 1 = sát mép — vách sáng hiện dần khi du thuyền tiến tới. */
  setProximity(value: number): void;
  setTint(color: THREE.Color): void;
}

export function makeBoundary(): Boundary {
  const group = new THREE.Group();

  /* rạn san hô nhô lên khỏi mặt nước */
  const reefMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6f74, roughness: 0.92, metalness: 0.04, flatShading: true });
  const reefGeometry = new THREE.TorusGeometry(TERRITORY_RADIUS, 1.5, 6, 220);
  const reefPosition = reefGeometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < reefPosition.count; i++) {
    const x = reefPosition.getX(i);
    const y = reefPosition.getY(i);
    const z = reefPosition.getZ(i);
    const angle = Math.atan2(y, x);
    // Rạn gồ ghề, có chỗ nhô cao chỗ chìm — không phải một cái ống trơn.
    const bumps = Math.sin(angle * 34) * 0.5 + Math.sin(angle * 11 + 1.7) * 0.7 + Math.sin(angle * 61) * 0.25;
    reefPosition.setXYZ(i, x * (1 + bumps * 0.004), y * (1 + bumps * 0.004), z + bumps * 0.55);
  }
  reefGeometry.computeVertexNormals();
  const reef = new THREE.Mesh(reefGeometry, reefMaterial);
  reef.rotation.x = Math.PI / 2;
  reef.position.y = WATER_LEVEL - 0.35;
  reef.receiveShadow = true;
  group.add(reef);

  /* dải bọt sáng ngay trên rạn */
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0x9ff0e2,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const foam = new THREE.Mesh(new THREE.RingGeometry(TERRITORY_RADIUS - 3.4, TERRITORY_RADIUS + 3.4, 200, 1), foamMaterial);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = WATER_LEVEL + 0.12;
  group.add(foam);

  /* vách sáng dựng đứng — chỉ hiện khi tới gần, để không làm rối khung hình */
  const wallMaterial = new THREE.MeshBasicMaterial({
    color: 0x7fe8bb,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(TERRITORY_RADIUS, TERRITORY_RADIUS, 15, 180, 1, true), wallMaterial);
  wall.position.y = WATER_LEVEL + 7.2;
  wall.visible = false;
  group.add(wall);

  let proximity = 0;
  return {
    group,
    setProximity(value) {
      proximity = THREE.MathUtils.clamp(value, 0, 1);
      wall.visible = proximity > 0.01;
    },
    setTint(color) {
      foamMaterial.color.copy(color).lerp(new THREE.Color(0xffffff), 0.45);
    },
    tick: (t) => {
      foamMaterial.opacity = 0.12 + Math.sin(t * 0.9) * 0.04 + proximity * 0.18;
      wallMaterial.opacity = proximity * (0.10 + Math.sin(t * 2.6) * 0.035);
    },
  };
}
