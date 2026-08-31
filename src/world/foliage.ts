/* ------------------------------------------------------------------ */
/*  Cây cỏ dựng bằng instancing                                        */
/*                                                                     */
/*  Bản trước dựng mỗi cây thông thành một `Group` ba mesh và mỗi cây   */
/*  dừa thành tám mesh: 15 thông + 24 dừa = 237 lệnh vẽ chỉ để có mấy   */
/*  bụi cây ven bãi, và thảm cỏ thì đơn giản là không có — mặt đảo chỉ  */
/*  là một mảng màu xanh phẳng.                                        */
/*                                                                     */
/*  Ở đây mỗi bộ phận là một `InstancedMesh` duy nhất: toàn bộ rừng     */
/*  thông, rừng dừa và bốn nghìn ngọn cỏ gói lại còn tám lệnh vẽ. Nhờ   */
/*  vậy mới đủ ngân sách để trồng dày như ảnh tham chiếu.               */
/* ------------------------------------------------------------------ */

import * as THREE from "three";
import type { Mats, TickFn } from "./build";
import { terrainHeightAt, terrainFlatness } from "./build";

export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  /** 0 hoặc 1 — chọn một trong hai sắc lá của mùa. */
  tint: number;
}

export interface PalmSpot {
  x: number;
  z: number;
  scale: number;
}

export interface FoliageOptions {
  trees: TreeSpot[];
  palms: PalmSpot[];
  /** Số ngọn cỏ; 0 để tắt hẳn thảm cỏ trên máy yếu. */
  grass: number;
}

export interface Foliage {
  group: THREE.Group;
  tick: TickFn;
  /** Đổi sắc lá và sắc cỏ khi sang mùa mới. */
  setPalette(foliage: number, foliageAlt: number, snow: number): void;
  /** Cường độ gió 0..1 — trời lặng thì cỏ gần như đứng yên. */
  setWind(strength: number): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/*  Ngọn cỏ                                                            */
/* ------------------------------------------------------------------ */

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
      [
        -w, 0, 0,
        w, 0, 0,
        -w * 0.42, h * 0.62, 0.02,
        w * 0.42, h * 0.62, 0.02,
        0, h, 0.06,
      ],
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
 * Gió thổi trong vertex shader.
 *
 * Uốn theo `y` mũ 1,7 nên gốc cỏ đứng yên còn ngọn ngả hẳn — đúng cách một
 * thân cỏ chịu lực. Pha lấy từ toạ độ thế giới của chính instance đó
 * (`instanceMatrix[3]`), nên cả thảm cỏ gợn thành sóng chứ không đập cùng nhịp.
 */
function applyWind(material: THREE.Material, uniforms: { uTime: { value: number }; uWind: { value: number } }, amount: number) {
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
           float wBend = pow(max(transformed.y, 0.0), 1.7) * uWind * ${amount.toFixed(3)};
           transformed.x += sin(uTime * 1.9 + wPhase) * wBend;
           transformed.z += cos(uTime * 1.4 + wPhase * 1.3) * wBend * 0.55;
         #endif`
      );
  };
  material.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/*  Gieo cỏ                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */

