import * as THREE from "three";
import type { Mats, TickFn } from "./build";
import type { ShopItem } from "../lib/shop";

/* ------------------------------------------------------------------ */
/*  Vật phẩm trang trí mua từ Chợ, và khu dân cư cố định của đảo chính  */
/*                                                                     */
/*  Mọi vật liệu ở đây được tạo mới cho từng bản dựng chứ không dùng    */
/*  chung: `disposeGroup` trong WorldScene giải phóng vật liệu không    */
/*  gắn cờ `shared`, nên chia sẻ ở đây sẽ làm hỏng những nhóm khác khi  */
/*  người chơi cất một món đi.                                         */
/* ------------------------------------------------------------------ */

const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)), m);
const cyl = (rt: number, rb: number, h: number, seg: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.01, rt), Math.max(0.01, rb), Math.max(0.01, h), Math.max(3, seg)), m);
const cone = (r: number, h: number, seg: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.01, r), Math.max(0.01, h), Math.max(3, seg)), m);
const ball = (r: number, m: THREE.Material) => new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.02, r), 10, 8), m);

const solid = (color: number, roughness = 0.9, metalness = 0.03) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
const shiny = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.26, metalness: 0.86 });
const glow = (color: number, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
const additive = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

function shadows(group: THREE.Object3D) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Cây cối                                                            */
/* ------------------------------------------------------------------ */

export function propPalm(leafColor: number, trunkColor = 0x6e4b33): THREE.Group {
  const g = new THREE.Group();
  const bark = solid(trunkColor, 0.95);
  const leaf = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.88, flatShading: true, side: THREE.DoubleSide });
  /* Thân cong nhẹ bằng ba đốt xếp lệch — rẻ hơn hẳn một đường cong thật. */
  let y = 0;
  let tilt = 0;
  for (let i = 0; i < 3; i++) {
    const segment = cyl(0.1 - i * 0.02, 0.14 - i * 0.02, 0.62, 6, bark);
    tilt += 0.09;
    segment.position.set(Math.sin(tilt) * (0.16 * i), y + 0.31, 0);
    segment.rotation.z = -tilt;
    g.add(segment);
    y += 0.6;
  }
  const crown = new THREE.Group();
  crown.position.set(Math.sin(tilt) * 0.4, y + 0.05, 0);
  for (let i = 0; i < 7; i++) {
    const frond = cone(0.17, 1.25, 4, leaf);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5);
    frond.rotation.z = Math.cos(a) * 1.2;
    frond.rotation.x = -Math.sin(a) * 1.2;
    crown.add(frond);
  }
  for (let i = 0; i < 3; i++) {
    const nut = ball(0.1, bark);
    const a = (i / 3) * Math.PI * 2;
    nut.position.set(Math.cos(a) * 0.16, -0.05, Math.sin(a) * 0.16);
    crown.add(nut);
  }
  g.add(crown);
  shadows(g);
  return g;
}

function propPine(color: number): THREE.Group {
  const g = new THREE.Group();
  const bark = solid(0x53381f, 0.98);
  const leaf = solid(color, 0.92);
  const trunk = cyl(0.08, 0.13, 0.7, 6, bark);
  trunk.position.y = 0.35;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const tier = cone(0.72 - i * 0.17, 1.1 - i * 0.16, 7, leaf);
    tier.position.y = 0.95 + i * 0.62;
    g.add(tier);
  }
  shadows(g);
  return g;
}

function propBush(color: number, accent?: number): THREE.Group {
  const g = new THREE.Group();
  const leaf = solid(color, 0.95);
  for (let i = 0; i < 3; i++) {
    const lump = ball(0.3 - i * 0.05, leaf);
    lump.position.set((i - 1) * 0.26, 0.24 + (i === 1 ? 0.1 : 0), Math.sin(i * 2.1) * 0.14);
    lump.scale.y = 0.82;
    g.add(lump);
  }
  if (accent !== undefined) {
    const berry = solid(accent, 0.6);
    for (let i = 0; i < 5; i++) {
      const dot = ball(0.06, berry);
      const a = (i / 5) * Math.PI * 2;
      dot.position.set(Math.cos(a) * 0.28, 0.34 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.2);
      g.add(dot);
    }
  }
  shadows(g);
  return g;
}

export function propFlowerbed(color: number): THREE.Group {
  const g = new THREE.Group();
  const soil = solid(0x3a2a1c, 1);
  const stem = solid(0x3f7d4c, 0.95);
  const petal = new THREE.MeshStandardMaterial({ color, roughness: 0.72, emissive: color, emissiveIntensity: 0.16, flatShading: true });
  const bed = cyl(0.72, 0.8, 0.16, 10, soil);
  bed.position.y = 0.08;
  g.add(bed);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.16 + (i % 3) * 0.2;
    const stalk = cyl(0.02, 0.025, 0.34, 4, stem);
    stalk.position.set(Math.cos(a) * r, 0.32, Math.sin(a) * r);
    g.add(stalk);
    const head = ball(0.1, petal);
    head.scale.y = 0.6;
    head.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    g.add(head);
  }
  shadows(g);
  return g;
}

function propBamboo(color: number): THREE.Group {
  const g = new THREE.Group();
  const stalkMat = solid(color, 0.86);
  const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.18 + (i % 2) * 0.12;
    const height = 2.0 + (i % 3) * 0.5;
    const stalk = cyl(0.055, 0.07, height, 6, stalkMat);
    stalk.position.set(Math.cos(a) * r, height / 2, Math.sin(a) * r);
    stalk.rotation.z = Math.cos(a) * 0.07;
    g.add(stalk);
    for (let k = 0; k < 3; k++) {
      const leaf = cone(0.08, 0.5, 3, leafMat);
      leaf.position.set(Math.cos(a) * r + 0.16, height * (0.6 + k * 0.14), Math.sin(a) * r);
      leaf.rotation.z = -1.1 - k * 0.2;
      g.add(leaf);
    }
  }
  shadows(g);
  return g;
}

function propCactus(color: number): THREE.Group {
  const g = new THREE.Group();
  const skin = solid(color, 0.92);
  const body = cyl(0.2, 0.24, 1.35, 8, skin);
  body.position.y = 0.68;
  g.add(body);
  for (const side of [-1, 1]) {
    const arm = cyl(0.11, 0.12, 0.5, 6, skin);
    arm.position.set(side * 0.26, 0.85, 0);
    arm.rotation.z = side * Math.PI / 2;
    g.add(arm);
    const up = cyl(0.11, 0.12, 0.44, 6, skin);
    up.position.set(side * 0.44, 1.08, 0);
    g.add(up);
  }
  shadows(g);
  return g;
}

