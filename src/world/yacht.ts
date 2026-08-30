import * as THREE from "three";
import type { Mats } from "./build";
import type { TickFn } from "./atmosphere";
import type { YachtTier } from "../state/store";

/* ------------------------------------------------------------------ */
/*  Du thuyền 5 hạng — mỗi hạng là một con tàu khác hẳn, không chỉ to hơn */
/*  Ngưỡng mở khoá nằm trong state/store (logic tiến trình).            */
/* ------------------------------------------------------------------ */

/** Chiều dài thân tàu theo hạng — dùng cho camera, vệt nước và va chạm. */
export const YACHT_LENGTH: Record<YachtTier, number> = { 1: 3.4, 2: 4.4, 3: 5.6, 4: 7.4, 5: 9.2 };

export interface YachtBuild {
  group: THREE.Group;
  ticks: TickFn[];
  /** cao độ đặt camera theo sau, tăng dần theo hạng */
  cameraHeight: number;
  /** khoảng cách camera theo sau */
  cameraDistance: number;
  length: number;
}

const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)), m);
const cyl = (rt: number, rb: number, h: number, seg: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.01, rt), Math.max(0.01, rb), Math.max(0.01, h), Math.max(3, seg)), m);

function castAll(group: THREE.Group) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

interface Palette {
  hull: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  accent: number;
}

/** Vật liệu tinh dần theo hạng: gỗ mộc → composite → sơn bóng → vàng ánh kim. */
function paletteFor(tier: YachtTier): Palette {
  const hullColors = [0xd8c39a, 0xe8eee6, 0xf1f5ef, 0xf7f9f4, 0xfdfbf2];
  const trimColors = [0x8a6a44, 0xb9c2c0, 0xd9a64f, 0xe8bc63, 0xffd88a];
  const deckColors = [0x8a6a44, 0x9c7f55, 0xb08a58, 0xc19a63, 0xd2ac74];
  const index = tier - 1;
  return {
    hull: new THREE.MeshPhysicalMaterial({
      color: hullColors[index],
      roughness: 0.42 - tier * 0.05,
      metalness: 0.05 + tier * 0.03,
      clearcoat: 0.2 + tier * 0.16,
      clearcoatRoughness: 0.3 - tier * 0.04,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x143e4b,
      emissive: 0x0b3742,
      emissiveIntensity: 0.3 + tier * 0.09,
      roughness: 0.12 - tier * 0.015,
      metalness: 0.22,
      transparent: true,
      opacity: 0.82,
    }),
    trim: new THREE.MeshStandardMaterial({ color: trimColors[index], roughness: 0.42 - tier * 0.045, metalness: 0.3 + tier * 0.12 }),
    deck: new THREE.MeshStandardMaterial({ color: deckColors[index], roughness: 0.85 }),
    accent: [0x7fe8bb, 0x7fe8bb, 0x7fe8bb, 0xffd88a, 0xffd88a][index],
  };
}

/**
 * Dựng du thuyền theo hạng. Mũi tàu hướng +Z để khớp với bộ điều khiển lái.
 */
