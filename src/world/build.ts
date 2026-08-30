import * as THREE from "three";

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

export const ISLAND_RADIUS = 26;

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
  const std = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0.02, ...p });
  return {
    stone: std({ color: 0xa9b9b3 }),
    stoneDark: std({ color: 0x64787a, roughness: 0.95 }),
    white: std({ color: 0xdde9e4, roughness: 0.8 }),
    wood: std({ color: 0x6e4b33 }),
    roofTeal: std({ color: 0x1e5f58, roughness: 0.75 }),
    gold: std({ color: 0xe0aa50, metalness: 0.85, roughness: 0.3 }),
    goldBright: std({ color: 0xffd88a, metalness: 0.9, roughness: 0.22 }),
    glowWarm: std({ color: 0x2a1c0a, emissive: 0xffc069, emissiveIntensity: 1.7, roughness: 0.4 }),
    glowCyan: std({ color: 0x06231f, emissive: 0x5ce8c4, emissiveIntensity: 1.9, roughness: 0.35 }),
    glowBlue: std({ color: 0x0a1a2a, emissive: 0x9fd0ff, emissiveIntensity: 1.6, roughness: 0.35 }),
    leaves1: std({ color: 0x2e7d5f }),
    leaves2: std({ color: 0x3f9c70 }),
    rock: std({ color: 0x47595d, roughness: 1 }),
    scaffold: std({ color: 0x8a6a44, roughness: 1 }),
    barUp: std({ color: 0x0f3d2e, emissive: 0x4cd99a, emissiveIntensity: 1.1 }),
    barDown: std({ color: 0x3d150f, emissive: 0xff7f6e, emissiveIntensity: 1.0 }),
  };
}

const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)), m);
const cyl = (rt: number, rb: number, h: number, seg: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.01, rt), Math.max(0.01, rb), Math.max(0.01, h), Math.max(3, seg)), m);

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
  castAll(g);
  return g;
}

export function buildVault(level: number, m: Mats): THREE.Group {
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
  castAll(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* Center lighthouse                                                   */
/* ------------------------------------------------------------------ */

export function buildLighthouse(m: Mats, ticks: TickFn[]): THREE.Group {
  const g = new THREE.Group();
  const plaza = cyl(5.6, 6.1, 0.45, 6, m.stoneDark);
  plaza.position.y = 0.22;
  plaza.receiveShadow = true;
  g.add(plaza);
  const inner = cyl(3.4, 3.7, 0.2, 6, m.stone);
  inner.position.y = 0.5;
  g.add(inner);

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

export function buildTerrain(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 7, 6, 56, 3);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const anchors = [DISTRICT_POS.crypto, DISTRICT_POS.stocks, DISTRICT_POS.vault, DISTRICT_POS.academy];
  const colors: number[] = [];
  const grassA = new THREE.Color(0x2f6b52);
  const grassB = new THREE.Color(0x4f9068);
  const sand = new THREE.Color(0x9c8a5e);
  const cliffTop = new THREE.Color(0x4d6063);
  const cliffBot = new THREE.Color(0x2c3f43);
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
      let flat = THREE.MathUtils.smoothstep(r, 4.5, 8.5);
      for (const a of anchors) {
        const d = Math.sqrt((x - a.x) ** 2 + (z - a.z) ** 2);
        flat *= THREE.MathUtils.smoothstep(d, 3.6, 6.4);
        const pd = segDist2(x, z, 0, 0, a.x, a.z);
        flat *= THREE.MathUtils.smoothstep(pd, 1.1, 2.4);
      }
      pos.setY(i, 3 + n * 0.4 * flat);
      const mix = n * 0.5 + 0.5;
      c.copy(grassA).lerp(grassB, mix);
      if (r > 21.5) c.lerp(sand, THREE.MathUtils.smoothstep(r, 21.5, 25.5) * 0.85);
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
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })
  );
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

export function makeTree(m: Mats, s: number, leaves: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const trunk = cyl(0.1 * s, 0.16 * s, 0.7 * s, 5, m.wood);
  trunk.position.y = 0.35 * s;
  g.add(trunk);
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.75 * s, 1.3 * s, 6), leaves);
  c1.position.y = 1.15 * s;
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.52 * s, 1.0 * s, 6), leaves);
  c2.position.y = 1.9 * s;
  g.add(c2);
  castAll(g);
  return g;
}

export function makeRock(m: Mats, s: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(0.2, 0.55 * s)), m.rock);
  mesh.scale.y = 0.7;
  mesh.castShadow = true;
  return mesh;
}

export function makeCloud(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x9fbdb8,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });
  const parts: [number, number, number, number][] = [
    [0, 0, 0, 1.8],
    [1.6, 0.15, 0.3, 1.2],
    [-1.5, 0.1, -0.2, 1.1],
  ];
  for (const [x, y, z, r] of parts) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.3, r), 10, 8), mat);
    s.position.set(x, y, z);
    s.scale.y = 0.42;
    g.add(s);
  }
  return g;
}

export function makeSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(330, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 top = vec3(0.006, 0.04, 0.068);
        vec3 mid = vec3(0.028, 0.13, 0.16);
        vec3 hor = vec3(0.13, 0.21, 0.21);
        vec3 warm = vec3(0.55, 0.32, 0.13);
        vec3 col = mix(hor, mid, smoothstep(0.02, 0.3, h));
        col = mix(col, top, smoothstep(0.22, 0.72, h));
        float band = exp(-abs(h - 0.02) * 20.0);
        col += warm * band * 0.55;
        vec2 sp = d.xz / (abs(d.y) + 0.35);
        float star = step(0.9975, hash(floor(sp * 230.0))) * smoothstep(0.2, 0.55, h);
        col += vec3(0.85, 0.92, 1.0) * star * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

export function makeSunSprite(): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, "rgba(255, 214, 150, 0.9)");
    grd.addColorStop(0.25, "rgba(240, 170, 90, 0.42)");
    grd.addColorStop(1, "rgba(240, 150, 70, 0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.9,
  });
  const sp = new THREE.Sprite(mat);
  sp.position.set(-140, 30, -180);
  sp.scale.set(120, 120, 1);
  return sp;
}