function propBlossom(color: number): THREE.Group {
  const g = new THREE.Group();
  const bark = solid(0x54402c, 0.96);
  const bloom = new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.14, flatShading: true });
  const trunk = cyl(0.12, 0.2, 1.2, 6, bark);
  trunk.position.y = 0.6;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const branch = cyl(0.05, 0.08, 0.7, 5, bark);
    const a = (i / 3) * Math.PI * 2;
    branch.position.set(Math.cos(a) * 0.28, 1.34, Math.sin(a) * 0.28);
    branch.rotation.z = -Math.cos(a) * 0.7;
    branch.rotation.x = Math.sin(a) * 0.7;
    g.add(branch);
  }
  for (let i = 0; i < 6; i++) {
    const puff = ball(0.42 - (i % 3) * 0.08, bloom);
    const a = (i / 6) * Math.PI * 2;
    puff.position.set(Math.cos(a) * 0.5, 1.75 + Math.sin(a * 1.7) * 0.22, Math.sin(a) * 0.5);
    puff.scale.y = 0.76;
    g.add(puff);
  }
  shadows(g);
  return g;
}

function propVine(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const frame = solid(0x8a6a44, 0.96);
  const leaf = solid(color, 0.9);
  for (const x of [-0.9, 0.9]) {
    const post = box(0.12, 2.1, 0.12, frame);
    post.position.set(x, 1.05, 0);
    g.add(post);
  }
  for (let i = 0; i < 4; i++) {
    const rail = box(2.0, 0.07, 0.07, frame);
    rail.position.set(0, 0.6 + i * 0.48, 0);
    g.add(rail);
  }
  const leaves: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const sprig = ball(0.15, leaf);
    sprig.scale.set(1, 0.6, 0.5);
    sprig.position.set(-0.85 + (1.7 / 13) * i, 0.7 + Math.sin(i * 1.6) * 0.55 + 0.6, 0.05);
    leaves.push(sprig);
    g.add(sprig);
  }
  ticks.push((t) => {
    for (let i = 0; i < leaves.length; i++) leaves[i].rotation.z = Math.sin(t * 1.4 + i) * 0.18;
  });
  shadows(g);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Ánh sáng                                                           */
/* ------------------------------------------------------------------ */

function propLantern(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const wood = solid(0x6e4b33, 0.96);
  const shade = glow(color, 1.9);
  const post = cyl(0.05, 0.07, 1.05, 5, wood);
  post.position.y = 0.52;
  g.add(post);
  const arm = box(0.4, 0.06, 0.06, wood);
  arm.position.set(0.18, 1.06, 0);
  g.add(arm);
  const lamp = box(0.26, 0.34, 0.26, shade);
  lamp.position.set(0.34, 0.86, 0);
  g.add(lamp);
  const cap = cone(0.24, 0.16, 4, wood);
  cap.position.set(0.34, 1.1, 0);
  g.add(cap);
  const light = new THREE.PointLight(color, 0.45, 7);
  light.position.set(0.34, 0.9, 0);
  g.add(light);
  ticks.push((t) => {
    shade.emissiveIntensity = 1.55 + Math.sin(t * 2.1) * 0.35;
    light.intensity = 0.36 + Math.sin(t * 2.1) * 0.14;
  });
  shadows(g);
  return g;
}

function propLamppost(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const iron = solid(0x27343a, 0.6, 0.4);
  const bulb = glow(color, 2.1);
  const base = cyl(0.16, 0.2, 0.2, 8, iron);
  base.position.y = 0.1;
  g.add(base);
  const pole = cyl(0.06, 0.08, 2.0, 8, iron);
  pole.position.y = 1.1;
  g.add(pole);
  const head = ball(0.19, bulb);
  head.position.y = 2.2;
  g.add(head);
  const hood = cone(0.26, 0.22, 8, iron);
  hood.position.y = 2.42;
  g.add(hood);
  const light = new THREE.PointLight(color, 0.55, 9);
  light.position.y = 2.2;
  g.add(light);
  ticks.push((t) => {
    light.intensity = 0.45 + Math.sin(t * 1.4) * 0.12;
  });
  shadows(g);
  return g;
}

function propTorch(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const stone = solid(0x64787a, 0.95);
  const bowlMat = shiny(0xe0aa50);
  const post = cyl(0.1, 0.14, 1.35, 6, stone);
  post.position.y = 0.68;
  g.add(post);
  const bowl = cyl(0.26, 0.13, 0.24, 10, bowlMat);
  bowl.position.y = 1.45;
  g.add(bowl);
  const flameMat = additive(color, 0.9);
  const flame = cone(0.17, 0.55, 6, flameMat);
  flame.position.y = 1.8;
  g.add(flame);
  const light = new THREE.PointLight(color, 0.6, 8);
  light.position.y = 1.85;
  g.add(light);
  ticks.push((t) => {
    flame.scale.set(1, 0.82 + Math.abs(Math.sin(t * 9.5)) * 0.5, 1);
    light.intensity = 0.48 + Math.abs(Math.sin(t * 8.2)) * 0.3;
  });
  shadows(g);
  return g;
}

function propNeonArch(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const frame = solid(0x1b262c, 0.7, 0.3);
  const neonMat = additive(color, 0.9);
  for (const x of [-1.5, 1.5]) {
    const column = box(0.22, 2.7, 0.22, frame);
    column.position.set(x, 1.35, 0);
    g.add(column);
    const strip = box(0.09, 2.5, 0.09, neonMat);
    strip.position.set(x, 1.35, 0.15);
    g.add(strip);
  }
  const lintel = box(3.4, 0.3, 0.26, frame);
  lintel.position.y = 2.85;
  g.add(lintel);
  const lintelStrip = box(3.2, 0.09, 0.09, neonMat);
  lintelStrip.position.set(0, 2.85, 0.16);
  g.add(lintelStrip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 26), neonMat);
  ring.position.set(0, 2.0, 0.1);
  g.add(ring);
  const light = new THREE.PointLight(color, 0.85, 11);
  light.position.y = 2.2;
  g.add(light);
  ticks.push((t) => {
    neonMat.opacity = 0.62 + Math.sin(t * 4.4) * 0.26;
    ring.rotation.z = t * 0.8;
  });
  shadows(g);
  return g;
}

function propGlowstone(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = glow(color, 1.4);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38), stoneMat);
  rock.scale.y = 0.72;
  rock.position.y = 0.24;
  g.add(rock);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 18), additive(color, 0.22));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  g.add(halo);
  const light = new THREE.PointLight(color, 0.35, 6);
  light.position.y = 0.5;
  g.add(light);
  ticks.push((t) => {
    stoneMat.emissiveIntensity = 1.15 + Math.sin(t * 1.7) * 0.5;
  });
  shadows(g);
  return g;
}

