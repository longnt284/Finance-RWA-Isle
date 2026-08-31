import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ISLAND_RADIUS } from "./ocean";
import { surface } from "./textures";
import { DECOR_IDS } from "../lib/decor";
import type { DecorId } from "../lib/decor";

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

export type TickFn = (t: number, dt: number) => void;

export const DISTRICT_POS: Record<string, THREE.Vector3> = {
  crypto: new THREE.Vector3(11.5, 0, -8.5),
  stocks: new THREE.Vector3(-11.5, 0, -8.5),
  vault: new THREE.Vector3(-11.5, 0, 9),
  academy: new THREE.Vector3(11.5, 0, 9),
  center: new THREE.Vector3(0, 0, 0),
};

export { ISLAND_RADIUS };

/* ------------------------------------------------------------------ */
/* Shared materials                                                    */
/* ------------------------------------------------------------------ */

export interface Mats {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  roofTeal: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  goldBright: THREE.MeshStandardMaterial;
  glowWarm: THREE.MeshStandardMaterial;
  glowCyan: THREE.MeshStandardMaterial;
  glowBlue: THREE.MeshStandardMaterial;
  leaves1: THREE.MeshStandardMaterial;
  leaves2: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  scaffold: THREE.MeshStandardMaterial;
  barUp: THREE.MeshStandardMaterial;
  barDown: THREE.MeshStandardMaterial;
}

export function makeMats(): Mats {
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02, ...p });
    material.userData.shared = true;
    return material;
  };
  /**
   * Vân bề mặt gắn kèm ngay lúc dựng vật liệu. `normalScale` cố ý nhỏ: mục
   * tiêu là ánh sáng gợn theo mặt chứ không phải mặt bị rỗ.
   *
   * Về số lần lặp: vật liệu ở đây dùng chung cho cả khối lớn lẫn khối bé, mà
   * UV của mọi hình dựng sẵn đều chạy 0..1 bất kể vật thể to hay nhỏ. Nghĩa là
   * một con số lặp duy nhất sẽ ra vân mịn trên khối bé và vân khổng lồ trên
   * khối lớn. Khi buộc phải chọn một phía, luôn chọn phía **lặp dày**: vân quá
   * mịn thì cùng lắm là không nhìn thấy, còn vân quá to thì biến sân đá thành
   * mặt sóng bê tông — đúng lỗi mà bản thử đầu tiên mắc phải.
   */
  const dressed = (
    p: THREE.MeshStandardMaterialParameters,
    kind: Parameters<typeof surface>[0],
    repeat: number,
    normalScale: number
  ) => {
    const maps = surface(kind, repeat);
    const material = std({ ...p, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap });
    material.normalScale.set(normalScale, normalScale);
    return material;
  };
  return {
    /* `envMapIntensity` là thứ biến khối vàng phẳng thành kim loại thật: nó lấy
       bản đồ môi trường mà WorldScene nướng từ bầu trời để phản chiếu. */
    stone: dressed({ color: 0xa9b9b3, roughness: 0.72, metalness: 0.06, envMapIntensity: 0.5 }, "stone", 12, 0.32),
    stoneDark: dressed({ color: 0x64787a, roughness: 0.9, envMapIntensity: 0.35 }, "stone", 12, 0.36),
    white: dressed({ color: 0xe4efe9, roughness: 0.6, metalness: 0.04, envMapIntensity: 0.7 }, "plaster", 10, 0.28),
    wood: dressed({ color: 0x6e4b33, roughness: 0.82 }, "wood", 6, 0.45),
    roofTeal: dressed({ color: 0x1e5f58, roughness: 0.55, metalness: 0.12, envMapIntensity: 0.8 }, "metal", 8, 0.26),
    gold: dressed({ color: 0xe0aa50, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.5 }, "metal", 6, 0.18),
    goldBright: dressed({ color: 0xffd88a, metalness: 1.0, roughness: 0.14, envMapIntensity: 1.9 }, "metal", 6, 0.14),
    glowWarm: std({ color: 0x2a1c0a, emissive: 0xffc069, emissiveIntensity: 1.7, roughness: 0.4 }),
    glowCyan: std({ color: 0x06231f, emissive: 0x5ce8c4, emissiveIntensity: 1.9, roughness: 0.35 }),
    glowBlue: std({ color: 0x0a1a2a, emissive: 0x9fd0ff, emissiveIntensity: 1.6, roughness: 0.35 }),
    leaves1: dressed({ color: 0x2e7d5f, roughness: 0.86 }, "foliage", 3, 0.35),
    leaves2: dressed({ color: 0x3f9c70, roughness: 0.86 }, "foliage", 3, 0.35),
    rock: dressed({ color: 0x47595d, roughness: 1 }, "stone", 4, 0.7),
    scaffold: dressed({ color: 0x8a6a44, roughness: 1 }, "wood", 6, 0.45),
    barUp: std({ color: 0x0f3d2e, emissive: 0x4cd99a, emissiveIntensity: 1.1 }),
    barDown: std({ color: 0x3d150f, emissive: 0xff7f6e, emissiveIntensity: 1.0 }),
  };
}

/**
 * Cạnh vát.
 *
 * Trong đời thật không có vật thể nào có cạnh sắc tuyệt đối: luôn có một dải
 * vài phần milimét bo lại, và chính dải đó bắt lấy ánh sáng thành một đường
 * highlight mảnh chạy dọc mép. Khối hộp toán học không có đường đó nên mắt đọc
 * ra ngay là hình dựng bằng máy. Bo cạnh là thay đổi rẻ nhất mà đổi được cảm
 * giác "khối đồ hoạ" sang "vật thể có người làm ra".
 *
 * Khối quá mỏng (ván, dây, thanh giằng) thì bỏ qua: bán kính bo sẽ lớn hơn
 * chính bề dày của nó, và cũng chẳng ai nhìn thấy.
 */
const BEVEL_MIN_EDGE = 0.22;

const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const bw = Math.max(0.01, w);
  const bh = Math.max(0.01, h);
  const bd = Math.max(0.01, d);
  const shortest = Math.min(bw, bh, bd);
  if (shortest < BEVEL_MIN_EDGE) return new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
  const radius = Math.min(0.05, shortest * 0.16);
  return new THREE.Mesh(new RoundedBoxGeometry(bw, bh, bd, 1, radius), m);
};
const cyl = (rt: number, rb: number, h: number, seg: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.01, rt), Math.max(0.01, rb), Math.max(0.01, h), Math.max(3, seg)), m);

/**
 * Gộp mọi mesh trong một nhóm lại thành một mesh cho mỗi vật liệu.
 *
 * Cây cối bây giờ có nhiều bộ phận hơn hẳn bản trước — thân dừa là bảy đốt
 * cong, tán là chín tàu lá — nên nếu để nguyên thì mỗi cây tốn gần hai chục
 * lệnh vẽ. Gộp lại giữ y nguyên hình dạng nhưng đưa con số đó về đúng bằng số
 * vật liệu, tức là hai hoặc ba. Nhờ vậy mới có ngân sách để trồng dày hơn.
 *
 * Chỉ dùng cho những thứ dựng xong là đứng yên: gộp rồi thì không còn xoay
 * riêng từng bộ phận được nữa.
 */
function mergeByMaterial(source: THREE.Group): THREE.Group {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sources: THREE.Mesh[] = [];
  source.updateMatrixWorld(true);
  source.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && !Array.isArray(mesh.material)) sources.push(mesh);
  });

  for (const mesh of sources) {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    /* Chỉ giữ ba thuộc tính này: gộp đòi hỏi mọi mảnh có cùng bộ thuộc tính. */
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
    }
    if (!geometry.attributes.uv) {
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    }
    const material = mesh.material as THREE.Material;
    const bucket = buckets.get(material);
    if (bucket) bucket.push(geometry);
    else buckets.set(material, [geometry]);
    mesh.geometry.dispose();
  }

  const merged = new THREE.Group();
  for (const [material, geometries] of buckets) {
    const combined = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!combined) continue;
    const mesh = new THREE.Mesh(combined, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    merged.add(mesh);
  }
  return merged;
}