export function makeFoliage(m: Mats, options: FoliageOptions): Foliage {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };
  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  function register<T extends THREE.InstancedMesh>(mesh: T): T {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    disposables.push(mesh.geometry);
    return mesh;
  }

  /* ---------------------------- thông ---------------------------- */
  /* Ba tầng khối của cây thông cũ, nay là ba `InstancedMesh`. Màu lá đi qua
     `instanceColor` nên đổi mùa chỉ là ghi lại một mảng nhỏ, không dựng lại
     hình. Vật liệu để trắng vì `instanceColor` nhân vào màu vật liệu. */
  const treeCount = options.trees.length;
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.7, 5);
  const cone1Geo = new THREE.ConeGeometry(0.75, 1.3, 6);
  const cone2Geo = new THREE.ConeGeometry(0.52, 1.0, 6);
  const trunks = register(new THREE.InstancedMesh(trunkGeo, m.wood, treeCount));
  const cone1 = register(new THREE.InstancedMesh(cone1Geo, leafMat, treeCount));
  const cone2 = register(new THREE.InstancedMesh(cone2Geo, leafMat, treeCount));
  disposables.push(leafMat);

  options.trees.forEach((spot, i) => {
    const s = spot.scale;
    const base = terrainHeightAt(spot.x, spot.z);
    const yaw = spot.x * spot.z;
    const place = (mesh: THREE.InstancedMesh, localY: number, radial: number) => {
      dummy.position.set(spot.x, base + localY * s, spot.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(radial * s, s, radial * s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };
    place(trunks, 0.35, 1);
    place(cone1, 1.15, 1);
    place(cone2, 1.9, 1);
  });

  /* ---------------------------- dừa ---------------------------- */
  /* Sáu tàu lá của mỗi cây dừa gộp chung một instanced mesh: chỉ số instance
     là `cây × 6 + tàu`, nên 24 cây dừa vẫn chỉ tốn ba lệnh vẽ. */
  const palmCount = options.palms.length;
  const FRONDS = 6;
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f9c70, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
  const palmTrunkGeo = new THREE.CylinderGeometry(0.09, 0.15, 1.7, 5);
  const frondGeo = new THREE.ConeGeometry(0.16, 1.15, 4);
  const nutGeo = new THREE.SphereGeometry(0.1, 6, 5);
  const palmTrunks = register(new THREE.InstancedMesh(palmTrunkGeo, m.wood, palmCount));
  const fronds = register(new THREE.InstancedMesh(frondGeo, frondMat, palmCount * FRONDS));
  const nuts = register(new THREE.InstancedMesh(nutGeo, m.wood, palmCount));
  disposables.push(frondMat);

  options.palms.forEach((spot, i) => {
    const s = spot.scale;
    const base = terrainHeightAt(spot.x, spot.z);
    const yaw = spot.x * spot.z;
    dummy.position.set(spot.x, base + 0.85 * s, spot.z);
    dummy.rotation.set(0, yaw, 0.16);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(spot.x + Math.cos(yaw) * 0.28 * s, base + 1.68 * s, spot.z + Math.sin(yaw) * 0.28 * s);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    nuts.setMatrixAt(i, dummy.matrix);
  });

  /**
   * Đặt lại các tàu lá theo một lượng đung đưa. Gọi lần đầu lúc dựng, rồi mỗi
   * vài khung hình khi có gió — tàu dừa to nên chỉ cần nhịp chậm là đủ sống.
   */
  function layoutFronds(sway: number) {
    options.palms.forEach((spot, i) => {
      const s = spot.scale;
      const base = terrainHeightAt(spot.x, spot.z);
      const yaw = spot.x * spot.z;
      for (let f = 0; f < FRONDS; f++) {
        const a = (f / FRONDS) * Math.PI * 2;
        const droop = Math.sin(sway + a + i) * 0.09;
        /* Toạ độ tàu lá trong hệ của cây, xoay quanh trục đứng theo `yaw`. */
        const lx = 0.28 + Math.cos(a) * 0.45;
        const lz = Math.sin(a) * 0.45;
        dummy.position.set(
          spot.x + (lx * Math.cos(yaw) + lz * Math.sin(yaw)) * s,
          base + 1.75 * s,
          spot.z + (-lx * Math.sin(yaw) + lz * Math.cos(yaw)) * s
        );
        dummy.rotation.set(-Math.sin(a) * 1.15 + droop, yaw, Math.cos(a) * 1.15 + droop);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        fronds.setMatrixAt(i * FRONDS + f, dummy.matrix);
      }
    });
    fronds.instanceMatrix.needsUpdate = true;
  }
  fronds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  layoutFronds(0);

  /* Ma trận đã ghi xong thì phải đánh dấu để lần vẽ đầu tiên nạp lên GPU, và
     phải tự tính lại khối bao — mặc định của `InstancedMesh` là hình cầu của
     một instance ở gốc toạ độ, nên cả rừng sẽ bị cắt ngay khi camera rời tâm. */
  for (const mesh of [trunks, cone1, cone2, palmTrunks, nuts]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  fronds.computeBoundingSphere();

  /* ---------------------------- cỏ ---------------------------- */
  let grass: THREE.InstancedMesh | null = null;
  if (options.grass > 0) {
    const grassGeo = bladeGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWind(grassMat, uniforms, 0.34);
    disposables.push(grassGeo, grassMat);

    const random = mulberry32(0x15ecd);
    const placed: { x: number; z: number; y: number; scale: number; yaw: number; tone: number }[] = [];
    /* Gieo bằng cách bắn thử: chỗ nào là lối đi, bệ công trình hay quảng trường
       thì `terrainFlatness` gần 0 và hạt cỏ bị loại. Rẻ hơn nhiều so với dựng
       một bản đồ mặt nạ riêng, mà lại luôn khớp với địa hình thật. */
    let attempts = 0;
    while (placed.length < options.grass && attempts < options.grass * 12) {
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

    grass = new THREE.InstancedMesh(grassGeo, grassMat, placed.length);
    grass.castShadow = false;
    grass.receiveShadow = true;
    /* Thảm cỏ không bao giờ chặn con trỏ: raycast qua bốn nghìn instance mỗi
       lần rê chuột là cách nhanh nhất để giết khung hình. */
    grass.raycast = () => {};
    grass.userData.grass = true;
    placed.forEach((blade, i) => {
      dummy.position.set(blade.x, blade.y, blade.z);
      dummy.rotation.set(0, blade.yaw, 0);
      dummy.scale.set(0.85 + blade.tone * 0.4, blade.scale, 1);
      dummy.updateMatrix();
      grass!.setMatrixAt(i, dummy.matrix);
    });
    grass.instanceMatrix.needsUpdate = true;
    grass.computeBoundingSphere();
    group.add(grass);

    /* Sắc từng ngọn được ghi lại trong `setPalette`; giữ lại hệ số ngẫu nhiên
       để mỗi lần đổi mùa vẫn ra đúng thảm cỏ đó, chỉ khác tông. */
    grass.userData.tones = placed.map((blade) => blade.tone);
  }

  /* ---------------------------- bảng màu ---------------------------- */
  const treeTints = options.trees.map((spot) => spot.tint);
  const snowTint = new THREE.Color(0xdfe9ec);

  function setPalette(foliage: number, foliageAlt: number, snow: number) {
    const a = new THREE.Color(foliage);
    const b = new THREE.Color(foliageAlt);
    for (let i = 0; i < treeCount; i++) {
      tintColor.copy(treeTints[i] ? b : a);
      if (snow > 0) tintColor.lerp(snowTint, snow * 0.42);
      cone1.setColorAt(i, tintColor);
      cone2.setColorAt(i, tintColor);
    }
    if (cone1.instanceColor) cone1.instanceColor.needsUpdate = true;
    if (cone2.instanceColor) cone2.instanceColor.needsUpdate = true;

    /* Dừa giữ sắc nhiệt đới quanh năm — nó là cây của bãi biển, không rụng lá
       theo mùa — nhưng vẫn phủ tuyết khi mùa đông tới. */
    frondMat.color.copy(new THREE.Color(0x3f9c70)).lerp(snowTint, snow * 0.3);

    if (!grass) return;
    const tones = grass.userData.tones as number[];
    for (let i = 0; i < tones.length; i++) {
      tintColor.copy(a).lerp(b, tones[i]);
      /* Mỗi ngọn lệch sáng một chút, nếu không thảm cỏ lại thành mảng bệt. */
      tintColor.multiplyScalar(0.82 + tones[i] * 0.4);
      if (snow > 0) tintColor.lerp(snowTint, snow * 0.6);
      grass.setColorAt(i, tintColor);
    }
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  }

  function setWind(strength: number) {
    uniforms.uWind.value = THREE.MathUtils.clamp(strength, 0, 1.6);
  }

  /* Tàu dừa chỉ cần vẽ lại mười lần mỗi giây; nó là 144 ma trận, không phải
     bốn nghìn — và mắt không phân biệt nổi ở nhịp đung đưa chậm như vậy. */
  let frondClock = 0;
  const tick: TickFn = (t, dt) => {
    uniforms.uTime.value = t;
    frondClock += dt;
    if (frondClock >= 0.1 && uniforms.uWind.value > 0.02) {
      frondClock = 0;
      layoutFronds(t * 0.55);
    }
  };

  return {
    group,
    tick,
    setPalette,
    setWind,
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}