function propFirefly(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const COUNT = 40;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    seeds[i * 3] = Math.random() * Math.PI * 2;
    seeds[i * 3 + 1] = 0.6 + Math.random() * 2.4;
    seeds[i * 3 + 2] = 0.6 + Math.random() * 2.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  g.add(points);
  const light = new THREE.PointLight(color, 0.3, 7);
  light.position.y = 1.4;
  g.add(light);
  ticks.push((t) => {
    const attribute = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const a = seeds[i * 3] + t * (0.28 + (i % 5) * 0.05);
      const r = seeds[i * 3 + 2];
      attribute.setXYZ(i, Math.cos(a) * r, seeds[i * 3 + 1] + Math.sin(t * 1.3 + i) * 0.3, Math.sin(a) * r);
    }
    attribute.needsUpdate = true;
    material.opacity = 0.55 + Math.abs(Math.sin(t * 2.3)) * 0.4;
  });
  return g;
}

function propBeacon(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const stone = solid(0x7d8f92, 0.88);
  const base = cyl(0.62, 0.78, 0.4, 10, stone);
  base.position.y = 0.2;
  g.add(base);
  const crystalMat = glow(color, 2.2);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), crystalMat);
  crystal.position.y = 1.5;
  g.add(crystal);
  const shaftMat = additive(color, 0.09);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.1, 16, 12, 1, true), shaftMat);
  shaft.position.y = 9;
  g.add(shaft);
  const light = new THREE.PointLight(color, 1.1, 16);
  light.position.y = 1.6;
  g.add(light);
  ticks.push((t, dt) => {
    crystal.rotation.y += dt * 0.8;
    crystal.position.y = 1.5 + Math.sin(t * 1.4) * 0.16;
    shaftMat.opacity = 0.06 + Math.abs(Math.sin(t * 0.8)) * 0.06;
    light.intensity = 0.9 + Math.sin(t * 2.2) * 0.25;
  });
  shadows(g);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Công trình                                                         */
/* ------------------------------------------------------------------ */

export function propCottage(wall: number, roofColor: number): THREE.Group {
  const g = new THREE.Group();
  const wallMat = solid(wall, 0.88);
  const roofMat = solid(roofColor, 0.82);
  const woodMat = solid(0x6e4b33, 0.95);
  const winMat = glow(0xffc069, 1.5);
  const body = box(1.5, 1.05, 1.25, wallMat);
  body.position.y = 0.53;
  g.add(body);
  const roof = cone(1.28, 0.78, 4, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.86;
  roof.position.y = 1.45;
  g.add(roof);
  const door = box(0.34, 0.6, 0.06, woodMat);
  door.position.set(0, 0.3, 0.64);
  g.add(door);
  for (const x of [-0.45, 0.45]) {
    const window_ = box(0.26, 0.26, 0.05, winMat);
    window_.position.set(x, 0.68, 0.64);
    g.add(window_);
  }
  const chimney = box(0.18, 0.5, 0.18, woodMat);
  chimney.position.set(0.45, 1.6, -0.2);
  g.add(chimney);
  shadows(g);
  return g;
}

function propVilla(wall: number, accent: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const wallMat = solid(wall, 0.8);
  const trimMat = shiny(accent);
  const winMat = glow(0xffd7a0, 1.4);
  const podium = box(3.0, 0.28, 2.4, solid(0x8c9a99, 0.92));
  podium.position.y = 0.14;
  g.add(podium);
  const body = box(2.5, 1.5, 1.9, wallMat);
  body.position.y = 1.03;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const column = cyl(0.1, 0.12, 1.5, 8, wallMat);
    column.position.set(-1.05 + i * 0.7, 1.03, 1.02);
    g.add(column);
  }
  const cornice = box(2.8, 0.2, 2.2, trimMat);
  cornice.position.y = 1.88;
  g.add(cornice);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), trimMat);
  dome.position.y = 1.98;
  dome.scale.set(1, 0.82, 1);
  g.add(dome);
  const finial = ball(0.14, trimMat);
  finial.position.y = 2.85;
  g.add(finial);
  for (const x of [-0.75, 0, 0.75]) {
    const window_ = box(0.3, 0.6, 0.05, winMat);
    window_.position.set(x, 1.0, 0.97);
    g.add(window_);
  }
  const light = new THREE.PointLight(0xffd7a0, 0.35, 8);
  light.position.set(0, 1.2, 1.3);
  g.add(light);
  ticks.push((t) => {
    light.intensity = 0.3 + Math.sin(t * 1.1) * 0.08;
  });
  shadows(g);
  return g;
}

function propPagoda(wall: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const wallMat = solid(wall, 0.86);
  const roofMat = shiny(accent);
  const base = box(1.7, 0.3, 1.7, solid(0x7d8f92, 0.94));
  base.position.y = 0.15;
  g.add(base);
  let y = 0.3;
  let size = 1.25;
  for (let i = 0; i < 3; i++) {
    const tier = box(size, 0.72, size, wallMat);
    tier.position.y = y + 0.36;
    g.add(tier);
    const eave = cone(size * 1.05, 0.42, 4, roofMat);
    eave.rotation.y = Math.PI / 4;
    eave.position.y = y + 0.9;
    g.add(eave);
    y += 1.05;
    size *= 0.78;
  }
  const spire = cone(0.12, 0.6, 6, roofMat);
  spire.position.y = y + 0.3;
  g.add(spire);
  shadows(g);
  return g;
}

function propWindmill(wall: number, accent: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const wallMat = solid(wall, 0.88);
  const woodMat = solid(accent, 0.95);
  const tower = cyl(0.55, 0.85, 2.4, 10, wallMat);
  tower.position.y = 1.2;
  g.add(tower);
  const cap = cone(0.7, 0.6, 10, woodMat);
  cap.position.y = 2.7;
  g.add(cap);
  const blades = new THREE.Group();
  blades.position.set(0, 2.35, 0.75);
  for (let i = 0; i < 4; i++) {
    const blade = box(0.16, 1.7, 0.05, woodMat);
    blade.position.y = 0.85;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 4) * Math.PI * 2;
    holder.add(blade);
    blades.add(holder);
  }
  g.add(blades);
  ticks.push((_, dt) => {
    blades.rotation.z += dt * 0.9;
  });
  shadows(g);
  return g;
}