function castAll(g: THREE.Group) {
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/* Scaffolding shown for level-0 (construction site) */
function addScaffold(g: THREE.Group, m: Mats, w: number, h: number) {
  const hw = w / 2 + 0.35;
  const post = () => box(0.1, h, 0.1, m.scaffold);
  const spots: [number, number][] = [
    [hw, hw], [-hw, hw], [hw, -hw], [-hw, -hw],
  ];
  for (const [x, z] of spots) {
    const p = post();
    p.position.set(x, h / 2 + 0.2, z);
    g.add(p);
  }
  for (let i = 0; i < 2; i++) {
    const plank = box(w + 0.9, 0.07, 0.28, m.scaffold);
    plank.position.set(0, 0.6 + i * (h * 0.45), hw);
    plank.rotation.y = i * 0.12;
    g.add(plank);
  }
  const craneMast = box(0.14, h + 1.6, 0.14, m.scaffold);
  craneMast.position.set(-hw - 0.7, (h + 1.6) / 2 + 0.2, 0);
  g.add(craneMast);
  const craneArm = box(2.6, 0.12, 0.12, m.scaffold);
  craneArm.position.set(-hw + 0.4, h + 1.75, 0);
  g.add(craneArm);
  const cable = box(0.03, 1.1, 0.03, m.stoneDark);
  cable.position.set(-hw + 1.5, h + 1.1, 0);
  g.add(cable);
  const hook = box(0.4, 0.4, 0.4, m.wood);
  hook.position.set(-hw + 1.5, h + 0.45, 0);
  g.add(hook);
}

/* ------------------------------------------------------------------ */
/* District buildings (level 0..5)                                     */
/* ------------------------------------------------------------------ */

export function buildSpire(level: number, m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const base = cyl(2.5, 2.9, 0.55, 6, m.stoneDark);
  base.position.y = 0.28;
  g.add(base);

  if (level === 0) {
    const slab = cyl(1.9, 2.1, 0.5, 4, m.stone);
    slab.position.y = 0.8;
    g.add(slab);
    addScaffold(g, m, 3.4, 3.2);
    castAll(g);
    return g;
  }

  const tiers = 1 + level;
  let y = 0.55;
  let size = 2.5;
  for (let i = 0; i < tiers; i++) {
    const h = 1.15 - i * 0.06;
    const tier = box(size, h, size, i % 2 === 0 ? m.stone : m.white);
    tier.position.y = y + h / 2;
    tier.rotation.y = (i * Math.PI) / 4;
    g.add(tier);
    if (level >= 2 && i > 0) {
      const win = box(size * 0.28, h * 0.4, 0.06, m.glowCyan);
      win.position.set(0, y + h / 2, size / 2 + 0.02);
      win.rotation.y = tier.rotation.y;
      win.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      const a = tier.rotation.y;
      win.position.set(Math.sin(a) * (size / 2 + 0.03), y + h / 2, Math.cos(a) * (size / 2 + 0.03));
      g.add(win);
    }
    y += h;
    size *= 0.8;
  }
  // beacon
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + level * 0.06), m.glowCyan);
  gem.position.y = y + 0.55;
  g.add(gem);
  const gemLight = new THREE.PointLight(0x5ce8c4, 0.5 + level * 0.25, 18);
  gemLight.position.y = y + 0.7;
  g.add(gemLight);
  ticks.push((t) => {
    gem.rotation.y = t * 0.9;
    gem.position.y = y + 0.55 + Math.sin(t * 1.6) * 0.12;
  });

  if (level >= 3) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 8, 40), m.goldBright);
    ring.position.y = y * 0.55;
    ring.rotation.x = Math.PI / 2.4;
    g.add(ring);
    ticks.push((t) => {
      ring.rotation.z = t * 0.7;
      ring.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.8) * 0.12;
    });
  }
  if (level >= 4) {
    const orbit = new THREE.Group();
    orbit.position.y = y * 0.7;
    for (let i = 0; i < 3; i++) {
      const coin = cyl(0.3, 0.3, 0.08, 14, m.goldBright);
      coin.rotation.z = Math.PI / 2;
      const a = (i / 3) * Math.PI * 2;
      coin.position.set(Math.cos(a) * 2.4, Math.sin(a * 2) * 0.3, Math.sin(a) * 2.4);
      orbit.add(coin);
    }
    g.add(orbit);
    ticks.push((_, dt) => {
      orbit.rotation.y += dt * 0.9;
    });
  }
  if (level >= 5) {
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 4), m.goldBright);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      spike.position.set(Math.cos(a) * 1.1, y + 0.3, Math.sin(a) * 1.1);
      g.add(spike);
    }
  }
  if (level >= 6) {
    /* bia rune lơ lửng quanh thân tháp */
    const tablets = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const tablet = box(0.42, 0.66, 0.06, m.glowCyan);
      const a = (i / 5) * Math.PI * 2;
      tablet.position.set(Math.cos(a) * 3.0, y * 0.42 + Math.sin(a * 1.7) * 0.5, Math.sin(a) * 3.0);
      tablet.rotation.y = -a;
      tablets.add(tablet);
    }
    g.add(tablets);
    ticks.push((t, dt) => {
      tablets.rotation.y -= dt * 0.35;
      tablets.position.y = Math.sin(t * 0.8) * 0.22;
    });
  }
  if (level >= 7) {
    /* cột sáng xuyên qua đỉnh tháp */
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.9, 22, 14, 1, true), shaftMat);
    shaft.position.y = y + 11;
    g.add(shaft);
    ticks.push((t) => {
      shaftMat.opacity = 0.05 + Math.abs(Math.sin(t * 0.7)) * 0.05;
      shaft.rotation.y = t * 0.12;
    });
  }
  if (level >= 8) {
    /* vương miện ánh sáng và vệ tinh quay quanh đỉnh */
    const crown = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.07, 10, 44), m.goldBright);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = y + 1.5;
    g.add(crown);
    const satellites = new THREE.Group();
    satellites.position.y = y + 1.5;
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), m.goldBright);
      const a = (i / 3) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
      satellites.add(shard);
    }
    g.add(satellites);
    ticks.push((t, dt) => {
      satellites.rotation.y += dt * 1.15;
      crown.rotation.z = t * 0.5;
    });
  }
  castAll(g);
  return g;
}

export function buildExchange(level: number, m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const stylobate = box(4.8, 0.5, 3.6, m.stoneDark);
  stylobate.position.y = 0.25;
  g.add(stylobate);

  if (level === 0) {
    const slab = box(3.6, 0.5, 2.6, m.stone);
    slab.position.y = 0.75;
    g.add(slab);
    addScaffold(g, m, 4.0, 3.0);
    castAll(g);
    return g;
  }

  const cols = Math.min(4 + level, 8);
  const colH = 2.1 + level * 0.12;
  for (let i = 0; i < cols; i++) {
    const x = -1.9 + (3.8 / (cols - 1)) * i;
    for (const z of [-1.35, 1.35]) {
      const c = cyl(0.15, 0.19, colH, 8, m.white);
      c.position.set(x, 0.5 + colH / 2, z);
      g.add(c);
    }
  }
  if (level >= 2) {
    const door = box(0.9, 1.5, 0.12, m.glowWarm);
    door.position.set(0, 1.25, -1.3);
    g.add(door);
  }
  const entab = box(4.5, 0.5, 3.2, m.stone);
  const entabY = 0.5 + colH + 0.25;
  entab.position.y = entabY;
  g.add(entab);
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.25, 4), m.roofTeal);
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.z = 0.72;
  pediment.position.y = entabY + 0.25 + 0.62;
  g.add(pediment);

  // market-pulse equalizer
  const bars: THREE.Mesh[] = [];
  const barCount = 11;
  for (let i = 0; i < barCount; i++) {
    const geo = new THREE.BoxGeometry(0.16, 1, 0.16);
    geo.translate(0, 0.5, 0);
    const bar = new THREE.Mesh(geo, i % 2 === 0 ? m.barUp : m.barDown);
    const x = -2.2 + (4.4 / (barCount - 1)) * i;
    bar.position.set(x, 0.55, 2.35);
    bar.scale.y = 0.2;
    bars.push(bar);
    g.add(bar);
  }
  ticks.push((t) => {
    for (let i = 0; i < bars.length; i++) {
      bars[i].scale.y = 0.25 + Math.abs(Math.sin(t * (1.4 + i * 0.13) + i * 1.7)) * (0.5 + level * 0.18);
    }
  });

  if (level >= 4) {
    const pole = cyl(0.04, 0.04, 1.3, 6, m.stoneDark);
    pole.position.set(0, entabY + 1.9, 0);
    g.add(pole);
    const flag = box(0.8, 0.42, 0.03, m.gold);
    flag.position.set(0.42, entabY + 2.35, 0);
    g.add(flag);
  }
  if (level >= 5) {
    const statue = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), m.goldBright);
    statue.position.set(0, entabY + 1.25, 1.1);
    g.add(statue);
    ticks.push((t) => {
      statue.rotation.y = t * 0.6;
    });
  }
  if (level >= 6) {
    /* bảng điện tử chạy chữ vòng quanh diềm mái */
    const tapeMat = new THREE.MeshBasicMaterial({ color: 0x4cd99a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const segments: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const cell = box(0.2, 0.16, 0.04, tapeMat);
      cell.position.set(-2.15 + (4.3 / 15) * i, entabY + 0.02, 1.63);
      segments.push(cell);
      g.add(cell);
    }
    ticks.push((t) => {
      segments.forEach((cell, i) => {
        cell.scale.y = 0.5 + Math.abs(Math.sin(t * 2.4 + i * 0.6)) * 1.1;
      });
    });
  }
  if (level >= 7) {
    /* hai cánh nhà phụ hai bên, sàn giao dịch mở rộng */
    for (const side of [-1, 1]) {
      const wing = box(1.5, colH * 0.72, 2.4, m.white);
      wing.position.set(side * 3.05, 0.5 + (colH * 0.72) / 2, 0);
      g.add(wing);
      const wingRoof = box(1.7, 0.28, 2.6, m.roofTeal);
      wingRoof.position.set(side * 3.05, 0.5 + colH * 0.72 + 0.14, 0);
      g.add(wingRoof);
      const wingWin = box(0.06, colH * 0.4, 1.5, m.glowWarm);
      wingWin.position.set(side * 3.82, 1.5, 0);
      g.add(wingWin);
    }
  }
  if (level >= 8) {
    /* tượng bò vàng — biểu tượng thị trường tăng giá */
    const bull = new THREE.Group();
    const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.68, 4, 10), m.goldBright);
    bodyMesh.rotation.z = Math.PI / 2;
    bodyMesh.position.y = 0.62;
    bull.add(bodyMesh);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), m.goldBright);
    headMesh.position.set(0.62, 0.76, 0);
    bull.add(headMesh);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6), m.gold);
      horn.position.set(0.7, 0.98, side * 0.16);
      horn.rotation.z = -0.5;
      bull.add(horn);
      for (const front of [0.34, -0.34]) {
        const leg = cyl(0.08, 0.09, 0.6, 6, m.goldBright);
        leg.position.set(front, 0.3, side * 0.2);
        bull.add(leg);
      }
    }
    bull.position.set(0, 0.5, 3.4);
    bull.rotation.y = -0.35;
    bull.scale.setScalar(1.15);
    g.add(bull);
    const bullLight = new THREE.PointLight(0xffd88a, 0.8, 9);
    bullLight.position.set(0, 2.0, 3.4);
    g.add(bullLight);
    ticks.push((t) => {
      bullLight.intensity = 0.65 + Math.sin(t * 1.7) * 0.22;
    });
  }
  castAll(g);
  return g;
}