export function makeYacht(tier: YachtTier, m: Mats): YachtBuild {
  const group = new THREE.Group();
  const ticks: TickFn[] = [];
  const p = paletteFor(tier);
  const length = YACHT_LENGTH[tier];
  const beam = 0.62 + tier * 0.19;

  /* ------------------------------ thân tàu ------------------------------ */
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(beam, length - beam * 2, 5, 14), p.hull);
  hull.rotation.x = Math.PI / 2;
  hull.scale.set(1, 0.46, 1);
  hull.position.y = 0.06;
  group.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(beam * 0.92, 1.0 + tier * 0.22, 10), p.hull);
  bow.rotation.x = Math.PI / 2;
  bow.scale.y = 0.46;
  bow.position.set(0, 0.06, length / 2 + 0.28);
  group.add(bow);

  const keel = box(beam * 1.5, 0.3, length * 0.92, m.stoneDark);
  keel.position.y = -0.26;
  group.add(keel);

  const deck = box(beam * 1.72, 0.12, length * 0.86, p.deck);
  deck.position.y = 0.3 + tier * 0.015;
  group.add(deck);

  /* mạn tàu có sọc trang trí từ hạng 3 */
  if (tier >= 3) {
    for (const side of [-1, 1]) {
      const stripe = box(0.05, 0.1, length * 0.8, p.trim);
      stripe.position.set(side * (beam * 0.86), 0.16, 0);
      group.add(stripe);
    }
  }

  /* ------------------------------ thượng tầng ------------------------------ */
  const decks = Math.min(3, Math.max(1, tier - 1));
  let deckTop = 0.36 + tier * 0.02;
  for (let level = 0; level < decks; level++) {
    const shrink = 1 - level * 0.2;
    const height = 0.5 + tier * 0.06 - level * 0.05;
    const cabin = box(beam * 1.5 * shrink, height, (length * 0.42 - level * 0.5) * shrink, p.glass);
    cabin.position.set(0, deckTop + height / 2, -0.3 - level * 0.24);
    group.add(cabin);
    const roof = box(beam * 1.66 * shrink, 0.09, (length * 0.46 - level * 0.5) * shrink, p.hull);
    roof.position.set(0, deckTop + height + 0.05, -0.3 - level * 0.24);
    group.add(roof);
    deckTop += height + 0.1;
  }

  /* lan can chạy dọc mạn */
  for (const side of [-1, 1]) {
    const rail = cyl(0.024, 0.024, length * 0.78, 6, p.trim);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * (beam * 0.92), 0.62, 0.2);
    group.add(rail);
    for (let i = 0; i < 3 + tier; i++) {
      const post = cyl(0.018, 0.018, 0.3, 5, p.trim);
      post.position.set(side * (beam * 0.92), 0.47, -length * 0.34 + (i / (2 + tier)) * length * 0.72);
      group.add(post);
    }
  }

  /* ------------------------------ cột và radar ------------------------------ */
  const mast = cyl(0.032, 0.04, 0.85 + tier * 0.25, 8, p.trim);
  mast.position.set(0, deckTop + (0.85 + tier * 0.25) / 2, -0.55);
  group.add(mast);

  if (tier >= 2) {
    const radar = new THREE.Mesh(new THREE.TorusGeometry(0.18 + tier * 0.035, 0.03, 8, 22), p.trim);
    radar.position.set(0, deckTop + 0.85 + tier * 0.25, -0.55);
    radar.rotation.x = Math.PI / 2;
    group.add(radar);
    ticks.push((_t, dt) => {
      radar.rotation.z += dt * 1.6;
    });
  }

  /* cờ hiệu phấp phới từ hạng 2 */
  if (tier >= 2) {
    const flagMaterial = new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.7, side: THREE.DoubleSide });
    const flag = box(0.52, 0.3, 0.02, flagMaterial);
    flag.position.set(0.28, deckTop + 0.7 + tier * 0.2, -0.55);
    group.add(flag);
    ticks.push((t) => {
      flag.rotation.y = Math.sin(t * 3.4) * 0.4;
      flag.scale.x = 1 + Math.sin(t * 4.1) * 0.08;
    });
  }

  /* ------------------------------ tiện nghi cao cấp ------------------------------ */
  if (tier >= 4) {
    /* sàn đỗ trực thăng ở mũi */
    const helipad = cyl(beam * 0.95, beam * 0.95, 0.08, 22, p.deck);
    helipad.position.set(0, 0.4, length * 0.28);
    group.add(helipad);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(beam * 0.62, 0.03, 6, 26), p.trim);
    padRing.rotation.x = Math.PI / 2;
    padRing.position.set(0, 0.46, length * 0.28);
    group.add(padRing);

    /* bể bơi phát sáng ở đuôi */
    const poolMaterial = new THREE.MeshStandardMaterial({ color: 0x0e5f6b, emissive: 0x2fbf83, emissiveIntensity: 0.55, roughness: 0.2 });
    const pool = box(beam * 0.9, 0.06, 0.9, poolMaterial);
    pool.position.set(0, 0.37, -length * 0.3);
    group.add(pool);
    ticks.push((t) => {
      poolMaterial.emissiveIntensity = 0.42 + Math.sin(t * 1.8) * 0.16;
    });
  }

  if (tier >= 5) {
    /* dải đèn vàng chạy dọc thân — dấu hiệu kỳ hạm */
    const stripMaterial = new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of [-1, 1]) {
      const strip = box(0.04, 0.05, length * 0.82, stripMaterial);
      strip.position.set(side * (beam * 1.0), 0.24, 0);
      group.add(strip);
    }
    ticks.push((t) => {
      stripMaterial.opacity = 0.6 + Math.sin(t * 2.2) * 0.25;
    });

    /* trực thăng đậu sẵn trên sàn */
    const heli = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 8), p.hull);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.24;
    heli.add(body);
    const tail = box(0.06, 0.06, 0.62, p.hull);
    tail.position.set(-0.44, 0.26, 0);
    tail.rotation.y = Math.PI / 2;
    heli.add(tail);
    const rotor = box(1.15, 0.02, 0.06, p.trim);
    rotor.position.y = 0.46;
    heli.add(rotor);
    const rotorB = rotor.clone();
    rotorB.rotation.y = Math.PI / 2;
    heli.add(rotorB);
    heli.position.set(0, 0.44, length * 0.28);
    heli.scale.setScalar(0.9);
    group.add(heli);
    ticks.push((_t, dt) => {
      rotor.rotation.y += dt * 1.1;
      rotorB.rotation.y += dt * 1.1;
    });

    /* đèn pha quét từ đài chỉ huy */
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff0c4,
      transparent: true,
      opacity: 0.075,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const spot = new THREE.Mesh(new THREE.ConeGeometry(1.5, 13, 12, 1, true), beamMaterial);
    spot.rotation.z = Math.PI / 2;
    spot.position.set(6.4, deckTop + 0.5, 0);
    const spotHolder = new THREE.Group();
    spotHolder.position.set(0, 0, -0.4);
    spotHolder.add(spot);
    group.add(spotHolder);
    ticks.push((_t, dt) => {
      spotHolder.rotation.y += dt * 0.42;
    });
  }

  /* ------------------------------ đèn hành trình ------------------------------ */
  const navLight = new THREE.PointLight(p.accent, 0.5 + tier * 0.2, 8 + tier * 2.4);
  navLight.position.set(0, 0.9 + tier * 0.14, length * 0.4);
  group.add(navLight);
  const sternLight = new THREE.PointLight(0xffd88a, 0.35 + tier * 0.16, 6 + tier * 1.8);
  sternLight.position.set(0, 0.55 + tier * 0.1, -length * 0.42);
  group.add(sternLight);
  ticks.push((t) => {
    navLight.intensity = (0.42 + tier * 0.18) + Math.sin(t * 2.3) * 0.1;
  });

  castAll(group);
  return {
    group,
    ticks,
    cameraHeight: 6 + tier * 0.9,
    cameraDistance: 11 + tier * 1.6,
    length,
  };
}