function propGazebo(wall: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const wallMat = solid(wall, 0.86);
  const roofMat = solid(accent, 0.82);
  const floor = cyl(1.15, 1.25, 0.22, 8, solid(0x8c9a99, 0.92));
  floor.position.y = 0.11;
  g.add(floor);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const column = cyl(0.07, 0.08, 1.35, 6, wallMat);
    column.position.set(Math.cos(a) * 0.95, 0.9, Math.sin(a) * 0.95);
    g.add(column);
  }
  const roof = cone(1.35, 0.72, 8, roofMat);
  roof.position.y = 1.94;
  g.add(roof);
  const finial = ball(0.12, shiny(0xe0aa50));
  finial.position.y = 2.4;
  g.add(finial);
  shadows(g);
  return g;
}

function propTent(color: number): THREE.Group {
  const g = new THREE.Group();
  const canvasMat = solid(color, 0.94);
  const poleMat = solid(0x6e4b33, 0.96);
  const body = cone(0.82, 1.2, 6, canvasMat);
  body.position.y = 0.6;
  g.add(body);
  const pole = cyl(0.03, 0.03, 1.5, 4, poleMat);
  pole.position.y = 0.75;
  g.add(pole);
  const flag = box(0.3, 0.16, 0.02, solid(0xffd88a, 0.7));
  flag.position.set(0.16, 1.4, 0);
  g.add(flag);
  shadows(g);
  return g;
}

function propStall(wood: number, awning: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const woodMat = solid(wood, 0.95);
  const clothMat = solid(awning, 0.92);
  const counter = box(1.3, 0.55, 0.6, woodMat);
  counter.position.y = 0.28;
  g.add(counter);
  for (const x of [-0.6, 0.6]) {
    const post = box(0.07, 1.3, 0.07, woodMat);
    post.position.set(x, 0.65, -0.24);
    g.add(post);
    const front = box(0.07, 1.1, 0.07, woodMat);
    front.position.set(x, 0.55, 0.28);
    g.add(front);
  }
  const awningMesh = box(1.5, 0.08, 0.8, clothMat);
  awningMesh.position.set(0, 1.28, 0.02);
  awningMesh.rotation.x = 0.16;
  g.add(awningMesh);
  const stripes: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const stripe = box(0.28, 0.06, 0.82, solid(0xe9f3f0, 0.9));
    stripe.position.set(-0.56 + i * 0.38, 1.32, 0.02);
    stripe.rotation.x = 0.16;
    stripes.push(stripe);
    g.add(stripe);
  }
  const crateMat = solid(0xb2803a, 0.96);
  for (let i = 0; i < 3; i++) {
    const crate = box(0.24, 0.2, 0.24, crateMat);
    crate.position.set(-0.4 + i * 0.4, 0.66, 0.05);
    crate.rotation.y = i * 0.4;
    g.add(crate);
  }
  ticks.push((t) => {
    for (let i = 0; i < stripes.length; i++) stripes[i].position.y = 1.32 + Math.sin(t * 2 + i) * 0.012;
  });
  shadows(g);
  return g;
}

function propGreenhouse(glassColor: number, frameColor: number): THREE.Group {
  const g = new THREE.Group();
  const frameMat = solid(frameColor, 0.7, 0.2);
  const glassMat = new THREE.MeshStandardMaterial({
    color: glassColor, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.5,
  });
  const base = box(2.2, 0.22, 1.5, solid(0x7d8f92, 0.94));
  base.position.y = 0.11;
  g.add(base);
  const walls = box(2.0, 1.1, 1.3, glassMat);
  walls.position.y = 0.77;
  g.add(walls);
  const roof = cone(1.45, 0.7, 4, glassMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.66;
  roof.position.y = 1.66;
  g.add(roof);
  for (const x of [-1.0, 0, 1.0]) {
    const rib = box(0.06, 1.15, 0.06, frameMat);
    rib.position.set(x, 0.77, 0.66);
    g.add(rib);
  }
  const plantMat = solid(0x3f9c70, 0.9);
  for (let i = 0; i < 4; i++) {
    const plant = ball(0.16, plantMat);
    plant.position.set(-0.7 + i * 0.46, 0.42, 0);
    g.add(plant);
  }
  shadows(g);
  return g;
}

function propTower(wall: number, accent: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const wallMat = solid(wall, 0.9);
  const roofMat = solid(accent, 0.84);
  const shaft = cyl(0.5, 0.68, 2.9, 8, wallMat);
  shaft.position.y = 1.45;
  g.add(shaft);
  const gallery = cyl(0.78, 0.78, 0.24, 8, solid(0x64787a, 0.92));
  gallery.position.y = 2.95;
  g.add(gallery);
  const cabin = cyl(0.46, 0.46, 0.6, 8, glow(0xffc069, 1.3));
  cabin.position.y = 3.35;
  g.add(cabin);
  const roof = cone(0.7, 0.62, 8, roofMat);
  roof.position.y = 3.95;
  g.add(roof);
  const light = new THREE.PointLight(0xffc069, 0.7, 12);
  light.position.y = 3.4;
  g.add(light);
  ticks.push((t) => {
    light.intensity = 0.55 + Math.sin(t * 1.8) * 0.2;
  });
  shadows(g);
  return g;
}

function propBridge(color: number): THREE.Group {
  const g = new THREE.Group();
  const deckMat = solid(color, 0.94);
  const deck = box(3.4, 0.16, 1.1, deckMat);
  deck.position.y = 0.42;
  g.add(deck);
  for (const side of [-0.5, 0.5]) {
    for (let i = 0; i < 5; i++) {
      const post = box(0.09, 0.5, 0.09, deckMat);
      post.position.set(-1.5 + i * 0.75, 0.72, side);
      g.add(post);
    }
    const rail = box(3.4, 0.08, 0.08, deckMat);
    rail.position.set(0, 0.95, side);
    g.add(rail);
  }
  for (const x of [-1.4, 1.4]) {
    const pier = box(0.22, 0.85, 0.9, deckMat);
    pier.position.set(x, 0.0, 0);
    g.add(pier);
  }
  shadows(g);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Tượng đài                                                          */
/* ------------------------------------------------------------------ */

function propObelisk(stone: number, runeColor: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = solid(stone, 0.9);
  const runeMat = glow(runeColor, 1.9);
  const base = box(1.0, 0.3, 1.0, solid(0x64787a, 0.94));
  base.position.y = 0.15;
  g.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 2.6, 4), stoneMat);
  shaft.rotation.y = Math.PI / 4;
  shaft.position.y = 1.6;
  g.add(shaft);
  const runes = box(0.34, 1.6, 0.04, runeMat);
  runes.position.set(0, 1.55, 0.27);
  g.add(runes);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), runeMat);
  tip.position.y = 3.1;
  g.add(tip);
  const light = new THREE.PointLight(runeColor, 0.55, 9);
  light.position.y = 3.1;
  g.add(light);
  ticks.push((t, dt) => {
    tip.rotation.y += dt * 1.1;
    tip.position.y = 3.1 + Math.sin(t * 1.6) * 0.12;
  });
  shadows(g);
  return g;
}