export function buildVault(level: number, m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const base = box(4.2, 0.5, 3.5, m.stoneDark);
  base.position.y = 0.25;
  g.add(base);

  if (level === 0) {
    const slab = box(3.2, 0.6, 2.5, m.stone);
    slab.position.y = 0.8;
    g.add(slab);
    addScaffold(g, m, 3.6, 2.6);
    castAll(g);
    return g;
  }

  const bodyH = 1.7 + level * 0.22;
  const body = box(3.4, bodyH, 2.9, m.stone);
  body.position.y = 0.5 + bodyH / 2;
  g.add(body);
  const parapet = box(3.7, 0.32, 3.2, m.stoneDark);
  parapet.position.y = 0.5 + bodyH + 0.16;
  g.add(parapet);

  // vault door
  const door = cyl(0.85, 0.85, 0.14, 20, m.gold);
  door.rotation.x = Math.PI / 2;
  door.position.set(0, 1.5, 1.5);
  g.add(door);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 24), m.goldBright);
  rim.position.set(0, 1.5, 1.58);
  g.add(rim);
  for (let i = 0; i < 3; i++) {
    const spoke = box(1.5, 0.09, 0.06, m.goldBright);
    spoke.position.set(0, 1.5, 1.6);
    spoke.rotation.z = (i / 3) * Math.PI;
    g.add(spoke);
  }
  const handle = cyl(0.16, 0.16, 0.1, 10, m.stoneDark);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 1.5, 1.66);
  g.add(handle);

  // gold ingots outside — more with level
  const ingotSpots: [number, number][] = [
    [-2.5, 1.9], [-2.8, 1.4], [-2.2, 1.35], [2.5, 1.9], [2.8, 1.4], [2.3, 1.3],
    [-2.6, 2.3], [2.6, 2.35], [-3.0, 1.9], [3.0, 1.9],
  ];
  for (let i = 0; i < Math.min(level * 2, ingotSpots.length); i++) {
    const [x, z] = ingotSpots[i];
    const ingot = box(0.42, 0.16, 0.24, m.goldBright);
    ingot.position.set(x, 0.62 + (i % 3) * 0.15, z);
    ingot.rotation.y = (i * 37) % Math.PI;
    g.add(ingot);
  }
  if (level >= 3) {
    for (const [x, z] of [[-1.7, 1.46], [1.7, 1.46]] as [number, number][]) {
      const col = cyl(0.16, 0.2, bodyH * 0.9, 6, m.gold);
      col.position.set(x, 0.5 + (bodyH * 0.9) / 2, z);
      g.add(col);
    }
  }
  if (level >= 4) {
    const slit = box(0.14, 0.7, 0.06, m.glowWarm);
    slit.position.set(1.1, 1.6, 1.48);
    g.add(slit);
    const slit2 = slit.clone();
    slit2.position.x = -1.1;
    g.add(slit2);
  }
  if (level >= 5) {
    const crown = box(2.2, 0.28, 1.8, m.goldBright);
    crown.position.y = 0.5 + bodyH + 0.46;
    g.add(crown);
  }
  if (level >= 6) {
    /* bốn tháp canh ở góc, kho báu bắt đầu cần bảo vệ */
    for (const [x, z] of [[-2.1, -1.7], [2.1, -1.7], [-2.1, 1.7], [2.1, 1.7]] as [number, number][]) {
      const turret = cyl(0.32, 0.4, 1.5, 6, m.stone);
      turret.position.set(x, 1.25, z);
      g.add(turret);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.55, 6), m.roofTeal);
      cap.position.set(x, 2.28, z);
      g.add(cap);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), m.glowWarm);
      eye.position.set(x, 1.95, z * 1.12);
      g.add(eye);
    }
  }
  if (level >= 7) {
    /* lưới laser bảo vệ cửa kho */
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff9a6b, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const beams: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const beam = box(3.6, 0.03, 0.03, laserMat);
      beam.position.set(0, 0.7 + i * 0.55, 2.05);
      beams.push(beam);
      g.add(beam);
    }
    ticks.push((t) => {
      laserMat.opacity = 0.28 + Math.abs(Math.sin(t * 1.9)) * 0.34;
      beams.forEach((beam, i) => {
        beam.position.y = 0.7 + i * 0.55 + Math.sin(t * 0.9 + i) * 0.05;
      });
    });
  }
  if (level >= 8) {
    /* khối vàng lơ lửng trên nóc — biểu tượng dự trữ đã vượt ngưỡng */
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), m.goldBright);
    const orbY = 0.5 + bodyH + 1.7;
    orb.position.y = orbY;
    g.add(orb);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 40), m.gold);
    halo.position.y = orbY;
    halo.rotation.x = Math.PI / 2.6;
    g.add(halo);
    const orbLight = new THREE.PointLight(0xffd88a, 1.2, 16);
    orbLight.position.y = orbY;
    g.add(orbLight);
    ticks.push((t, dt) => {
      orb.rotation.y += dt * 0.55;
      orb.position.y = orbY + Math.sin(t * 1.3) * 0.18;
      halo.rotation.z = t * 0.7;
      orbLight.intensity = 1.0 + Math.sin(t * 2.1) * 0.3;
    });
  }
  castAll(g);
  return g;
}

