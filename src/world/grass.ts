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
import { GRASS_U, PLAZA_RADIUS, WATER_LEVEL, coastRadius, mulberry32, sandiness, terrainFlatness, terrainHeightAt } from "./shape";

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

/**
 * Một dải cỏ: gieo ở đâu, cao bao nhiêu, ngả sang sắc gì.
 *
 * Có hai dải. Dải đồng cỏ phủ cao nguyên. Dải cỏ đụn mọc chờm qua ranh giới
 * cỏ–cát và thò tiếp ra bãi: thiếu nó thì chỗ cỏ gặp cát là một đường màu cắt
 * ngang, và mắt đọc ra hai mảng dán cạnh nhau chứ không đọc ra một bãi biển.
 */
export interface GrassBand {
  innerU: number;
  outerU: number;
  /** Mọc được trên cát tới mức nào, 0..1. */
  maxSand: number;
  /** Hệ số chiều cao so với cỏ đồng. */
  height: number;
  /** Sắc mà bảng màu mùa được kéo về, và kéo bao nhiêu. */
  tint?: number;
  tintAmount?: number;
}

export const MEADOW_BAND: GrassBand = { innerU: 0, outerU: GRASS_U, maxSand: 0.08, height: 1 };
/* Cỏ đụn cao hơn, thưa hơn, ngả vàng — và được phép mọc hẳn ra cát. */
export const DUNE_BAND: GrassBand = {
  innerU: GRASS_U - 0.05,
  outerU: 0.9,
  maxSand: 1,
  height: 1.45,
  tint: 0xcbbd7e,
  tintAmount: 0.55,
};

export function makeGrass(count: number, band: GrassBand = MEADOW_BAND): Grass {
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
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true,
    /* Translucency giả lập: cỏ ngược sáng vẫn sáng lên thay vì đen sì. */
    emissive: new THREE.Color(0x1a3d24),
    emissiveIntensity: 0.35,
  });

  /**
   * Gió 2 tầng trong vertex shader: sóng nền + cơn gust lan theo không gian.
   * Uốn theo `y` mũ 1,7 nên gốc đứng yên còn ngọn ngả hẳn. Pha lấy từ toạ độ
   * thế giới của instance nên cả thảm gợn thành sóng chứ không đập cùng nhịp.
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
           float gust = 0.6 + 0.4 * sin(uTime * 0.7 + instanceMatrix[3].x * 0.18 + instanceMatrix[3].z * 0.23);
           gust *= 0.7 + 0.3 * sin(uTime * 1.7 + wPhase * 0.5);
           float wBend = pow(max(transformed.y, 0.0), 1.7) * uWind * 0.38 * gust;
           transformed.x += sin(uTime * 1.9 + wPhase) * wBend;
           transformed.z += cos(uTime * 1.4 + wPhase * 1.3) * wBend * 0.6;
           transformed.y -= wBend * wBend * 0.35;
         #endif`
      );
  };

  /* Gieo bằng cách bắn thử: chỗ nào là lối đi, bệ công trình hay quảng trường
     thì `terrainFlatness` gần 0 và hạt cỏ bị loại. Rẻ hơn nhiều so với dựng một
     bản đồ mặt nạ riêng, mà lại luôn khớp với địa hình thật. */
  const random = mulberry32(0x15ecd);
  const placed: { x: number; z: number; y: number; scale: number; yaw: number; tone: number }[] = [];
  /* Vùng cỏ tính theo `u` chứ không theo bán kính tuyệt đối, nên nó nở ra ở mũi
     đất và co lại trong vịnh y như bãi cát. Bản trước là hằng số 17,4 chép tay,
     lệch hẳn so với mốc bãi cát 17 mà địa hình dùng. */
  const innerU = Math.max(band.innerU, (PLAZA_RADIUS - 5.6) / coastRadius(0));
  const outerU = band.outerU;
  let attempts = 0;
  while (placed.length < count && attempts < count * 12) {
    attempts++;
    const angle = random() * Math.PI * 2;
    const u = Math.sqrt(innerU * innerU + random() * (outerU * outerU - innerU * innerU));
    const radius = u * coastRadius(angle);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (terrainFlatness(x, z) < 0.55) continue;
    /* Cỏ đồng không mọc trên cát ướt lẫn trên vách đá; cỏ đụn thì được. */
    if (sandiness(x, z) > band.maxSand) continue;
    /* Không dải nào mọc dưới mực nước. */
    if (terrainHeightAt(x, z) < WATER_LEVEL + 0.25) continue;
    placed.push({
      x,
      z,
      y: terrainHeightAt(x, z),
      scale: (0.34 + random() * 0.34) * band.height,
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
  const bandTint = band.tint !== undefined ? new THREE.Color(band.tint) : null;

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
        if (bandTint) tint.lerp(bandTint, (band.tintAmount ?? 0.5) * (0.6 + tone * 0.6));
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