function propCoinPile(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const coinMat = shiny(color);
  for (let i = 0; i < 14; i++) {
    const coin = cyl(0.19, 0.19, 0.05, 14, coinMat);
    const a = (i / 14) * Math.PI * 4;
    const r = 0.32 * (1 - i / 18);
    coin.position.set(Math.cos(a) * r, 0.04 + i * 0.035, Math.sin(a) * r);
    coin.rotation.set(0.1 * Math.sin(a), a, 0.08 * Math.cos(a));
    g.add(coin);
  }
  const floater = cyl(0.22, 0.22, 0.06, 16, coinMat);
  floater.position.y = 1.0;
  g.add(floater);
  ticks.push((t, dt) => {
    floater.rotation.y += dt * 1.6;
    floater.position.y = 1.0 + Math.sin(t * 1.7) * 0.12;
  });
  shadows(g);
  return g;
}

function propStatue(color: number, accent: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = shiny(color);
  const baseMat = solid(accent, 0.9);
  const pedestal = cyl(0.62, 0.75, 0.55, 8, baseMat);
  pedestal.position.y = 0.28;
  g.add(pedestal);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.62, 4, 10), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.05;
  g.add(body);
  const head = ball(0.25, bodyMat);
  head.position.set(0.55, 1.2, 0);
  g.add(head);
  const tail = cone(0.4, 0.75, 4, bodyMat);
  tail.position.set(-0.62, 1.25, 0);
  tail.rotation.z = Math.PI / 2.6;
  g.add(tail);
  const fin = cone(0.2, 0.46, 4, bodyMat);
  fin.position.y = 1.55;
  g.add(fin);
  const light = new THREE.PointLight(color, 0.4, 8);
  light.position.y = 1.7;
  g.add(light);
  ticks.push((t) => {
    light.intensity = 0.32 + Math.sin(t * 1.6) * 0.12;
  });
  shadows(g);
  return g;
}

function propFountain(stone: number, water: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = solid(stone, 0.84);
  const waterMat = new THREE.MeshStandardMaterial({
    color: water, roughness: 0.14, metalness: 0.05, transparent: true, opacity: 0.72,
    emissive: water, emissiveIntensity: 0.22,
  });
  const basin = cyl(1.15, 1.25, 0.42, 16, stoneMat);
  basin.position.y = 0.21;
  g.add(basin);
  const pool = cyl(1.0, 1.0, 0.08, 16, waterMat);
  pool.position.y = 0.42;
  g.add(pool);
  const stem = cyl(0.16, 0.24, 0.7, 8, stoneMat);
  stem.position.y = 0.75;
  g.add(stem);
  const upper = cyl(0.5, 0.42, 0.16, 12, stoneMat);
  upper.position.y = 1.16;
  g.add(upper);
  const spout = ball(0.14, waterMat);
  spout.position.y = 1.34;
  g.add(spout);
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const drop = ball(0.07, waterMat);
    g.add(drop);
    drops.push(drop);
  }
  ticks.push((t) => {
    drops.forEach((drop, i) => {
      const cycle = (t * 0.85 + i / drops.length) % 1;
      const a = (i / drops.length) * Math.PI * 2;
      drop.position.set(Math.cos(a) * (0.16 + cycle * 0.72), 1.36 + cycle * 0.5 - cycle * cycle * 1.5, Math.sin(a) * (0.16 + cycle * 0.72));
    });
    pool.scale.setScalar(1 + Math.sin(t * 1.8) * 0.006);
  });
  shadows(g);
  return g;
}

function propSundial(stone: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = solid(stone, 0.9);
  const gnomonMat = shiny(accent);
  const base = cyl(0.7, 0.8, 0.3, 12, stoneMat);
  base.position.y = 0.15;
  g.add(base);
  const column = cyl(0.2, 0.26, 0.7, 8, stoneMat);
  column.position.y = 0.65;
  g.add(column);
  const face = cyl(0.72, 0.72, 0.1, 16, stoneMat);
  face.position.y = 1.05;
  g.add(face);
  const gnomon = cone(0.16, 0.7, 3, gnomonMat);
  gnomon.rotation.x = -0.5;
  gnomon.position.y = 1.4;
  g.add(gnomon);
  for (let i = 0; i < 12; i++) {
    const tick = box(0.05, 0.03, 0.16, gnomonMat);
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.cos(a) * 0.56, 1.11, Math.sin(a) * 0.56);
    tick.rotation.y = -a;
    g.add(tick);
  }
  shadows(g);
  return g;
}

function propTotem(wood: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = solid(wood, 0.95);
  const accentMat = glow(accent, 1.3);
  const base = cyl(0.42, 0.5, 0.24, 8, solid(0x64787a, 0.94));
  base.position.y = 0.12;
  g.add(base);
  for (let i = 0; i < 3; i++) {
    const block = box(0.6 - i * 0.06, 0.62, 0.6 - i * 0.06, woodMat);
    block.position.y = 0.55 + i * 0.66;
    block.rotation.y = i * 0.35;
    g.add(block);
    const eye = box(0.36, 0.1, 0.04, accentMat);
    eye.position.set(0, 0.62 + i * 0.66, 0.3 - i * 0.03);
    eye.rotation.y = i * 0.35;
    g.add(eye);
    for (const side of [-1, 1]) {
      const wing = box(0.2, 0.12, 0.14, woodMat);
      wing.position.set(side * (0.36 - i * 0.03), 0.52 + i * 0.66, 0);
      g.add(wing);
    }
  }
  const crown = cone(0.36, 0.5, 6, accentMat);
  crown.position.y = 2.6;
  g.add(crown);
  shadows(g);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Ven biển                                                           */
/* ------------------------------------------------------------------ */

function propBuoy(color: number, accent: number | undefined, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = solid(color, 0.7);
  const body = cone(0.24, 0.7, 8, bodyMat);
  body.position.y = 0.3;
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 16), solid(0xe9f3f0, 0.8));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  g.add(ring);
  const lampMat = glow(accent ?? color, 1.8);
  const lamp = ball(0.1, lampMat);
  lamp.position.y = 0.74;
  g.add(lamp);
  ticks.push((t) => {
    g.position.y = Math.sin(t * 1.4 + color) * 0.09;
    g.rotation.z = Math.sin(t * 1.1 + color) * 0.09;
    lampMat.emissiveIntensity = 1.2 + Math.abs(Math.sin(t * 2.4)) * 1.0;
  });
  shadows(g);
  return g;
}