export function buildAcademy(level: number, m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const base = box(3.8, 0.5, 3.2, m.stoneDark);
  base.position.y = 0.25;
  g.add(base);

  if (level === 0) {
    const slab = box(2.8, 0.5, 2.3, m.stone);
    slab.position.y = 0.75;
    g.add(slab);
    addScaffold(g, m, 3.2, 2.8);
    castAll(g);
    return g;
  }

  const hall = box(2.7, 1.5 + level * 0.1, 2.3, m.white);
  hall.position.set(-0.3, 0.5 + (1.5 + level * 0.1) / 2, 0);
  g.add(hall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.1, 4), m.roofTeal);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.82;
  roof.position.set(-0.3, 0.5 + 1.5 + level * 0.1 + 0.55, 0);
  g.add(roof);

  if (level >= 2) {
    const win = box(1.1, 0.7, 0.07, m.glowWarm);
    win.position.set(-0.3, 1.5, 1.17);
    g.add(win);
  }

  const towerH = 2.1 + level * 0.4;
  const tower = cyl(0.68, 0.78, towerH, 8, m.stone);
  tower.position.set(1.5, 0.5 + towerH / 2, -0.4);
  g.add(tower);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.gold);
  dome.position.set(1.5, 0.5 + towerH, -0.4);
  g.add(dome);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m.goldBright);
  finial.position.set(1.5, 0.5 + towerH + 0.78, -0.4);
  g.add(finial);

  if (level >= 3) {
    const sparks = new THREE.Group();
    sparks.position.set(0.4, 2.6, 0);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16), m.glowBlue);
      sparks.add(s);
    }
    g.add(sparks);
    const sparkLight = new THREE.PointLight(0x9fd0ff, 0.5, 12);
    sparkLight.position.set(0.4, 3, 0);
    g.add(sparkLight);
    ticks.push((t) => {
      sparks.children.forEach((c, i) => {
        const a = t * 0.8 + (i / 4) * Math.PI * 2;
        c.position.set(Math.cos(a) * 1.9, Math.sin(t * 1.3 + i) * 0.35, Math.sin(a) * 1.9);
        c.rotation.x = t + i;
        c.rotation.y = t * 1.4 + i;
      });
    });
  }
  if (level >= 5) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.045, 8, 32), m.goldBright);
    ring.position.set(1.5, 0.5 + towerH + 0.35, -0.4);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  if (level >= 6) {
    /* kính viễn vọng chĩa lên trời, có động tác quét chậm */
    const scope = new THREE.Group();
    const tube = cyl(0.16, 0.2, 1.5, 10, m.stone);
    tube.rotation.z = -0.6;
    scope.add(tube);
    const lens = cyl(0.19, 0.19, 0.1, 12, m.glowBlue);
    lens.position.set(0.42, 0.62, 0);
    lens.rotation.z = -0.6;
    scope.add(lens);
    const yoke = cyl(0.07, 0.09, 0.6, 6, m.stoneDark);
    yoke.position.y = -0.5;
    scope.add(yoke);
    scope.position.set(1.5, 0.5 + towerH + 0.95, -0.4);
    g.add(scope);
    ticks.push((t) => {
      scope.rotation.y = Math.sin(t * 0.28) * 0.9;
      scope.children[0].rotation.z = -0.6 + Math.sin(t * 0.4) * 0.18;
    });
  }
  if (level >= 7) {
    /* gian thư viện nối vào giảng đường */
    const annex = box(2.0, 1.35, 1.6, m.white);
    annex.position.set(-2.15, 0.5 + 0.68, 0.9);
    g.add(annex);
    const annexRoof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.75, 4), m.roofTeal);
    annexRoof.rotation.y = Math.PI / 4;
    annexRoof.scale.z = 0.8;
    annexRoof.position.set(-2.15, 0.5 + 1.35 + 0.37, 0.9);
    g.add(annexRoof);
    for (let i = 0; i < 3; i++) {
      const shelfWin = box(0.06, 0.5, 0.34, m.glowWarm);
      shelfWin.position.set(-3.16, 1.2, 0.35 + i * 0.55);
      g.add(shelfWin);
    }
  }
  if (level >= 8) {
    /* vòng chòm sao trên nóc giảng đường */
    const constellation = new THREE.Group();
    constellation.position.set(-0.3, 0.5 + 1.5 + level * 0.1 + 1.9, 0);
    const starMat = m.glowBlue;
    const nodes: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), starMat);
      const a = (i / 7) * Math.PI * 2;
      node.position.set(Math.cos(a) * 1.5, Math.sin(a * 2.2) * 0.34, Math.sin(a) * 1.5);
      nodes.push(node);
      constellation.add(node);
    }
    g.add(constellation);
    const halo = new THREE.PointLight(0x9fd0ff, 0.9, 14);
    halo.position.copy(constellation.position);
    g.add(halo);
    ticks.push((t, dt) => {
      constellation.rotation.y += dt * 0.3;
      nodes.forEach((node, i) => {
        node.scale.setScalar(0.8 + Math.abs(Math.sin(t * 1.6 + i)) * 0.5);
      });
    });
  }
  castAll(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* Center lighthouse                                                   */
/* ------------------------------------------------------------------ */

export function buildLighthouse(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  /* Quảng trường tròn nhiều bậc, có lan can và nan hoa lát đá — ảnh tham chiếu
     dựng hải đăng giữa một sân hình tròn chứ không phải trên một cái đế lục giác. */
  const apron = cyl(9.4, 9.8, 0.3, 48, m.stoneDark);
  apron.position.y = 0.08;
  apron.receiveShadow = true;
  g.add(apron);
  const terrace = cyl(7.2, 7.6, 0.34, 48, m.stone);
  terrace.position.y = 0.32;
  terrace.receiveShadow = true;
  g.add(terrace);
  const plaza = cyl(5.6, 6.0, 0.36, 48, m.stoneDark);
  plaza.position.y = 0.5;
  plaza.receiveShadow = true;
  g.add(plaza);
  const inner = cyl(3.4, 3.7, 0.24, 48, m.stone);
  inner.position.y = 0.72;
  inner.receiveShadow = true;
  g.add(inner);

  /* nan hoa lát đá sáng màu toả ra tám hướng */
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spoke = box(0.9, 0.05, 3.6, m.white);
    spoke.position.set(Math.cos(angle) * 7.6, 0.5, Math.sin(angle) * 7.6);
    spoke.rotation.y = -angle;
    spoke.receiveShadow = true;
    g.add(spoke);
  }
  /* lan can quanh bậc ngoài, cứ vài trụ lại có một chậu lửa */
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const post = cyl(0.09, 0.12, 0.62, 6, m.white);
    post.position.set(Math.cos(angle) * 9.1, 0.5, Math.sin(angle) * 9.1);
    post.castShadow = true;
    g.add(post);
    if (i % 6 === 0) {
      const bowl = cyl(0.26, 0.14, 0.24, 10, m.gold);
      bowl.position.set(Math.cos(angle) * 9.1, 0.92, Math.sin(angle) * 9.1);
      g.add(bowl);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m.glowWarm);
      ember.position.set(Math.cos(angle) * 9.1, 1.06, Math.sin(angle) * 9.1);
      g.add(ember);
    }
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(9.1, 0.05, 6, 72), m.white);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 0.82;
  g.add(rail);

  const segs: [number, number, number, THREE.Material][] = [
    [1.5, 1.25, 2.2, m.white],
    [1.25, 1.05, 2.0, m.roofTeal],
    [1.05, 0.85, 2.0, m.white],
  ];
  let y = 0.6;
  for (const [rt, rb, h, mat] of segs) {
    const s = cyl(rt, rb, h, 8, mat);
    s.position.y = y + h / 2;
    g.add(s);
    y += h;
  }
  const gallery = cyl(1.3, 1.3, 0.3, 8, m.stoneDark);
  gallery.position.y = y + 0.15;
  g.add(gallery);
  const lamp = box(1.05, 1.0, 1.05, m.glowWarm);
  lamp.position.y = y + 0.8;
  g.add(lamp);
  const lampRoof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.9, 6), m.roofTeal);
  lampRoof.position.y = y + 1.75;
  g.add(lampRoof);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m.goldBright);
  finial.position.y = y + 2.35;
  g.add(finial);

  const lampLight = new THREE.PointLight(0xffd88a, 1.4, 34);
  lampLight.position.y = y + 0.9;
  g.add(lampLight);

  // rotating beam
  const beamGroup = new THREE.Group();
  beamGroup.position.y = y + 0.8;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd88a,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 2; i++) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 17, 10, 1, true), beamMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.x = 8.5;
    const holder = new THREE.Group();
    holder.rotation.y = i * Math.PI;
    holder.add(beam);
    beamGroup.add(holder);
  }
  g.add(beamGroup);
  ticks.push((t, dt) => {
    beamGroup.rotation.y += dt * 0.55;
    lampLight.intensity = 1.3 + Math.sin(t * 2.2) * 0.25;
  });

  castAll(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* Terrain, paths, nature, sky, water                                  */
/* ------------------------------------------------------------------ */

function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax, abz = bz - az;
  const apx = px - ax, apz = pz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? (apx * abx + apz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

/* Bãi cát bắt đầu sớm hơn và trải rộng gấp đôi so với bản trước. */
const BEACH_START = 17.0;
const SHORE_EDGE = ISLAND_RADIUS - 0.5;
const TERRAIN_ANCHORS = [DISTRICT_POS.crypto, DISTRICT_POS.stocks, DISTRICT_POS.vault, DISTRICT_POS.academy];

/**
 * Hệ số "đất được phép gợn" tại một điểm trên cao nguyên: 0 ở quảng trường hải
 * đăng, ở bốn bệ công trình và dọc các lối đi lát đá; 1 ở nơi cỏ mọc tự do.
 *
 * Nó vốn nằm lọt trong vòng lặp dựng địa hình. Tách ra vì lớp cây cỏ instancing
 * cần đúng con số này để không gieo một bụi cỏ nào lên giữa lối đi.
 */
export function terrainFlatness(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);
  /* Quảng trường hải đăng rộng 9,8 nên vùng phẳng phải trùm hết chỗ đó, nếu
     không những gợn đất sẽ chọc lên xuyên qua mặt sân. */
  let flat = THREE.MathUtils.smoothstep(r, 8.5, 12.5);
  for (const a of TERRAIN_ANCHORS) {
    const d = Math.sqrt((x - a.x) ** 2 + (z - a.z) ** 2);
    flat *= THREE.MathUtils.smoothstep(d, 3.6, 6.4);
    const pd = segDist2(x, z, 0, 0, a.x, a.z);
    flat *= THREE.MathUtils.smoothstep(pd, 1.1, 2.4);
  }
  return flat;
}

/**
 * Cao độ mặt đảo tại `(x, z)` trong toạ độ thế giới — 0 là mặt cao nguyên.
 *
 * Cùng một công thức với đỉnh khối trụ trong `buildTerrain`, đã trừ sẵn
 * `mesh.position.y = -3`, nên cây trồng theo hàm này luôn đứng đúng trên cỏ.
 */
export function terrainHeightAt(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);
  const n =
    Math.sin(x * 0.28) * Math.cos(z * 0.31) * 0.5 +
    Math.sin(x * 0.11 + 2.1) * Math.sin(z * 0.13 + 1.3) * 0.7 +
    Math.cos(x * 0.45 - z * 0.37) * 0.25;
  const shoreFall = THREE.MathUtils.smoothstep(r, BEACH_START, SHORE_EDGE);
  return n * 0.4 * terrainFlatness(x, z) - shoreFall * 2.35;
}

export interface TerrainPalette {
  /** sắc cỏ chính theo mùa */
  foliage: number;
  /** sắc cỏ phụ, dùng để tạo vân */
  foliageAlt: number;
  /** phủ tuyết 0..1 — chỉ mùa đông mới khác 0 */
  snow?: number;
}

/**
 * Đảo chính. Bãi cát được mở rộng hẳn ra (từ r≈17 thay vì r≈21,5) và bờ hạ
 * thoải xuống mặt nước để rìa đảo là một đường cong mềm, không phải vách cắt.
 */
