/* ------------------------------------------------------------------ */
/*  Thảm cỏ dựng bằng instancing                                       */
/*                                                                     */
/*  Mặt đảo vốn là một mảng màu xanh phẳng: có cây, có nhà, nhưng giữa  */
/*  chúng không có gì cả. Thứ còn thiếu là lớp cỏ — và cỏ chỉ đọc ra    */
/*  "cỏ" khi có vài nghìn ngọn, con số mà cách dựng thông thường không  */
/*  kham nổi.                                                          */
/*                                                                     */
/*  Ở đây cả thảm là một `InstancedMesh` duy nhất: bốn nghìn ngọn cỏ    */
/*  tốn đúng một lệnh vẽ. Cây thông và cây dừa vẫn do `build.ts` dựng   */
/*  — chúng được tạo hình riêng từng cây (số tầng tán, độ cong thân,    */
/*  độ rủ của tàu lá đều ngẫu nhiên theo hạt giống) nên gộp lại thành   */
/*  một hình dùng chung sẽ đánh mất đúng cái làm chúng đẹp.             */
/* ------------------------------------------------------------------ */

import * as THREE from "three";
import type { TickFn } from "./build";
import { terrainHeightAt, terrainFlatness } from "./build";

export interface Grass {
  mesh: THREE.InstancedMesh | null;
  tick: TickFn;
  /** Đổi sắc cỏ khi sang mùa mới. */
  setPalette(foliage: number, foliageAlt: number, snow: number): void;
  /** Cường độ gió 0..1 — trời lặng thì cỏ gần như đứng yên. */
  setWind(strength: number): void;
  dispose(): void;
}

/**
 * Một ngọn cỏ: năm đỉnh, ba tam giác, thuôn dần rồi nhọn ở đầu.
 *
 * Thuộc tính `color` chạy từ gốc sẫm lên ngọn sáng. Đó là thứ duy nhất khiến
 * thảm cỏ đọc ra chiều sâu — nếu cả ngọn cùng một màu thì bốn nghìn ngọn cỏ
 * chỉ ra một mảng bệt y hệt mặt đất phẳng mà nó đang thay thế.
 */
function bladeGeometry(): THREE.BufferGeometry {
  const w = 0.055;
  const h = 1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-w, 0, 0, w, 0, 0, -w * 0.42, h * 0.62, 0.02, w * 0.42, h * 0.62, 0.02, 0, h, 0.06],
      3
    )
  );
  /* Pháp tuyến ngả về phía trên chứ không nằm ngang: ngọn cỏ đón được ánh trời
     thay vì tối om mỗi khi mặt trời không chiếu thẳng vào mặt lá. */
  const n = new THREE.Vector3(0, 0.42, 0.91).normalize();
  geo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, 0, 1, 0], 3)
  );
  geo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      [0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 1.18, 1.18, 1.18],
      3
    )
  );
  geo.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 4]);
  return geo;
}

/** Bộ sinh số giả ngẫu nhiên có hạt giống: mỗi lần tải trang ra đúng một đảo. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bán kính vùng cỏ mọc — trong là quảng trường, ngoài là bãi cát. */
const GRASS_INNER = 4.2;
const GRASS_OUTER = 17.4;

export function makeGrass(count: number): Grass {
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };
  const noop: Grass = {
    mesh: null,
    tick: () => {},
    setPalette: () => {},
    setWind: () => {},
    dispose: () => {},
  };
  if (count <= 0) return noop;

  const geometry = bladeGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true,
  });

  /**
   * Gió thổi trong vertex shader.
   *
   * Uốn theo `y` mũ 1,7 nên gốc cỏ đứng yên còn ngọn ngả hẳn — đúng cách một
   * thân cỏ chịu lực. Pha lấy từ toạ độ thế giới của chính instance đó
   * (`instanceMatrix[3]`), nên cả thảm cỏ gợn thành sóng chứ không đập cùng nhịp.
   */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uTime;
         uniform float uWind;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float wPhase = instanceMatrix[3].x * 0.62 + instanceMatrix[3].z * 0.47;
           float wBend = pow(max(transformed.y, 0.0), 1.7) * uWind * 0.34;
           transformed.x += sin(uTime * 1.9 + wPhase) * wBend;
           transformed.z += cos(uTime * 1.4 + wPhase * 1.3) * wBend * 0.55;
         #endif`
      );
  };

  /* Gieo bằng cách bắn thử: chỗ nào là lối đi, bệ công trình hay quảng trường
     thì `terrainFlatness` gần 0 và hạt cỏ bị loại. Rẻ hơn nhiều so với dựng một
     bản đồ mặt nạ riêng, mà lại luôn khớp với địa hình thật. */
  const random = mulberry32(0x15ecd);
  const placed: { x: number; z: number; y: number; scale: number; yaw: number; tone: number }[] = [];
  let attempts = 0;
  while (placed.length < count && attempts < count * 12) {
    attempts++;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(GRASS_INNER * GRASS_INNER + random() * (GRASS_OUTER * GRASS_OUTER - GRASS_INNER * GRASS_INNER));
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (terrainFlatness(x, z) < 0.55) continue;
    placed.push({
      x,
      z,
      y: terrainHeightAt(x, z),
      scale: 0.34 + random() * 0.34,
      yaw: random() * Math.PI,
      tone: random(),
    });
  }

  const mesh = new THREE.InstancedMesh(geometry, material, placed.length);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  /* Thảm cỏ không bao giờ chặn con trỏ: raycast qua bốn nghìn instance mỗi lần
     rê chuột là cách nhanh nhất để giết khung hình. */
  mesh.raycast = () => {};
  const dummy = new THREE.Object3D();
  placed.forEach((blade, i) => {
    dummy.position.set(blade.x, blade.y, blade.z);
    dummy.rotation.set(0, blade.yaw, 0);
    dummy.scale.set(0.85 + blade.tone * 0.4, blade.scale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  /* Khối bao mặc định của `InstancedMesh` là hình cầu của một instance ở gốc
     toạ độ, nên không tính lại thì cả thảm bị cắt ngay khi camera rời tâm. */
  mesh.computeBoundingSphere();

  const tint = new THREE.Color();
  const snowTint = new THREE.Color(0xdfe9ec);

  return {
    mesh,
    tick: (t) => {
      uniforms.uTime.value = t;
    },
    setPalette(foliage, foliageAlt, snow) {
      const a = new THREE.Color(foliage);
      const b = new THREE.Color(foliageAlt);
      for (let i = 0; i < placed.length; i++) {
        const tone = placed[i].tone;
        tint.copy(a).lerp(b, tone);
        /* Mỗi ngọn lệch sáng một chút, nếu không thảm cỏ lại thành mảng bệt. */
        tint.multiplyScalar(0.82 + tone * 0.4);
        if (snow > 0) tint.lerp(snowTint, snow * 0.6);
        mesh.setColorAt(i, tint);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    setWind(strength) {
      uniforms.uWind.value = THREE.MathUtils.clamp(strength, 0, 1.6);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