function propSailboat(hull: number, sail: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const hullMat = solid(hull, 0.82);
  const sailMat = new THREE.MeshStandardMaterial({ color: sail, roughness: 0.86, side: THREE.DoubleSide, flatShading: true });
  const body = box(1.7, 0.34, 0.68, hullMat);
  body.position.y = 0.17;
  g.add(body);
  const bow = cone(0.34, 0.6, 4, hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.y = 0.55;
  bow.position.set(0, 0.17, 1.05);
  g.add(bow);
  const mast = cyl(0.035, 0.035, 1.6, 6, solid(0x6e4b33, 0.95));
  mast.position.y = 0.95;
  g.add(mast);
  const mainSail = cone(0.55, 1.25, 4, sailMat);
  mainSail.scale.z = 0.2;
  mainSail.position.y = 1.15;
  g.add(mainSail);
  ticks.push((t) => {
    g.position.y = Math.sin(t * 1.2) * 0.07;
    g.rotation.z = Math.sin(t * 0.95) * 0.05;
    mainSail.rotation.y = Math.sin(t * 0.7) * 0.2;
  });
  shadows(g);
  return g;
}

function propRaft(wood: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const woodMat = solid(wood, 0.96);
  for (let i = 0; i < 6; i++) {
    const log = cyl(0.11, 0.11, 1.5, 6, woodMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(0, 0.11, -0.32 + i * 0.13);
    g.add(log);
  }
  const pole = cyl(0.03, 0.03, 1.1, 5, woodMat);
  pole.position.set(0.5, 0.65, 0);
  pole.rotation.z = 0.35;
  g.add(pole);
  ticks.push((t) => {
    g.position.y = Math.sin(t * 1.35) * 0.07;
    g.rotation.x = Math.sin(t * 1.05) * 0.05;
  });
  shadows(g);
  return g;
}

export function propPier(wood: number, lampColor: number | undefined, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const woodMat = solid(wood, 0.95);
  for (let i = 0; i < 6; i++) {
    const plank = box(1.5, 0.13, 1.0, woodMat);
    plank.position.set(0, 0.06 - i * 0.015, i * 1.02);
    g.add(plank);
  }
  for (let i = 0; i < 3; i++) {
    for (const x of [-0.62, 0.62]) {
      const piling = cyl(0.08, 0.1, 1.5, 6, woodMat);
      piling.position.set(x, -0.6, 0.6 + i * 2.0);
      g.add(piling);
    }
  }
  if (lampColor !== undefined) {
    const lampMat = glow(lampColor, 1.7);
    const post = cyl(0.05, 0.06, 1.0, 5, woodMat);
    post.position.set(0.62, 0.55, 5.0);
    g.add(post);
    const lamp = ball(0.13, lampMat);
    lamp.position.set(0.62, 1.1, 5.0);
    g.add(lamp);
    const light = new THREE.PointLight(lampColor, 0.55, 8);
    light.position.set(0.62, 1.1, 5.0);
    g.add(light);
    ticks.push((t) => {
      lampMat.emissiveIntensity = 1.4 + Math.sin(t * 2.0) * 0.4;
    });
  }
  shadows(g);
  return g;
}

function propNetRack(wood: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = solid(wood, 0.96);
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xc9d6cf, roughness: 0.95, transparent: true, opacity: 0.45, side: THREE.DoubleSide, wireframe: true,
  });
  for (const x of [-0.7, 0.7]) {
    const post = cyl(0.06, 0.07, 1.5, 5, woodMat);
    post.position.set(x, 0.75, 0);
    g.add(post);
  }
  const beam = box(1.6, 0.07, 0.07, woodMat);
  beam.position.y = 1.45;
  g.add(beam);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1, 6, 5), netMat);
  net.position.set(0, 0.9, 0.02);
  g.add(net);
  const buoyMat = solid(0xe2604f, 0.8);
  for (let i = 0; i < 3; i++) {
    const float_ = ball(0.1, buoyMat);
    float_.position.set(-0.45 + i * 0.45, 0.28, 0.12);
    g.add(float_);
  }
  shadows(g);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Hiệu ứng                                                           */
/* ------------------------------------------------------------------ */

function propAura(color: number, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const ringMat = additive(color, 0.22);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.9, 0.06, 6, 56), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4 + i * 0.5;
    rings.push(ring);
    g.add(ring);
  }
  const light = new THREE.PointLight(color, 0.55, 16);
  light.position.y = 2;
  g.add(light);
  ticks.push((t, dt) => {
    rings.forEach((ring, i) => {
      ring.rotation.z += dt * (0.2 + i * 0.12);
      ring.position.y = 0.4 + i * 0.5 + Math.sin(t * 0.9 + i) * 0.18;
    });
    ringMat.opacity = 0.16 + Math.abs(Math.sin(t * 0.8)) * 0.14;
  });
  return g;
}

function propParticles(color: number, mode: "petalfall" | "bubbles" | "sparks", ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const COUNT = 90;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    seeds[i * 3] = Math.random() * Math.PI * 2;
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = 1.5 + Math.random() * 5.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: mode === "bubbles" ? 0.14 : 0.2,
    transparent: true,
    opacity: mode === "sparks" ? 0.85 : 0.65,
    blending: mode === "petalfall" ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
  });
  g.add(new THREE.Points(geometry, material));
  ticks.push((t) => {
    const attribute = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const a = seeds[i * 3];
      const r = seeds[i * 3 + 2];
      const speed = mode === "bubbles" ? 0.5 : 0.28;
      /* Cánh hoa rơi xuống, bong bóng nổi lên, tia sáng lượn ngang. */
      const phase = (seeds[i * 3 + 1] + t * speed) % 1;
      const height = mode === "bubbles" ? phase * 5 : 5 - phase * 5;
      const sway = Math.sin(t * 1.1 + i) * (mode === "sparks" ? 0.8 : 0.4);
      attribute.setXYZ(i, Math.cos(a + t * 0.08) * r + sway, 0.4 + height, Math.sin(a + t * 0.08) * r);
    }
    attribute.needsUpdate = true;
  });
  return g;
}

/* ------------------------------------------------------------------ */
/*  Bộ dựng chung                                                      */
/* ------------------------------------------------------------------ */