export function buildTerrain(palette: TerrainPalette): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 7, 6, 84, 5);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const grassA = new THREE.Color(palette.foliage);
  const grassB = new THREE.Color(palette.foliageAlt);
  /* Cát sáng hơn hẳn bản trước: dưới ACES tone mapping, 0xd8c391 ra màu bùn chứ
     không ra bãi biển. */
  const sandDry = new THREE.Color(0xefdcae);
  const sandWet = new THREE.Color(0xd2bd8c);
  const snowCap = new THREE.Color(0xeaf2f5);
  const cliffTop = new THREE.Color(0x4d6063);
  const cliffBot = new THREE.Color(0x2c3f43);
  const snowAmount = palette.snow ?? 0;
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y0 = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.sqrt(x * x + z * z);

    if (y0 > 2.9) {
      const n =
        Math.sin(x * 0.28) * Math.cos(z * 0.31) * 0.5 +
        Math.sin(x * 0.11 + 2.1) * Math.sin(z * 0.13 + 1.3) * 0.7 +
        Math.cos(x * 0.45 - z * 0.37) * 0.25;
      /* Vùng ngoài BEACH_START hạ dần xuống sát mực nước, tạo bãi thoải. */
      const shoreFall = THREE.MathUtils.smoothstep(r, BEACH_START, SHORE_EDGE);
      pos.setY(i, 3 + terrainHeightAt(x, z));
      /* Cát nở ra phía ngoài để mép đảo tròn đều, mềm mắt hơn. */
      if (shoreFall > 0) {
        const widen = 1 + shoreFall * 0.055;
        pos.setX(i, x * widen);
        pos.setZ(i, z * widen);
      }

      const mix = n * 0.5 + 0.5;
      c.copy(grassA).lerp(grassB, mix);
      const beach = THREE.MathUtils.smoothstep(r, BEACH_START, BEACH_START + 5.2);
      if (beach > 0) {
        c.lerp(sandDry, beach * 0.94);
        const wet = THREE.MathUtils.smoothstep(r, SHORE_EDGE - 2.6, SHORE_EDGE + 0.6);
        c.lerp(sandWet, wet * 0.6);
      }
      if (snowAmount > 0) c.lerp(snowCap, snowAmount * (1 - beach) * (0.35 + mix * 0.4));
      colors.push(c.r, c.g, c.b);
    } else {
      const n = Math.sin(x * 0.5 + z * 0.3) * Math.cos(z * 0.42 - x * 0.2);
      const bulge = 1 + n * 0.06 + (y0 < -2.9 ? -0.12 : 0);
      pos.setX(i, x * bulge);
      pos.setZ(i, z * bulge);
      const f = THREE.MathUtils.clamp((y0 + 3) / 6, 0, 1);
      c.copy(cliffBot).lerp(cliffTop, f);
      colors.push(c.r, c.g, c.b);
    }
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  /* Bỏ `flatShading`: mặt cắt phẳng lì của mỗi tam giác chính là thứ khiến hòn
     đảo trông như gấp bằng giấy. Chi tiết bề mặt chuyển sang cho bản đồ pháp
     tuyến lo — cùng số tam giác nhưng ánh sáng có hạt, có gợn. */
  /* Số lần lặp phải tính theo kích thước thật: mặt trên của hòn đảo trải 52 đơn
     vị mà UV chỉ chạy 0..1, nên lặp 26 lần cho ra gợn cát rộng gần một mét —
     nhìn thành sóng bê tông trên quảng trường chứ không thành hạt cát. Lặp 64
     lần đưa mỗi gợn về khoảng hai gang tay, đúng tầm mắt đọc ra là mặt đất. */
  const grain = surface("sand", 64);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    normalMap: grain.normalMap,
    roughnessMap: grain.roughnessMap,
  });
  material.normalScale.set(0.4, 0.4);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -3;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildPaths(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const anchors = [DISTRICT_POS.crypto, DISTRICT_POS.stocks, DISTRICT_POS.vault, DISTRICT_POS.academy];
  for (const a of anchors) {
    const len = Math.sqrt(a.x * a.x + a.z * a.z);
    const path = box(1.0, 0.14, len - 4.2, m.stoneDark);
    path.position.set(a.x / 2, 0.09, a.z / 2);
    path.rotation.y = Math.atan2(a.x, a.z);
    path.receiveShadow = true;
    g.add(path);
    // lanterns near pad
    for (const side of [-1, 1]) {
      const px = a.x * 0.45 + (-a.z / len) * 1.5 * side;
      const pz = a.z * 0.45 + (a.x / len) * 1.5 * side;
      const post = box(0.14, 0.9, 0.14, m.wood);
      post.position.set(px, 0.45, pz);
      g.add(post);
      const head = box(0.24, 0.24, 0.24, m.glowWarm);
      head.position.set(px, 1.0, pz);
      g.add(head);
    }
  }
  return g;
}

export function buildGate(m: Mats): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 0, ISLAND_RADIUS - 5.5);
  for (const x of [-1.7, 1.7]) {
    const col = box(0.55, 3.0, 0.55, m.stone);
    col.position.set(x, 1.5, 0);
    g.add(col);
    const cap = box(0.8, 0.22, 0.8, m.gold);
    cap.position.set(x, 3.1, 0);
    g.add(cap);
  }
  const beam = box(4.8, 0.42, 0.6, m.gold);
  beam.position.set(0, 3.5, 0);
  g.add(beam);
  const beam2 = box(3.9, 0.24, 0.45, m.wood);
  beam2.position.set(0, 2.85, 0);
  g.add(beam2);
  // dock over water
  for (let i = 0; i < 4; i++) {
    const plank = box(2.4, 0.16, 1.5, m.wood);
    plank.position.set(0, -0.55 + i * 0.02, 2.2 + i * 1.6);
    g.add(plank);
  }
  for (const x of [-1.0, 1.0]) {
    const piling = cyl(0.1, 0.12, 2.2, 6, m.wood);
    piling.position.set(x, -0.9, 6.8);
    g.add(piling);
  }
  castAll(g);
  return g;
}

/**
 * Cây thông.
 *
 * Bản trước là một thân trụ và đúng hai hình nón chồng lên nhau, nên mười lăm
 * cây trên đảo là mười lăm bản sao khít nhau tới từng độ — mắt bắt được sự lặp
 * đó ngay và đọc cả rừng thành hoạ tiết dán. Bản này rút ngẫu nhiên từ chính
 * toạ độ của cây (nên vẫn tất định giữa các lần dựng): số tầng tán, độ nghiêng
 * thân, độ xoay và độ co của từng tầng đều lệch nhau một chút.
 */
export function makeTree(m: Mats, s: number, leaves: THREE.Material, seed = Math.random()): THREE.Group {
  const g = new THREE.Group();
  const rnd = (n: number) => {
    const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  /* Gốc loe ra: thân cây thật không cắm xuống đất như cái cọc. */
  const flare = cyl(0.13 * s, 0.22 * s, 0.18 * s, 8, m.wood);
  flare.position.y = 0.09 * s;
  g.add(flare);
  const trunk = cyl(0.075 * s, 0.14 * s, 0.85 * s, 8, m.wood);
  trunk.position.y = 0.5 * s;
  trunk.rotation.z = (rnd(1) - 0.5) * 0.07;
  g.add(trunk);

  const tiers = 3 + Math.floor(rnd(2) * 2);
  let y = 0.86 * s;
  let radius = (0.7 + rnd(3) * 0.14) * s;
  let height = (1.05 + rnd(4) * 0.2) * s;
  for (let i = 0; i < tiers; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8, 1), leaves);
    cone.position.set((rnd(i * 3 + 5) - 0.5) * 0.06 * s, y + height * 0.42, (rnd(i * 3 + 6) - 0.5) * 0.06 * s);
    cone.rotation.y = rnd(i * 3 + 7) * Math.PI;
    /* Tán hơi bẹt dần lên đỉnh — dáng thông thật, không phải chồng nón đều. */
    cone.scale.y = 0.94 + rnd(i * 3 + 8) * 0.16;
    g.add(cone);
    y += height * 0.55;
    radius *= 0.72;
    height *= 0.82;
  }
  const tree = mergeByMaterial(g);
  castAll(tree);
  return tree;
}

/**
 * Tảng đá.
 *
 * Khối mười hai mặt đều là hình học sách giáo khoa: mọi mặt bằng nhau, mọi
 * cạnh bằng nhau, không tảng đá nào trong tự nhiên như thế. Đẩy từng đỉnh ra
 * vào theo nhiễu rồi nén trục đứng sẽ ra khối sứt sẹo có mặt phẳng, có góc
 * nhọn, có chỗ lõm — cùng số tam giác.
 */
export function makeRock(m: Mats, s: number, seed = Math.random()): THREE.Mesh {
  const geometry = new THREE.DodecahedronGeometry(Math.max(0.2, 0.55 * s), 1);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n =
      Math.sin(v.x * 5.1 + seed * 12.3) * Math.cos(v.z * 4.4 - seed * 7.1) * 0.5 +
      Math.sin(v.y * 7.7 - seed * 3.3) * 0.5;
    v.multiplyScalar(1 + n * 0.22);
    position.setXYZ(i, v.x, v.y * 0.72, v.z);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, m.rock);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeDust(): { points: THREE.Points; tick: TickFn } {
  const COUNT = 150;
  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 26;
    base[i * 3] = Math.cos(a) * r;
    base[i * 3 + 1] = 0.4 + Math.random() * 12;
    base[i * 3 + 2] = Math.sin(a) * r;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffd88a,
    size: 0.16,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  const tick: TickFn = (t) => {
    const attr = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      attr.setY(i, base[i * 3 + 1] + Math.sin(t * 0.5 + phase[i]) * 0.8);
      attr.setX(i, base[i * 3] + Math.sin(t * 0.24 + phase[i] * 2.0) * 0.6);
    }
    attr.needsUpdate = true;
  };
  return { points, tick };
}

/* ------------------------------------------------------------------ */
/* Burst pool (celebration particles)                                  */
/* ------------------------------------------------------------------ */