export function makeWater(): { mesh: THREE.Mesh; tick: TickFn } {
  const geo = new THREE.PlaneGeometry(640, 640, 1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: new THREE.Color(0x08222b) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uFog;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        float d = length(p);
        float ring = sin(d * 0.34 - uTime * 1.15) * 0.5 + 0.5;
        float drift = sin(p.x * 0.06 + uTime * 0.35) * sin(p.y * 0.05 - uTime * 0.28);
        vec3 deep = vec3(0.012, 0.075, 0.1);
        vec3 base = vec3(0.03, 0.145, 0.17);
        vec3 col = mix(deep, base, ring * 0.3 + drift * 0.2 + 0.25);
        float foam = 1.0 - smoothstep(25.5, 30.0, d);
        col = mix(col, vec3(0.15, 0.33, 0.3), foam * 0.5);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 hv = normalize(viewDir + normalize(vec3(-0.55, 0.3, -0.6)));
        float spec = pow(max(hv.y, 0.0), 90.0);
        col += vec3(1.0, 0.8, 0.5) * spec * (0.35 + 0.5 * ring);
        float fogF = smoothstep(80.0, 340.0, distance(cameraPosition, vWorld));
        col = mix(col, uFog, fogF);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.45;
  const tick: TickFn = (t) => {
    mat.uniforms.uTime.value = t;
  };
  return { mesh, tick };
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

export const ISLE_POS = new THREE.Vector3(37, 0, 10);
export const ISLE_RADIUS = 7.5;
export const DECOR_IDS = ["palms", "neon", "flags", "dock", "torch"] as const;
export type DecorId = (typeof DECOR_IDS)[number];

function isleTerrain(): THREE.Group {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLE_RADIUS, ISLE_RADIUS - 2.2, 4.6, 34, 2),
    new THREE.MeshStandardMaterial({ color: 0x274a48, flatShading: true, roughness: 1 })
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
  const top = cyl(ISLE_RADIUS - 0.25, ISLE_RADIUS, 0.4, 34, new THREE.MeshStandardMaterial({ color: 0x1f5a50, flatShading: true, roughness: 0.95 }));
  top.position.y = 0;
  top.receiveShadow = true;
  g.add(top);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ISLE_RADIUS - 0.4, 0.28, 6, 40),
    new THREE.MeshStandardMaterial({ color: 0x8f7d55, flatShading: true, roughness: 1 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.05;
  g.add(rim);
  const pad = cyl(2.6, 2.9, 0.3, 8, new THREE.MeshStandardMaterial({ color: 0x31424a, flatShading: true, roughness: 0.9 }));
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
  const vent = box(1.72, 0.12, 1.12, m.glowCyan);
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
    vent.material === m.glowCyan && ((m.glowCyan.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5));
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

/** Đảo Genesis theo cấp (8/9/10 thêm công trình mới) */
export function buildIsle(m: Mats, level: number, ticks: TickFn[]): THREE.Group {
  const g = isleTerrain();
  const rig = miningRig(m, ticks);
  rig.position.set(-2.4, 0.4, -1.6);
  rig.rotation.y = 0.5;
  g.add(rig);
  const ob = obelisk(m, ticks);
  ob.position.set(2.1, 0.4, -2.1);
  g.add(ob);
  if (level >= 9) {
    const whale = whaleStatue(m, ticks);
    whale.position.set(2.6, 0.4, 2.3);
    whale.rotation.y = -2.2;
    g.add(whale);
    const mono = exchangeMonolith(m, ticks);
    mono.position.set(-2.6, 0.4, 1.9);
    mono.rotation.y = 2.6;
    g.add(mono);
  }
  if (level >= 10) {
    const rk = rocket(m, ticks);
    rk.position.set(0.4, 0.4, -3.4);
    g.add(rk);
    const holo = holoChart(m, ticks);
    holo.position.set(0, 1.1, 0);
    g.add(holo);
  }
  // teal beacon above the isle
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.4, 16, 10, 1, true), beamMat);
  beam.position.y = 8.4;
  g.add(beam);
  return g;
}

/** Hologram khi đảo chưa mở khóa */
export function buildIsleGhost(): { group: THREE.Group; tick: TickFn } {
  const g = new THREE.Group();
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5ce8c4, wireframe: true, transparent: true, opacity: 0.14, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(ISLE_RADIUS, ISLE_RADIUS - 2.2, 4.6, 20, 2), ghostMat);
  cone.position.y = -2.3;
  g.add(cone);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ISLE_RADIUS + 0.8, 0.08, 6, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  g.add(ring);
  const lock = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
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

export function makePalm(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const trunk = cyl(0.09, 0.15, 1.7, 5, m.wood);
  trunk.position.y = 0.85;
  trunk.rotation.z = 0.16;
  g.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f9c70, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(0.28 + Math.cos(a) * 0.45, 1.75, Math.sin(a) * 0.45);
    frond.rotation.z = Math.cos(a) * 1.15;
    frond.rotation.x = -Math.sin(a) * 1.15;
    g.add(frond);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), m.wood);
  nut.position.set(0.28, 1.68, 0.1);
  g.add(nut);
  castAll(g);
  return g;
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