/** Dựng một bản sao của vật phẩm; vị trí do người gọi quyết định. */
export function makeProp(item: ShopItem, m: Mats, ticks: TickFn[]): THREE.Group {
  const accent = item.accent;
  switch (item.kind) {
    case "palm": return propPalm(item.color);
    case "pine": return propPine(item.color);
    case "bush": return propBush(item.color, accent);
    case "flowerbed": return propFlowerbed(item.color);
    case "bamboo": return propBamboo(item.color);
    case "cactus": return propCactus(item.color);
    case "blossom": return propBlossom(item.color);
    case "vine": return propVine(item.color, ticks);
    case "lantern": return propLantern(item.color, ticks);
    case "lamppost": return propLamppost(item.color, ticks);
    case "torch": return propTorch(item.color, ticks);
    case "neonarch": return propNeonArch(item.color, ticks);
    case "glowstone": return propGlowstone(item.color, ticks);
    case "firefly": return propFirefly(item.color, ticks);
    case "beacon": return propBeacon(item.color, ticks);
    case "cottage": return propCottage(item.color, accent ?? 0x1e5f58);
    case "villa": return propVilla(item.color, accent ?? 0xe0aa50, ticks);
    case "pagoda": return propPagoda(item.color, accent ?? 0xe0aa50);
    case "windmill": return propWindmill(item.color, accent ?? 0x6e4b33, ticks);
    case "gazebo": return propGazebo(item.color, accent ?? 0x1e5f58);
    case "tent": return propTent(item.color);
    case "stall": return propStall(item.color, accent ?? 0xe2604f, ticks);
    case "greenhouse": return propGreenhouse(item.color, accent ?? 0xdde9e4);
    case "tower": return propTower(item.color, accent ?? 0x1e5f58, ticks);
    case "bridge": return propBridge(item.color);
    case "obelisk": return propObelisk(item.color, accent ?? 0x5ce8c4, ticks);
    case "coinpile": return propCoinPile(item.color, ticks);
    case "statue": return propStatue(item.color, accent ?? 0xe0aa50, ticks);
    case "fountain": return propFountain(item.color, accent ?? 0x7bdcf5, ticks);
    case "sundial": return propSundial(item.color, accent ?? 0xe0aa50);
    case "totem": return propTotem(item.color, accent ?? 0x5ce8c4);
    case "buoy": return propBuoy(item.color, accent, ticks);
    case "sailboat": return propSailboat(item.color, accent ?? 0xe0aa50, ticks);
    case "raft": return propRaft(item.color, ticks);
    case "pier": return propPier(item.color, accent, ticks);
    case "netrack": return propNetRack(item.color);
    case "aura": return propAura(item.color, ticks);
    case "petalfall": return propParticles(item.color, "petalfall", ticks);
    case "bubbles": return propParticles(item.color, "bubbles", ticks);
    case "sparks": return propParticles(item.color, "sparks", ticks);
    default: {
      /* `ground` không dựng hình: nó đổi bảng màu nền, xử lý ở WorldScene. */
      void m;
      return new THREE.Group();
    }
  }
}

/**
 * Rải các bản sao của một vật phẩm quanh một vòng tròn. Chỉ số `index` quyết
 * định góc, nên bố cục ổn định giữa các lần dựng lại — người chơi cất một món
 * đi thì những món còn lại không nhảy chỗ.
 */
export function placeProp(item: ShopItem, index: number, radius: number, group: THREE.Group, node: THREE.Group, copy: number): void {
  const total = Math.max(1, item.count ?? 1);
  /* Góc vàng: các món khác nhau không bao giờ chồng lên nhau. */
  const golden = 2.399963;
  const angle = index * golden + (copy / total) * Math.PI * 2 * 0.32;
  const ringRadius = item.cat === "sea" ? radius * 1.06 : radius * (0.52 + ((index * 7 + copy * 3) % 5) * 0.08);
  node.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
  node.rotation.y = -angle + Math.PI / 2;
  node.scale.setScalar(item.scale ?? 1);
  group.add(node);
}

/* ------------------------------------------------------------------ */
/*  Khu dân cư cố định của đảo chính                                   */
/* ------------------------------------------------------------------ */

interface VillageSpot {
  x: number;
  z: number;
  rotation: number;
  kind: "cottage" | "stall" | "tent" | "gazebo" | "windmill" | "tower" | "garden" | "greenhouse";
}

/* Nhà cửa nằm giữa bốn quận và men theo bãi cát — nơi trước đây trống trơn. */
const VILLAGE: VillageSpot[] = [
  { x: 0.5, z: -14.5, rotation: 0.1, kind: "cottage" },
  { x: -3.4, z: -13.6, rotation: 0.5, kind: "cottage" },
  { x: 3.9, z: -13.2, rotation: -0.4, kind: "cottage" },
  { x: -0.4, z: -17.6, rotation: 3.0, kind: "stall" },
  { x: 3.2, z: -17.2, rotation: 2.7, kind: "stall" },
  { x: -3.9, z: -17.0, rotation: 3.4, kind: "tent" },
  { x: 16.5, z: -0.4, rotation: -1.5, kind: "cottage" },
  { x: 19.4, z: 2.6, rotation: -1.8, kind: "greenhouse" },
  { x: 17.2, z: -4.6, rotation: -1.2, kind: "garden" },
  { x: -16.6, z: 0.6, rotation: 1.5, kind: "cottage" },
  { x: -19.2, z: -2.8, rotation: 1.9, kind: "windmill" },
  { x: -17.4, z: 4.4, rotation: 1.2, kind: "garden" },
  { x: 0.3, z: 15.4, rotation: 3.1, kind: "gazebo" },
  { x: -4.6, z: 16.2, rotation: 2.7, kind: "cottage" },
  { x: 5.2, z: 16.0, rotation: -2.8, kind: "cottage" },
  { x: -8.4, z: 18.6, rotation: 2.4, kind: "tent" },
  { x: 8.8, z: 18.4, rotation: -2.4, kind: "stall" },
  { x: 13.4, z: 14.2, rotation: -2.2, kind: "tower" },
  { x: -13.6, z: 14.0, rotation: 2.2, kind: "tower" },
  { x: -12.2, z: -18.6, rotation: 2.9, kind: "garden" },
  { x: 12.6, z: -18.4, rotation: -2.9, kind: "greenhouse" },
];

const COTTAGE_WALLS = [0xdde9e4, 0xf0e4cb, 0xe6d7c3, 0xd8e4e0, 0xf2e8d5];
const COTTAGE_ROOFS = [0x1e5f58, 0xa8574f, 0x8f5a4a, 0x2a5f7a, 0xb2803a];

/**
 * Xóm làng, chợ phiên và vườn tược trên đảo chính. Trước đây khoảng đất giữa
 * bốn quận hoàn toàn trống, khiến hòn đảo trông như một mô hình kiến trúc chứ
 * không phải nơi có người ở.
 */