interface BurstItem {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export function makeBurstPool(scene: THREE.Scene) {
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const jadeMat = new THREE.MeshBasicMaterial({ color: 0x7fe8bb, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const items: BurstItem[] = [];
  for (let i = 0; i < 56; i++) {
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), i % 2 ? goldMat : jadeMat);
    mesh.visible = false;
    scene.add(mesh);
    items.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
  }
  let cursor = 0;
  return {
    fire(origin: THREE.Vector3, kind: "gold" | "jade") {
      for (let n = 0; n < 26; n++) {
        const it = items[cursor];
        cursor = (cursor + 1) % items.length;
        it.mesh.visible = true;
        it.mesh.material = kind === "gold" ? goldMat : jadeMat;
        it.mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6));
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 4;
        it.vel.set(Math.cos(a) * sp, 3.5 + Math.random() * 4.5, Math.sin(a) * sp);
        it.life = it.maxLife = 0.9 + Math.random() * 0.6;
        it.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      }
    },
    tick(_: number, dt: number) {
      for (const it of items) {
        if (it.life <= 0) continue;
        it.life -= dt;
        if (it.life <= 0) {
          it.mesh.visible = false;
          continue;
        }
        it.vel.y -= 8.5 * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
        it.mesh.rotation.x += dt * 5;
        it.mesh.rotation.z += dt * 4;
        const k = Math.max(0.01, it.life / it.maxLife);
        it.mesh.scale.setScalar(k);
        (it.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Genesis Isle — private crypto island (unlocked at level 8)          */
/* ------------------------------------------------------------------ */

export type IslandKind = "crypto" | "stocks" | "vault" | "academy";
export type IslandTheme = "emerald" | "sunset" | "lagoon" | "violet";
export const ISLE_POSITIONS: Record<IslandKind, THREE.Vector3> = {
  crypto: new THREE.Vector3(43, 0, -10),
  stocks: new THREE.Vector3(-43, 0, -10),
  vault: new THREE.Vector3(-37, 0, 35),
  academy: new THREE.Vector3(37, 0, 35),
};
/** Backwards-compatible alias for the original Genesis isle. */
export const ISLE_POS = ISLE_POSITIONS.crypto;
export const ISLE_RADIUS = 7.5;
export { DECOR_IDS };
export type { DecorId };

const ISLE_PALETTES: Record<IslandTheme, { rock: number; top: number; rim: number; pad: number; glow: number }> = {
  emerald: { rock: 0x244c47, top: 0x216b59, rim: 0xb28a54, pad: 0x314a4a, glow: 0x5ce8c4 },
  sunset: { rock: 0x4a3540, top: 0x8a4c48, rim: 0xe0aa50, pad: 0x4b3b42, glow: 0xffb36b },
  lagoon: { rock: 0x23445a, top: 0x28758a, rim: 0xd3bc7d, pad: 0x304f5d, glow: 0x7bdcf5 },
  violet: { rock: 0x393452, top: 0x65568d, rim: 0xc6a8ff, pad: 0x403c5c, glow: 0xb79cff },
};

/** Sắc nền mua ở Chợ, ghi đè bảng màu chủ đề của hòn đảo. */
export interface IslePaletteOverride {
  top: number;
  rim: number;
  rock: number;
  glow: number;
}

function paletteFor(theme: IslandTheme, override?: IslePaletteOverride | null) {
  const base = ISLE_PALETTES[theme];
  if (!override) return base;
  return { ...base, top: override.top, rim: override.rim, rock: override.rock, glow: override.glow };
}

function isleTerrain(theme: IslandTheme, override?: IslePaletteOverride | null): THREE.Group {
  const g = new THREE.Group();
  const palette = paletteFor(theme, override);
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLE_RADIUS, ISLE_RADIUS - 2.2, 4.6, 48, 3),
    new THREE.MeshStandardMaterial({ color: palette.rock, roughness: 0.94, metalness: 0.03 })
  );
  const pos = rock.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 2) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, y + (Math.sin(x * 0.7) * Math.cos(z * 0.6) + Math.sin(x * 0.23 + z * 0.31)) * 0.22);
    }
  }
  rock.geometry.computeVertexNormals();
  rock.position.y = -2.3;
  rock.receiveShadow = true;
  g.add(rock);
  const top = cyl(ISLE_RADIUS - 0.25, ISLE_RADIUS, 0.4, 48, new THREE.MeshStandardMaterial({ color: palette.top, roughness: 0.9 }));
  top.position.y = 0;
  top.receiveShadow = true;
  g.add(top);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ISLE_RADIUS - 0.4, 0.22, 8, 56),
    new THREE.MeshStandardMaterial({ color: palette.rim, roughness: 0.78 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.05;
  g.add(rim);
  const pad = cyl(2.6, 2.9, 0.3, 12, new THREE.MeshStandardMaterial({ color: palette.pad, roughness: 0.82, metalness: 0.12 }));
  pad.position.y = 0.3;
  pad.receiveShadow = true;
  g.add(pad);
  return g;
}

function miningRig(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const body = box(1.7, 1.1, 1.1, m.stoneDark);
  body.position.y = 0.75;
  g.add(body);
  /* Vật liệu riêng cho khe thoát nhiệt: nhấp nháy trên bản sao, không đụng vào
     `m.glowCyan` dùng chung — nếu không, mọi vật phát sáng lam trong cảnh sẽ
     cùng nhịp thở với giàn đào. */
  const ventMaterial = m.glowCyan.clone();
  const vent = box(1.72, 0.12, 1.12, ventMaterial);
  vent.position.y = 1.15;
  g.add(vent);
  const fans: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 14), m.stone);
    fan.position.set(-0.42 + i * 0.84, 0.75, 0.58);
    g.add(fan);
    const blade = box(0.5, 0.06, 0.02, m.glowCyan);
    blade.position.copy(fan.position);
    blade.position.z += 0.02;
    g.add(blade);
    fans.push(blade);
  }
  const stack = cyl(0.12, 0.16, 0.7, 6, m.stoneDark);
  stack.position.set(0.6, 1.65, -0.3);
  g.add(stack);
  ticks.push((t, dt) => {
    for (const f of fans) f.rotation.z += dt * 9;
    ventMaterial.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5;
  });
  castAll(g);
  return g;
}

function obelisk(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const ped = box(1.5, 0.4, 1.5, m.stoneDark);
  ped.position.y = 0.2;
  g.add(ped);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 3.4, 4), m.stone);
  shaft.position.y = 2.1;
  shaft.rotation.y = Math.PI / 4;
  g.add(shaft);
  const runes = box(0.5, 2.2, 0.05, m.glowCyan);
  runes.position.set(0, 2.0, 0.36);
  runes.rotation.y = Math.PI / 4;
  runes.position.set(Math.sin(Math.PI / 4) * 0.38, 2.0, Math.cos(Math.PI / 4) * 0.38);
  g.add(runes);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), m.glowCyan);
  tip.position.y = 4.1;
  g.add(tip);
  const light = new THREE.PointLight(0x5ce8c4, 0.8, 12);
  light.position.y = 4.1;
  g.add(light);
  ticks.push((t) => {
    tip.rotation.y = t * 1.2;
    tip.position.y = 4.1 + Math.sin(t * 1.8) * 0.15;
  });
  castAll(g);
  return g;
}

function whaleStatue(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const ped = cyl(1.4, 1.6, 0.5, 8, m.stoneDark);
  ped.position.y = 0.25;
  g.add(ped);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), m.gold);
  body.scale.set(1.5, 0.85, 0.85);
  body.position.y = 1.35;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), m.gold);
  head.position.set(1.25, 1.55, 0);
  g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4), m.gold);
  tail.position.set(-1.55, 1.75, 0);
  tail.rotation.z = Math.PI / 2.6;
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), m.goldBright);
  fin.position.set(0, 2.15, 0);
  g.add(fin);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), m.stoneDark);
  eye.position.set(1.55, 1.75, 0.45);
  g.add(eye);
  // spout droplets
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), m.glowCyan);
    d.visible = false;
    g.add(d);
    drops.push(d);
  }
  ticks.push((t) => {
    const cyc = (t % 4) / 4;
    drops.forEach((d, i) => {
      const k = cyc - i * 0.05;
      if (k < 0 || k > 0.45) {
        d.visible = false;
        return;
      }
      d.visible = true;
      d.position.set(1.45 + Math.sin(i * 2.4) * 0.18, 2.2 + k * 5.2 - k * k * 9, Math.cos(i * 1.9) * 0.18);
    });
  });
  castAll(g);
  return g;
}

function exchangeMonolith(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const ped = box(1.8, 0.4, 1.8, m.stoneDark);
  ped.position.y = 0.2;
  g.add(ped);
  const mono = box(1.1, 3.8, 1.1, m.stone);
  mono.position.y = 2.3;
  g.add(mono);
  const screen = box(0.9, 2.6, 0.06, m.glowCyan);
  screen.position.set(0, 2.4, 0.58);
  g.add(screen);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const coin = cyl(0.26, 0.26, 0.07, 14, m.goldBright);
    coin.rotation.z = Math.PI / 2;
    g.add(coin);
    rings.push(coin);
  }
  ticks.push((t) => {
    rings.forEach((c, i) => {
      const a = t * 1.1 + (i / 3) * Math.PI * 2;
      c.position.set(Math.cos(a) * 1.3, 2.6 + Math.sin(t * 1.4 + i) * 0.3, Math.sin(a) * 1.3);
    });
  });
  castAll(g);
  return g;
}

function rocket(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const pad = cyl(1.3, 1.5, 0.25, 10, m.stoneDark);
  pad.position.y = 0.12;
  g.add(pad);
  const hull = cyl(0.42, 0.5, 2.4, 8, m.white);
  hull.position.y = 1.5;
  g.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 8), m.glowWarm);
  nose.position.y = 3.15;
  g.add(nose);
  for (let i = 0; i < 3; i++) {
    const finBox = box(0.5, 0.7, 0.06, m.gold);
    const a = (i / 3) * Math.PI * 2;
    finBox.position.set(Math.cos(a) * 0.5, 0.65, Math.sin(a) * 0.5);
    finBox.rotation.y = -a;
    g.add(finBox);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc069, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  flame.rotation.x = Math.PI;
  flame.position.y = -0.05;
  g.add(flame);
  const light = new THREE.PointLight(0xffa04d, 1.1, 10);
  light.position.y = 0.3;
  g.add(light);
  ticks.push((t) => {
    const s = 0.75 + Math.abs(Math.sin(t * 21)) * 0.5;
    flame.scale.set(1, s, 1);
    light.intensity = 0.8 + Math.abs(Math.sin(t * 17)) * 0.7;
  });
  castAll(g);
  return g;
}

function holoChart(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const holoMat = new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const bars: THREE.Mesh[] = [];
  const hs = [0.7, 1.15, 0.9, 1.5, 1.25, 1.8];
  hs.forEach((h, i) => {
    const geo = new THREE.BoxGeometry(0.3, h, 0.3);
    geo.translate(0, h / 2, 0);
    const b = new THREE.Mesh(geo, holoMat);
    b.position.set(-1.25 + i * 0.5, 0, 0);
    bars.push(b);
    g.add(b);
  });
  ticks.push((t) => {
    bars.forEach((b, i) => {
      b.scale.y = 0.7 + Math.abs(Math.sin(t * 0.9 + i * 1.1)) * 0.8;
    });
    g.rotation.y = Math.sin(t * 0.3) * 0.25;
  });
  return g;
}

/** A district-specific private isle that gains landmarks at higher levels. */
export function buildIsle(
  m: Mats,
  level: number,
  ticks: TickFn[],
  district: IslandKind = "crypto",
  theme: IslandTheme = "emerald",
  ground?: IslePaletteOverride | null
): THREE.Group {
  const g = isleTerrain(theme, ground);
  const first = district === "stocks" ? exchangeMonolith(m, ticks) : district === "vault" ? whaleStatue(m, ticks) : district === "academy" ? obelisk(m, ticks) : miningRig(m, ticks);
  first.position.set(-2.4, 0.4, -1.6);
  first.rotation.y = 0.5;
  g.add(first);
  const second = district === "stocks" ? holoChart(m, ticks) : district === "vault" ? obelisk(m, ticks) : district === "academy" ? rocket(m, ticks) : obelisk(m, ticks);
  second.position.set(2.1, district === "stocks" ? 1.0 : 0.4, -2.1);
  g.add(second);
  const unlockBase = district === "crypto" ? 8 : district === "stocks" ? 7 : district === "vault" ? 6 : 5;
  if (level >= unlockBase + 1) {
    const third = district === "vault" ? miningRig(m, ticks) : whaleStatue(m, ticks);
    third.position.set(2.6, 0.4, 2.3);
    third.rotation.y = -2.2;
    g.add(third);
    const mono = exchangeMonolith(m, ticks);
    mono.position.set(-2.6, 0.4, 1.9);
    mono.rotation.y = 2.6;
    g.add(mono);
  }
  if (level >= unlockBase + 2) {
    const rk = rocket(m, ticks);
    rk.position.set(0.4, 0.4, -3.4);
    g.add(rk);
    const holo = holoChart(m, ticks);
    holo.position.set(0, 1.1, 0);
    g.add(holo);
  }
  const palette = paletteFor(theme, ground);
  const beamMat = new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.4, 16, 10, 1, true), beamMat);
  beam.position.y = 8.4;
  g.add(beam);
  return g;
}

/** Hologram khi đảo chưa mở khóa */
export function buildIsleGhost(theme: IslandTheme = "emerald"): { group: THREE.Group; tick: TickFn } {
  const g = new THREE.Group();
  const glow = ISLE_PALETTES[theme].glow;
  const ghostMat = new THREE.MeshBasicMaterial({ color: glow, wireframe: true, transparent: true, opacity: 0.11, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(ISLE_RADIUS, ISLE_RADIUS - 2.2, 4.6, 20, 2), ghostMat);
  cone.position.y = -2.3;
  g.add(cone);
  const ringMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ISLE_RADIUS + 0.8, 0.08, 6, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  g.add(ring);
  const lock = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  lock.position.y = 2.4;
  g.add(lock);
  const tick: TickFn = (t) => {
    ring.rotation.z = t * 0.4;
    ring.scale.setScalar(1 + Math.sin(t * 1.4) * 0.04);
    lock.rotation.y = t * 0.8;
    lock.position.y = 2.4 + Math.sin(t * 1.2) * 0.35;
    (lock.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 2) * 0.15;
  };
  return { group: g, tick };
}

/* --------------------------- isle decor ---------------------------- */

/**
 * Tàu lá dừa.
 *
 * Bản trước dùng hình nón bốn cạnh, tức là một cái gai nhọn chĩa ra — nhìn xa
 * thì tạm, nhìn gần thì đó chính là chỗ lộ ra rằng cảnh vật được ghép từ hình
 * hộp và hình nón. Tàu lá thật thì bản rộng ở gần cuống, thon dần ra ngọn, và
 * quan trọng nhất là **rủ xuống** theo trọng lực chứ không thẳng đơ.
 *
 * Dựng bằng một dải lưới cong theo hàm bậc hai: rẻ (mười mấy tam giác), nhưng
 * bóng đổ và đường viền của nó đọc ra ngay là lá cây.
 */
function frondGeometry(length: number, width: number, droop: number): THREE.BufferGeometry {
  const SEGMENTS = 7;
  const geometry = new THREE.PlaneGeometry(width, length, 1, SEGMENTS);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    /* k = 0 ở cuống, 1 ở chóp lá. Phải kẹp lại: hàng đỉnh dưới cùng thỉnh
       thoảng ra -1e-9 vì sai số dấu phẩy động, mà Math.pow(âm, số lẻ) trả NaN
       — chỉ một đỉnh hỏng là cả tàu lá biến mất khỏi khung hình. */
    const k = THREE.MathUtils.clamp((y + length / 2) / length, 0, 1);
    /* Bản lá phình ở khoảng một phần ba đầu rồi thon lại thành mũi nhọn. */
    const taper = Math.sin(Math.pow(k, 0.55) * Math.PI) * (1 - k * 0.25) + 0.08;
    position.setX(i, x * taper);
    /* Rủ xuống nhanh dần: gần cuống còn cứng, ra ngọn thì oằn hẳn. */
    position.setZ(i, -Math.pow(k, 2.1) * droop);
    /* Sống lá gấp thành chữ V nông nên tàu lá không phẳng như tờ giấy. */
    position.setY(i, y + Math.abs(x) * taper * 0.18);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* Vật liệu của cây dừa dùng chung cho mọi cây: có hai chục cây trên bờ, mỗi
   cây một bản vật liệu riêng là hai chục lần nạp uniform vô ích. Cờ `shared`
   để `disposeGroup` không xoá mất vật liệu mà những cây khác đang dùng. */
let palmMaterials: { frond: THREE.MeshStandardMaterial; nut: THREE.MeshStandardMaterial } | null = null;
function palmMats() {
  if (palmMaterials) return palmMaterials;
  const frond = new THREE.MeshStandardMaterial({
    color: 0x3f9c70,
    roughness: 0.86,
    side: THREE.DoubleSide,
    ...surface("foliage", 1),
  });
  frond.normalScale.set(0.5, 0.5);
  frond.userData.shared = true;
  const nut = new THREE.MeshStandardMaterial({ color: 0x6f5a2e, roughness: 0.8 });
  nut.userData.shared = true;
  palmMaterials = { frond, nut };
  return palmMaterials;
}

export function makePalm(m: Mats, seed = Math.random()): THREE.Group {
  const g = new THREE.Group();
  const rnd = (n: number) => {
    const v = Math.sin(seed * 91.7 + n * 217.3) * 43758.5453;
    return v - Math.floor(v);
  };

  /* Thân cong: xếp chồng các đốt ngắn theo một cung tròn, mỗi đốt thon dần.
     Cây dừa thật không bao giờ mọc thẳng đứng — nó nghiêng ra phía biển. */
  const SEGMENTS = 7;
  const lean = 0.14 + rnd(1) * 0.12;
  const totalHeight = 1.85 + rnd(2) * 0.45;
  const sway = rnd(3) * Math.PI * 2;
  const top = new THREE.Vector3();
  for (let i = 0; i < SEGMENTS; i++) {
    const k = i / SEGMENTS;
    const segmentHeight = totalHeight / SEGMENTS;
    const radius = 0.145 - k * 0.075;
    const joint = cyl(radius * 0.92, radius, segmentHeight * 1.12, 8, m.wood);
    /* Độ lệch ngang tăng theo bình phương nên thân cong đều chứ không gãy khúc. */
    const offset = Math.pow(k, 1.7) * lean * totalHeight;
    joint.position.set(Math.cos(sway) * offset, segmentHeight * (i + 0.5), Math.sin(sway) * offset);
    joint.rotation.z = -Math.cos(sway) * k * lean * 1.6;
    joint.rotation.x = Math.sin(sway) * k * lean * 1.6;
    g.add(joint);
    if (i === SEGMENTS - 1) top.set(joint.position.x, segmentHeight * (i + 1), joint.position.z);
  }

  const { frond: frondMat, nut: nutMat } = palmMats();
  const crown = new THREE.Group();
  crown.position.copy(top);
  const FRONDS = 9;
  for (let i = 0; i < FRONDS; i++) {
    const a = (i / FRONDS) * Math.PI * 2 + rnd(i + 10) * 0.22;
    const length = 1.15 + rnd(i + 30) * 0.3;
    const frond = new THREE.Mesh(frondGeometry(length, 0.38, 0.62 + rnd(i + 40) * 0.3), frondMat);
    /* Dựng tàu lá nằm ngang rồi hất lên một góc: vành lá xoè như cái ô. */
    frond.rotation.set(-Math.PI / 2 + (0.34 + rnd(i + 50) * 0.3), 0, 0);
    const arm = new THREE.Group();
    arm.rotation.y = a;
    arm.add(frond);
    frond.position.set(0, length * 0.42, 0.06);
    crown.add(arm);
  }
  g.add(crown);

  /* Buồng dừa nép dưới tán, lệch về một phía cho tự nhiên. */
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), nutMat);
    const a = sway + Math.PI + i * 0.8;
    nut.position.set(top.x + Math.cos(a) * 0.11, top.y - 0.11 - (i % 2) * 0.06, top.z + Math.sin(a) * 0.11);
    nut.scale.y = 1.18;
    g.add(nut);
  }
  const palm = mergeByMaterial(g);
  castAll(palm);
  return palm;
}