export function buildVillage(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  VILLAGE.forEach((spot, index) => {
    let node: THREE.Group;
    switch (spot.kind) {
      case "cottage":
        node = propCottage(COTTAGE_WALLS[index % COTTAGE_WALLS.length], COTTAGE_ROOFS[index % COTTAGE_ROOFS.length]);
        node.scale.setScalar(1.15);
        break;
      case "stall":
        node = propStall(0xd9a066, index % 2 ? 0xe2604f : 0x4cb0d9, ticks);
        break;
      case "tent":
        node = propTent(index % 2 ? 0xe2604f : 0x4cb0d9);
        break;
      case "gazebo":
        node = propGazebo(0xe6dcc0, 0x1e5f58);
        break;
      case "windmill":
        node = propWindmill(0xdde9e4, 0x6e4b33, ticks);
        break;
      case "tower":
        node = propTower(0xa9b9b3, 0x1e5f58, ticks);
        node.scale.setScalar(0.85);
        break;
      case "greenhouse":
        node = propGreenhouse(0xbfe8e0, 0xdde9e4);
        break;
      default:
        node = propFlowerbed(index % 2 ? 0xb79cff : 0xff9ac1);
        node.scale.setScalar(1.5);
        break;
    }
    node.position.set(spot.x, 0, spot.z);
    node.rotation.y = spot.rotation;
    g.add(node);

    /* Một cây và một đèn cạnh mỗi nếp nhà: nhóm lại thành "khu" chứ không phải
       vật thể lẻ loi giữa bãi cỏ. */
    if (spot.kind === "cottage" || spot.kind === "greenhouse") {
      const tree = propPalm(index % 2 ? 0x3f9c70 : 0x2e8d63);
      tree.position.set(spot.x + Math.cos(spot.rotation + 1.4) * 2.2, 0, spot.z + Math.sin(spot.rotation + 1.4) * 2.2);
      tree.scale.setScalar(0.85);
      g.add(tree);
      const lantern = propLantern(0xffc069, ticks);
      lantern.position.set(spot.x + Math.cos(spot.rotation - 1.2) * 1.9, 0, spot.z + Math.sin(spot.rotation - 1.2) * 1.9);
      g.add(lantern);
    }
  });
  void m;
  return g;
}

/** Vị trí bến câu trên đảo chính — cũng là điểm bấm để mở trò câu cá. */
export const PIER_POSITION = new THREE.Vector3(-14.5, 0, 16.5);
export const PIER_ROTATION = 2.35;

/** Bến câu: cầu gỗ, chòi, thùng cá và một cần câu dựng sẵn. */
export function buildFishingPier(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const deck = propPier(0x7a5a3a, 0xffc069, ticks);
  g.add(deck);

  const woodMat = solid(0x6e4b33, 0.95);
  const roofMat = solid(0x1e5f58, 0.85);
  /* chòi nhỏ ở đầu bến */
  const hutFloor = box(1.5, 0.14, 1.4, woodMat);
  hutFloor.position.set(0, 0.14, 1.2);
  g.add(hutFloor);
  for (const x of [-0.62, 0.62]) {
    for (const z of [0.6, 1.8]) {
      const post = box(0.09, 1.2, 0.09, woodMat);
      post.position.set(x, 0.75, z);
      g.add(post);
    }
  }
  const roof = cone(1.25, 0.6, 4, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 1.65, 1.2);
  g.add(roof);

  /* thùng cá và cần câu dựa vào lan can */
  const barrel = cyl(0.24, 0.26, 0.5, 10, woodMat);
  barrel.position.set(0.5, 0.4, 0.6);
  g.add(barrel);
  const rod = cyl(0.025, 0.035, 1.9, 5, woodMat);
  rod.position.set(-0.55, 0.9, 2.6);
  rod.rotation.set(0.55, 0, 0.3);
  g.add(rod);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xdde9e4, transparent: true, opacity: 0.5 });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.05, 1.75, 3.5),
    new THREE.Vector3(-1.15, -0.4, 4.4),
  ]);
  g.add(new THREE.Line(lineGeometry, lineMat));

  /* vòng sóng dưới mặt nước để mắt biết đây là chỗ có cá */
  const rippleMat = additive(0x7fe8bb, 0.3);
  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), rippleMat);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(-1.15, -0.42, 4.4);
    ripples.push(ripple);
    g.add(ripple);
  }
  ticks.push((t) => {
    ripples.forEach((ripple, i) => {
      const cycle = (t * 0.5 + i / 3) % 1;
      ripple.scale.setScalar(0.4 + cycle * 2.4);
      (ripple.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - cycle);
    });
  });

  shadows(g);
  void m;
  return g;
}

/* ------------------------------------------------------------------ */
/*  Xoáy nước ngoài khơi                                               */
/* ------------------------------------------------------------------ */

export interface Whirlpool {
  group: THREE.Group;
  tick: TickFn;
  setActive(active: boolean): void;
}

/** Vòng xoáy phát sáng trên mặt biển — lái du thuyền vào để câu cá hiếm. */
export function makeWhirlpool(): Whirlpool {
  const g = new THREE.Group();
  const swirlMat = additive(0x7fe8bb, 0.42);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8 + i * 0.75, 1.25 + i * 0.75, 40, 1, 0, Math.PI * 1.55), swirlMat);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = i * 0.9;
    ring.position.y = 0.08 - i * 0.012;
    rings.push(ring);
    g.add(ring);
  }
  const coreMat = additive(0xd8fff2, 0.5);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.75, 26), coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.1;
  g.add(core);
  const funnel = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 20, 1, true), additive(0x9ff0e2, 0.16));
  funnel.position.y = -1.1;
  g.add(funnel);
  const light = new THREE.PointLight(0x7fe8bb, 0.9, 22);
  light.position.y = 1.4;
  g.add(light);

  let active = true;
  return {
    group: g,
    setActive(next) {
      active = next;
      g.visible = next;
    },
    tick: (t, dt) => {
      if (!active) return;
      rings.forEach((ring, i) => {
        ring.rotation.z += dt * (0.8 + i * 0.35) * (i % 2 ? -1 : 1);
        ring.scale.setScalar(1 + Math.sin(t * 1.2 + i) * 0.05);
      });
      core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
      swirlMat.opacity = 0.3 + Math.abs(Math.sin(t * 1.1)) * 0.2;
      funnel.rotation.y += dt * 1.4;
      light.intensity = 0.7 + Math.abs(Math.sin(t * 1.6)) * 0.4;
    },
  };
}