export function makeDecor(id: DecorId, m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  if (id === "palms") {
    const spots: [number, number, number][] = [
      [5.6, 2.4, 1.1], [4.8, 4.4, 0.9], [-5.2, 3.2, 1.0], [-4.4, -4.8, 0.85], [5.9, -2.2, 0.95],
    ];
    for (const [x, z, s] of spots) {
      const p = makePalm(m);
      p.position.set(x, 0.35, z);
      p.scale.setScalar(s);
      p.rotation.y = x * z;
      g.add(p);
    }
  } else if (id === "neon") {
    const arch = new THREE.Group();
    for (const x of [-1.5, 1.5]) {
      const col = box(0.22, 2.6, 0.22, m.stoneDark);
      col.position.set(x, 1.65, 0);
      arch.add(col);
    }
    const top = box(3.4, 0.3, 0.26, m.stoneDark);
    top.position.y = 3.05;
    arch.add(top);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const strip1 = box(0.1, 2.4, 0.1, neonMat);
    strip1.position.set(-1.5, 1.65, 0.14);
    arch.add(strip1);
    const strip2 = strip1.clone();
    strip2.position.x = 1.5;
    arch.add(strip2);
    const stripTop = box(3.2, 0.1, 0.1, neonMat);
    stripTop.position.y = 3.05;
    stripTop.position.z = 0.15;
    arch.add(stripTop);
    const coin = cyl(0.5, 0.5, 0.12, 18, m.goldBright);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 2.15;
    arch.add(coin);
    const bSym = box(0.14, 0.7, 0.05, m.stoneDark);
    bSym.position.set(0, 2.15, 0.1);
    arch.add(bSym);
    const light = new THREE.PointLight(0x5ce8c4, 0.9, 10);
    light.position.y = 2.4;
    arch.add(light);
    ticks.push((t) => {
      neonMat.opacity = 0.65 + Math.sin(t * 5) * 0.25;
      coin.rotation.y += 0.02;
    });
    arch.position.set(0, 0.35, 5.6);
    arch.rotation.y = Math.PI;
    g.add(arch);
    castAll(g);
  } else if (id === "flags") {
    const spots: [number, number][] = [[4.2, -4.6], [-4.6, -4.2], [6.2, 0.4]];
    spots.forEach(([x, z], i) => {
      const pole = cyl(0.05, 0.06, 2.6, 6, m.stoneDark);
      pole.position.set(x, 1.65, z);
      g.add(pole);
      const flag = box(0.9, 0.5, 0.03, i % 2 ? m.glowCyan : m.gold);
      flag.position.set(x + 0.5, 2.65, z);
      g.add(flag);
      ticks.push((t) => {
        flag.rotation.y = Math.sin(t * 3 + i) * 0.35;
      });
    });
    castAll(g);
  } else if (id === "dock") {
    const dock = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const plank = box(1.7, 0.12, 1.1, m.wood);
      plank.position.set(0, -0.1 - i * 0.02, i * 1.15);
      dock.add(plank);
    }
    for (const x of [-0.75, 0.75]) {
      const piling = cyl(0.08, 0.1, 1.6, 6, m.wood);
      piling.position.set(x, -0.5, 3.2);
      dock.add(piling);
    }
    const boatHull = box(1.5, 0.35, 0.7, m.white);
    boatHull.position.set(1.7, -0.55, 2.4);
    boatHull.rotation.y = 0.5;
    dock.add(boatHull);
    const mast = cyl(0.04, 0.04, 1.2, 6, m.wood);
    mast.position.set(1.7, 0.15, 2.4);
    dock.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), m.gold);
    sail.scale.z = 0.25;
    sail.position.set(1.7, 0.7, 2.4);
    dock.add(sail);
    dock.position.set(-6.4, 0.25, -2.2);
    dock.rotation.y = -1.9;
    ticks.push((t) => {
      boatHull.position.y = -0.55 + Math.sin(t * 1.3) * 0.06;
      boatHull.rotation.z = Math.sin(t * 1.1) * 0.05;
    });
    g.add(dock);
    castAll(g);
  } else if (id === "torch") {
    const spots: [number, number][] = [[1.9, 4.6], [-1.9, 4.6], [3.4, -5.4], [-3.4, -5.4]];
    spots.forEach(([x, z], i) => {
      const post = cyl(0.09, 0.12, 1.5, 6, m.stoneDark);
      post.position.set(x, 1.1, z);
      g.add(post);
      const bowl = cyl(0.24, 0.12, 0.22, 8, m.gold);
      bowl.position.set(x, 1.92, z);
      g.add(bowl);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      flame.position.set(x, 2.25, z);
      g.add(flame);
      const light = new THREE.PointLight(0x5ce8c4, 0.5, 7);
      light.position.set(x, 2.3, z);
      g.add(light);
      ticks.push((t) => {
        flame.scale.y = 0.8 + Math.abs(Math.sin(t * 11 + i * 2)) * 0.5;
        light.intensity = 0.4 + Math.abs(Math.sin(t * 9 + i)) * 0.3;
      });
    });
    castAll(g);
  }
  return g;
}

/* --------------------------- living world --------------------------- */

export interface Person {
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
}

export function makePerson(shirt: number): Person {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, flatShading: true, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: shirt, flatShading: true, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3a40, flatShading: true, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 7), cloth);
  body.position.y = 0.62;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 7), skin);
  head.position.y = 1.02;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2.4), dark);
  hair.position.y = 1.05;
  g.add(hair);
  const mkLeg = (x: number) => {
    const geo = new THREE.CylinderGeometry(0.06, 0.07, 0.4, 6);
    geo.translate(0, -0.2, 0);
    const leg = new THREE.Mesh(geo, dark);
    leg.position.set(x, 0.4, 0);
    g.add(leg);
    return leg;
  };
  const legL = mkLeg(-0.09);
  const legR = mkLeg(0.09);
  for (const x of [-0.22, 0.22]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.38, 6), cloth);
    arm.position.set(x, 0.66, 0);
    arm.rotation.z = x > 0 ? -0.18 : 0.18;
    g.add(arm);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group: g, legL, legR };
}

export function makeBoat(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const hull = box(2.2, 0.4, 0.9, m.wood);
  hull.position.y = 0.1;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), m.wood);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.y = 0.55;
  bow.position.set(0, 0.1, 1.45);
  g.add(bow);
  const cabin = box(0.9, 0.5, 0.7, m.white);
  cabin.position.set(-0.3, 0.5, 0);
  g.add(cabin);
  const mast = cyl(0.04, 0.04, 1.7, 6, m.wood);
  mast.position.set(0.5, 1.05, 0);
  g.add(mast);
  const sail = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.2, 4), m.gold);
  sail.scale.z = 0.22;
  sail.position.set(0.5, 1.35, 0);
  g.add(sail);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), m.glowWarm);
  lantern.position.set(-0.3, 0.85, 0.4);
  g.add(lantern);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

export interface Bird {
  group: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
}

export function makeBird(): Bird {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1d2f33, flatShading: true, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 5), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const mkWing = (side: number) => {
    const geo = new THREE.BoxGeometry(0.62, 0.02, 0.2);
    geo.translate(0.31 * side, 0, 0);
    const w = new THREE.Mesh(geo, mat);
    g.add(w);
    return w;
  };
  const wingL = mkWing(-1);
  const wingR = mkWing(1);
  return { group: g, wingL, wingR };
}

export function makeLamp(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const post = cyl(0.06, 0.09, 1.5, 6, m.stoneDark);
  post.position.y = 0.75;
  g.add(post);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m.glowWarm);
  head.position.y = 1.62;
  g.add(head);
  const light = new THREE.PointLight(0xffc069, 0.35, 7);
  light.position.y = 1.65;
  g.add(light);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}
