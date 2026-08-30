import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DISTRICT_POS,
  ISLE_POSITIONS,
  ISLE_RADIUS,
  buildSpire,
  buildExchange,
  buildVault,
  buildAcademy,
  buildLighthouse,
  buildTerrain,
  buildPaths,
  buildGate,
  buildIsle,
  buildIsleGhost,
  makeTree,
  makeRock,
  makeCloud,
  makeSky,
  makeSunSprite,
  makeWater,
  makeDust,
  makeBurstPool,
  makeMats,
  makePerson,
  makeBoat,
  makeYacht,
  makeBird,
  makeLamp,
  makeDecor,
  DECOR_IDS,
} from "./build";
import type { TickFn, Mats, DecorId } from "./build";
import { DISTRICTS, ISLE_UNLOCK_LEVELS, VISUAL_MAX } from "../state/store";
import type { DistrictId, ViewId, IslandTheme } from "../state/store";
import { makeT } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import { sound } from "../lib/audio";

export interface WorldHandle {
  fireBurst(view: ViewId, kind: "gold" | "jade"): void;
}

export interface IslandWorldState {
  unlocked: boolean;
  level: number;
  decor: string[];
  theme: IslandTheme;
}

export interface HelmInput {
  throttle: number;
  turn: number;
}

interface Props {
  levels: Record<DistrictId, number>;
  selected: ViewId;
  onSelect: (view: ViewId, island?: DistrictId) => void;
  handleRef: React.MutableRefObject<WorldHandle | null>;
  lang: Lang;
  islands: Record<DistrictId, IslandWorldState>;
  activeIsle: DistrictId;
  voyage: boolean;
  helmInput: HelmInput;
}

const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

type Builder = (level: number, m: Mats, ticks: TickFn[]) => THREE.Group;
const BUILDERS: Record<DistrictId, Builder> = {
  crypto: buildSpire,
  stocks: buildExchange,
  vault: buildVault,
  academy: buildAcademy,
};

const LABEL_HEIGHT: Record<string, (lv: number) => number> = {
  crypto: (lv) => 5 + lv * 1.2,
  stocks: () => 7.2,
  vault: (lv) => 5 + lv * 0.3,
  academy: (lv) => 6 + lv * 0.5,
  center: () => 11.5,
  isle: () => 6.5,
};

function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function viewPose(view: ViewId, activeIsle: DistrictId = "crypto"): { pos: THREE.Vector3; target: THREE.Vector3 } {
  if (view === "overview") {
    return { pos: new THREE.Vector3(54, 39, 64), target: new THREE.Vector3(0, 1.2, 6) };
  }
  if (view === "center") {
    return { pos: new THREE.Vector3(11.5, 8, 13.5), target: new THREE.Vector3(0, 3.6, 0) };
  }
  if (view === "isle") {
    const islePos = ISLE_POSITIONS[activeIsle];
    const dir = islePos.clone().setY(0).normalize();
    return {
      pos: islePos.clone().add(dir.multiplyScalar(11)).add(new THREE.Vector3(0, 8.5, 6)),
      target: islePos.clone().add(new THREE.Vector3(0, 1.6, 0)),
    };
  }
  const a = DISTRICT_POS[view];
  const dir = a.clone().setY(0).normalize();
  return {
    pos: a.clone().add(dir.multiplyScalar(13.5)).add(new THREE.Vector3(0, 10, 0)),
    target: a.clone().add(new THREE.Vector3(0, 2.4, 0)),
  };
}

export default function WorldScene({ levels, selected, onSelect, handleRef, lang, islands, activeIsle, voyage, helmInput }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const propsRef = useRef({ levels, selected, onSelect, lang, islands, activeIsle, voyage, helmInput });
  propsRef.current = { levels, selected, onSelect, lang, islands, activeIsle, voyage, helmInput };

  const sceneApi = useRef<{
    flyTo: (view: ViewId, dur?: number) => void;
    rebuildDistrict: (d: DistrictId) => void;
    rebuildIsle: (district: DistrictId) => void;
    rebuildDecor: (district: DistrictId) => void;
    syncIslands: () => void;
    setVoyage: (active: boolean) => void;
    burst: (view: ViewId, kind: "gold" | "jade") => void;
  } | null>(null);

  const prevLevels = useRef<Record<DistrictId, number> | null>(null);
  const prevIslands = useRef<Record<DistrictId, string> | null>(null);

  /* ------------------------- mount scene once ------------------------- */
  useEffect(() => {
    const containerMaybe = containerRef.current;
    if (!containerMaybe) return;
    const container: HTMLDivElement = containerMaybe;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compactGpu = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    const maxPixelRatio = compactGpu ? 1.15 : 1.6;
    let renderPixelRatio = Math.min(window.devicePixelRatio, maxPixelRatio);
    const renderer = new THREE.WebGLRenderer({ antialias: !compactGpu, powerPreference: "high-performance" });
    renderer.setPixelRatio(renderPixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", lang === "vi" ? "Bản đồ quần đảo tài chính 3D tương tác" : "Interactive 3D finance archipelago");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08222b, 0.011);

    const camera = new THREE.PerspectiveCamera(46, Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight)), 0.1, 900);
    camera.position.set(4, 85, 140);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 9;
    controls.maxDistance = 120;
    controls.maxPolarAngle = 1.42;
    controls.minPolarAngle = 0.12;
    controls.autoRotateSpeed = 0.4;
    controls.target.set(0, 1.2, 0);

    let userInteracting = false;
    let idleTimer = 0;
    const onCtlStart = () => {
      userInteracting = true;
      window.clearTimeout(idleTimer);
    };
    const onCtlEnd = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        userInteracting = false;
      }, 4500);
    };
    controls.addEventListener("start", onCtlStart);
    controls.addEventListener("end", onCtlEnd);

    /* ------------------------------ lights ------------------------------ */
    const hemi = new THREE.HemisphereLight(0x9fd4cf, 0x1c2a2c, 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.0);
    sun.position.set(-42, 52, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(compactGpu ? 1024 : 2048, compactGpu ? 1024 : 2048);
    sun.shadow.camera.left = -46;
    sun.shadow.camera.right = 46;
    sun.shadow.camera.top = 46;
    sun.shadow.camera.bottom = -46;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x5ce8c4, 0.5);
    rim.position.set(38, 18, 42);
    scene.add(rim);

    /* ------------------------------ world ------------------------------ */
    const m = makeMats();
    const staticTicks: TickFn[] = [];

    const sky = makeSky();
    scene.add(sky);
    const sunSprite = makeSunSprite();
    scene.add(sunSprite);
    const water = makeWater();
    scene.add(water.mesh);
    staticTicks.push(water.tick);
    const dust = makeDust();
    scene.add(dust.points);
    staticTicks.push(dust.tick);

    let lastDayMinute = -1;
    function applyDaylight() {
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes();
      if (minute === lastDayMinute) return;
      lastDayMinute = minute;
      const hour = minute / 60;
      const solar = Math.sin(((hour - 6) / 12) * Math.PI);
      const daylight = THREE.MathUtils.smoothstep(solar, -0.12, 0.42);
      const dusk = Math.max(0, 1 - Math.min(1, Math.abs(solar) * 3.2));
      const azimuth = ((hour - 12) / 24) * Math.PI * 2;
      sun.position.set(Math.cos(azimuth) * 85, 8 + Math.max(0, solar) * 74, Math.sin(azimuth) * 85);
      sun.intensity = 0.22 + daylight * 2.05;
      sun.color.copy(new THREE.Color(0xff9a63)).lerp(new THREE.Color(0xffe2bd), daylight);
      hemi.intensity = 0.24 + daylight * 0.52;
      rim.intensity = 0.24 + (1 - daylight) * 0.42;
      renderer.toneMappingExposure = 0.84 + daylight * 0.34;
      const fogColor = new THREE.Color(0x06141f).lerp(new THREE.Color(0x174751), daylight * 0.72);
      (scene.fog as THREE.FogExp2).color.copy(fogColor);
      const skyMat = sky.material as THREE.ShaderMaterial;
      skyMat.uniforms.uDaylight.value = daylight;
      skyMat.uniforms.uDusk.value = dusk;
      const waterMat = water.mesh.material as THREE.ShaderMaterial;
      waterMat.uniforms.uDaylight.value = daylight;
      waterMat.uniforms.uFog.value.copy(fogColor);
      sunSprite.position.copy(sun.position).multiplyScalar(2.2);
      (sunSprite.material as THREE.SpriteMaterial).opacity = 0.12 + daylight * 0.58;
    }
    applyDaylight();

    scene.add(buildTerrain());
    scene.add(buildPaths(m));
    scene.add(buildGate(m));

    const lighthouse = buildLighthouse(m, staticTicks);
    lighthouse.position.copy(DISTRICT_POS.center);
    lighthouse.userData.tag = "center";
    scene.add(lighthouse);

    /* district groups */
    const districtGroups = {} as Record<DistrictId, THREE.Group>;
    const districtTicks = {} as Record<DistrictId, TickFn[]>;
    for (const d of DISTRICT_IDS) {
      const holder = new THREE.Group();
      holder.position.copy(DISTRICT_POS[d]);
      holder.userData.tag = d;
      scene.add(holder);
      districtGroups[d] = holder;
      districtTicks[d] = [];
    }

    function rebuildDistrict(d: DistrictId) {
      const holder = districtGroups[d];
      disposeGroup(holder);
      districtTicks[d] = [];
      const lv = Math.min(propsRef.current.levels[d], VISUAL_MAX);
      const g = BUILDERS[d](lv, m, districtTicks[d]);
      holder.add(g);
    }
    for (const d of DISTRICT_IDS) rebuildDistrict(d);

    /* scenery: trees, rocks, lamps */
    const scenery = new THREE.Group();
    const treeSpots: [number, number, number][] = [
      [18, 3, 1.2], [-17.5, 4, 1.05], [16, -13, 0.9], [-16, -13.5, 1.15], [5.5, 15, 1.0],
      [-5.5, 15.5, 0.85], [19.5, -4, 0.8], [-19.5, -4.5, 0.95], [0.5, -16.5, 1.1], [-8, -17, 0.8],
      [8.5, -17.5, 0.9], [13, 12.5, 0.95], [-13, 12.5, 1.05], [21, 9, 0.85], [-21, 9.5, 0.9],
    ];
    for (const [x, z, s] of treeSpots) {
      const tree = makeTree(m, s, Math.random() > 0.5 ? m.leaves1 : m.leaves2);
      tree.position.set(x, 0, z);
      tree.rotation.y = x * z;
      scenery.add(tree);
    }
    const rockSpots: [number, number, number][] = [
      [22.5, -6, 1.3], [-23, -5, 1.1], [20, 14, 0.9], [-20, 14.5, 1.2], [3, 21.5, 1.0],
      [-4, 22, 0.8], [24, 2, 0.7], [-24.5, 1, 0.9], [10, -21, 1.1], [-10, -21.5, 0.8],
    ];
    for (const [x, z, s] of rockSpots) {
      const rock = makeRock(m, s);
      rock.position.set(x, 0.1, z);
      rock.rotation.y = x + z;
      scenery.add(rock);
    }
    for (const d of DISTRICT_IDS) {
      const a = DISTRICT_POS[d];
      const len = Math.sqrt(a.x * a.x + a.z * a.z);
      const px = a.x * 0.72 + (-a.z / len) * 1.6;
      const pz = a.z * 0.72 + (a.x / len) * 1.6;
      const lamp = makeLamp(m);
      lamp.position.set(px, 0, pz);
      scenery.add(lamp);
    }
    scene.add(scenery);

    /* clouds */
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 7; i++) {
      const c = makeCloud();
      const a = (i / 7) * Math.PI * 2;
      const r = 88 + Math.random() * 52;
      c.position.set(Math.cos(a) * r, 45 + Math.random() * 18, Math.sin(a) * r);
      c.scale.setScalar(1.35 + Math.random() * 1.25);
      scene.add(c);
      clouds.push(c);
    }
    staticTicks.push((t, dt) => {
      clouds.forEach((c, i) => {
        c.position.x += dt * (0.4 + i * 0.06);
        if (c.position.x > 150) c.position.x = -150;
        c.position.y += Math.sin(t * 0.3 + i) * 0.003;
      });
    });

    /* --------------------------- living world --------------------------- */
    const shirtColors = [0x5ce8c4, 0xe0aa50, 0xff7f6e, 0x9fd0ff, 0xdde9e4, 0xf0c268, 0x7fe8bb, 0xd9a066, 0x8ba4a7, 0xffd88a];
    interface Walker {
      p: ReturnType<typeof makePerson>;
      mode: "ring" | "path";
      r: number;
      speed: number;
      phase: number;
      axis?: THREE.Vector3;
      pathLen?: number;
      island?: DistrictId;
    }
    const walkers: Walker[] = [];
    for (let i = 0; i < 8; i++) {
      const p = makePerson(shirtColors[i % shirtColors.length]);
      p.group.scale.setScalar(0.95 + Math.random() * 0.15);
      scene.add(p.group);
      if (i < 5) {
        walkers.push({ p, mode: "ring", r: 6.6 + Math.random() * 2.4, speed: (0.12 + Math.random() * 0.1) * (i % 2 ? 1 : -1), phase: Math.random() * Math.PI * 2 });
      } else {
        const d = DISTRICT_IDS[i - 5];
        walkers.push({ p, mode: "path", r: 0, speed: 0.16 + Math.random() * 0.08, phase: Math.random() * 10, axis: DISTRICT_POS[d].clone().setY(0).normalize(), pathLen: DISTRICT_POS[d].length() - 5 });
      }
    }
    const isleWalkers: Walker[] = [];
    DISTRICT_IDS.forEach((district, i) => {
      const p = makePerson(shirtColors[(i + 4) % shirtColors.length]);
      p.group.scale.setScalar(1.0);
      p.group.visible = propsRef.current.islands[district].unlocked;
      scene.add(p.group);
      isleWalkers.push({ p, mode: "ring", r: 4.8, speed: (0.14 + i * 0.025) * (i % 2 ? 1 : -1), phase: i * 1.7, island: district });
    });

    const boats = [
      { g: makeBoat(m), r: 34, speed: 0.05, phase: 0.8 },
      { g: makeBoat(m), r: 41, speed: -0.034, phase: 3.6 },
    ];
    boats.forEach((b) => scene.add(b.g));

    const birds: (ReturnType<typeof makeBird> & { r: number; h: number; speed: number; phase: number })[] = [];
    for (let i = 0; i < 5; i++) {
      const b = makeBird();
      scene.add(b.group);
      birds.push({ ...b, r: 17 + Math.random() * 10, h: 10 + Math.random() * 6, speed: 0.22 + Math.random() * 0.16, phase: Math.random() * Math.PI * 2 });
    }

    staticTicks.push((t) => {
      for (const w of walkers) {
        const { p } = w;
        if (w.mode === "ring") {
          const a = w.phase + t * w.speed;
          p.group.position.set(Math.cos(a) * w.r, 0.02 + Math.abs(Math.sin(t * 7 + w.phase)) * 0.05, Math.sin(a) * w.r);
          p.group.rotation.y = -a + (w.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
        } else if (w.axis && w.pathLen) {
          const k = (Math.sin(t * w.speed + w.phase) + 1) / 2;
          const dist = 3.5 + k * w.pathLen;
          p.group.position.copy(w.axis).multiplyScalar(dist);
          p.group.position.y = 0.02;
          const forward = Math.cos(t * w.speed + w.phase) > 0;
          p.group.rotation.y = Math.atan2(w.axis.x, w.axis.z) + (forward ? 0 : Math.PI);
        }
        const sw = Math.sin(t * 8 + w.phase) * 0.55;
        p.legL.rotation.x = sw;
        p.legR.rotation.x = -sw;
      }
      for (const w of isleWalkers) {
        if (!w.p.group.visible) continue;
        const islePos = ISLE_POSITIONS[w.island ?? "crypto"];
        const a = w.phase + t * w.speed;
        w.p.group.position.set(islePos.x + Math.cos(a) * w.r, 0.55, islePos.z + Math.sin(a) * w.r);
        w.p.group.rotation.y = -a + (w.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
        const sw = Math.sin(t * 8 + w.phase) * 0.5;
        w.p.legL.rotation.x = sw;
        w.p.legR.rotation.x = -sw;
      }
      for (const b of boats) {
        const a = b.phase + t * b.speed;
        b.g.position.set(Math.cos(a) * b.r, -1.25 + Math.sin(t * 1.2 + b.phase) * 0.1, Math.sin(a) * b.r);
        b.g.rotation.y = -a + (b.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
        b.g.rotation.z = Math.sin(t * 1.4 + b.phase) * 0.04;
      }
      for (const b of birds) {
        const a = b.phase + t * b.speed;
        b.group.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 0.8 + b.phase) * 1.2, Math.sin(a) * b.r);
        b.group.rotation.y = -a - Math.PI / 2;
        const flap = Math.sin(t * 9 + b.phase) * 0.85;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;
      }
    });

    /* ---------------------------- personal isles ---------------------------- */
    const ghostGroups = {} as Record<DistrictId, ReturnType<typeof buildIsleGhost>>;
    const isleGroups = {} as Record<DistrictId, THREE.Group>;
    const decorGroups = {} as Record<DistrictId, THREE.Group>;
    const isleTicks = {} as Record<DistrictId, TickFn[]>;
    const decorTicks = {} as Record<DistrictId, TickFn[]>;

    for (const district of DISTRICT_IDS) {
      const island = propsRef.current.islands[district];
      const ghost = buildIsleGhost(island.theme);
      ghost.group.position.copy(ISLE_POSITIONS[district]);
      ghost.group.userData.tag = `isle:${district}`;
      scene.add(ghost.group);
      ghostGroups[district] = ghost;
      staticTicks.push((t, dt) => {
        if (ghost.group.visible) ghost.tick(t, dt);
      });

      const holder = new THREE.Group();
      holder.position.copy(ISLE_POSITIONS[district]);
      holder.userData.tag = `isle:${district}`;
      scene.add(holder);
      isleGroups[district] = holder;
      isleTicks[district] = [];

      const decorHolder = new THREE.Group();
      decorHolder.position.copy(ISLE_POSITIONS[district]);
      scene.add(decorHolder);
      decorGroups[district] = decorHolder;
      decorTicks[district] = [];
    }

    function rebuildIsle(district: DistrictId) {
      const holder = isleGroups[district];
      disposeGroup(holder);
      isleTicks[district] = [];
      const island = propsRef.current.islands[district];
      if (island.unlocked) holder.add(buildIsle(m, island.level, isleTicks[district], district, island.theme));
    }

    function rebuildDecor(district: DistrictId) {
      const holder = decorGroups[district];
      disposeGroup(holder);
      decorTicks[district] = [];
      const island = propsRef.current.islands[district];
      if (!island.unlocked) return;
      for (const id of DECOR_IDS) {
        if (island.decor.includes(id)) holder.add(makeDecor(id as DecorId, m, decorTicks[district]));
      }
    }

    function syncIslands() {
      for (const district of DISTRICT_IDS) {
        const unlocked = propsRef.current.islands[district].unlocked;
        ghostGroups[district].group.visible = !unlocked;
        isleGroups[district].visible = unlocked;
        decorGroups[district].visible = unlocked;
        const walker = isleWalkers.find((candidate) => candidate.island === district);
        if (walker) walker.p.group.visible = unlocked;
      }
    }

    for (const district of DISTRICT_IDS) {
      rebuildIsle(district);
      rebuildDecor(district);
    }
    syncIslands();

    /* ---------------------------- player yacht ---------------------------- */
    const yacht = makeYacht(m);
    yacht.position.set(0, -1.02, 31.5);
    yacht.visible = propsRef.current.voyage;
    scene.add(yacht);
    let yachtHeading = 0;
    let yachtSpeed = 0;
    let wakeCooldown = 0;
    const heldKeys = new Set<string>();
    const wakes = Array.from({ length: 14 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({ color: index % 2 ? 0xc9f4ef : 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.34, 16), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -1.36;
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, life: 0 };
    });
    let wakeCursor = 0;
    function emitWake() {
      const wake = wakes[wakeCursor];
      wakeCursor = (wakeCursor + 1) % wakes.length;
      wake.life = 1;
      wake.mesh.visible = true;
      wake.mesh.position.set(
        yacht.position.x - Math.sin(yachtHeading) * 2.2,
        -1.35,
        yacht.position.z - Math.cos(yachtHeading) * 2.2
      );
      wake.mesh.scale.setScalar(0.65);
    }
    function onKey(e: KeyboardEvent, down: boolean) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) return;
      if (propsRef.current.voyage) e.preventDefault();
      if (down) heldKeys.add(e.code);
      else heldKeys.delete(e.code);
    }
    const onKeyDown = (event: KeyboardEvent) => onKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    /* ------------------------------ bursts ------------------------------ */
    const burst = makeBurstPool(scene);
    staticTicks.push(burst.tick);

    /* ------------------------------ camera tween ------------------------------ */
    let tween: { t0: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3 } | null = null;
    function flyTo(view: ViewId, dur = 1.6) {
      const { pos, target } = viewPose(view, propsRef.current.activeIsle);
      tween = {
        t0: performance.now(),
        dur: dur * 1000,
        fromPos: camera.position.clone(),
        toPos: pos,
        fromTgt: controls.target.clone(),
        toTgt: target,
      };
      sound.whoosh();
    }

    function setVoyage(active: boolean) {
      yacht.visible = active;
      yachtSpeed = 0;
      heldKeys.clear();
      controls.minDistance = active ? 6 : 9;
      controls.maxDistance = active ? 32 : 120;
      if (active) {
        const target = yacht.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const behind = new THREE.Vector3(-Math.sin(yachtHeading) * 13, 8, -Math.cos(yachtHeading) * 13);
        tween = {
          t0: performance.now(),
          dur: reduceMotion ? 250 : 1200,
          fromPos: camera.position.clone(),
          toPos: yacht.position.clone().add(behind),
          fromTgt: controls.target.clone(),
          toTgt: target,
        };
      }
    }

    /* ------------------------------ picking ------------------------------ */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;
    const downPos = { x: 0, y: 0 };

    function pickAt(cx: number, cy: number): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -((cy - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets: THREE.Object3D[] = [
        lighthouse,
        ...DISTRICT_IDS.map((d) => districtGroups[d] as THREE.Object3D),
        ...DISTRICT_IDS.map((d) => isleGroups[d] as THREE.Object3D),
        ...DISTRICT_IDS.map((d) => ghostGroups[d].group as THREE.Object3D),
      ];
      const hits = raycaster.intersectObjects(targets, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData.tag) return o.userData.tag as string;
          o = o.parent;
        }
      }
      return null;
    }

    function onPointerMove(e: PointerEvent) {
      const tag = pickAt(e.clientX, e.clientY);
      if (tag !== hovered) {
        hovered = tag;
        renderer.domElement.style.cursor = tag ? "pointer" : "grab";
      }
      const tip = tooltipRef.current;
      if (tip) {
        if (tag) {
          tip.style.opacity = "1";
          tip.style.transform = `translate(${e.clientX - container.getBoundingClientRect().left + 14}px, ${e.clientY - container.getBoundingClientRect().top + 10}px)`;
        } else {
          tip.style.opacity = "0";
        }
      }
    }
    function onPointerDown(e: PointerEvent) {
      downPos.x = e.clientX;
      downPos.y = e.clientY;
    }
    function onPointerUp(e: PointerEvent) {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      if (dx * dx + dy * dy > 36) return;
      const tag = pickAt(e.clientX, e.clientY);
      if (tag) {
        sound.tick();
        if (tag.startsWith("isle:")) propsRef.current.onSelect("isle", tag.slice(5) as DistrictId);
        else propsRef.current.onSelect(tag as ViewId);
      }
    }
    function onPointerLeave() {
      hovered = null;
      if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    }
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    /* ------------------------------ labels ------------------------------ */
    const labelIds = [...DISTRICT_IDS, "center", ...DISTRICT_IDS.map((district) => `isle:${district}`)];
    const tmpV = new THREE.Vector3();
    const labelTextCache: Record<string, string> = {};

    function labelText(id: string): string {
      const t = makeT(propsRef.current.lang);
      if (id === "center") return t("nav.center");
      if (id.startsWith("isle:")) {
        const district = id.slice(5) as DistrictId;
        const island = propsRef.current.islands[district];
        return island.unlocked
          ? `${t(`ct.isle.${district}`)} · ${t("misc.levelShort", { n: island.level })}`
          : `${t(`ct.isle.${district}`)} · ${t("misc.levelShort", { n: ISLE_UNLOCK_LEVELS[district] })}`;
      }
      const lv = propsRef.current.levels[id as DistrictId];
      return `${t(`d.${id}.building`)} · ${t("misc.levelShort", { n: lv })}`;
    }

    function updateLabels() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const id of labelIds) {
        const el = labelEls.current[id];
        if (!el) continue;
        const islandId = id.startsWith("isle:") ? (id.slice(5) as DistrictId) : null;
        const base = islandId ? ISLE_POSITIONS[islandId] : DISTRICT_POS[id];
        const lv = id === "center" || islandId ? 0 : propsRef.current.levels[id as DistrictId];
        const height = islandId ? LABEL_HEIGHT.isle(lv) : LABEL_HEIGHT[id](lv);
        tmpV.set(base.x, base.y + height + 1.2, base.z);
        tmpV.project(camera);
        const behind = tmpV.z > 1;
        const x = (tmpV.x * 0.5 + 0.5) * w;
        const y = (-tmpV.y * 0.5 + 0.5) * h;
        const off = behind || x < -80 || x > w + 80 || y < -40 || y > h + 40;
        el.style.opacity = off ? "0" : "1";
        el.style.transform = `translate(-50%, -110%) translate(${x}px, ${y}px)`;
        const txt = labelText(id);
        if (labelTextCache[id] !== txt) {
          labelTextCache[id] = txt;
          const txtEl = el.querySelector("[data-label-txt]");
          if (txtEl) txtEl.textContent = txt;
        }
        el.classList.toggle("label-locked", Boolean(islandId && !propsRef.current.islands[islandId].unlocked));
        el.classList.toggle("label-active", islandId ? propsRef.current.selected === "isle" && propsRef.current.activeIsle === islandId : propsRef.current.selected === id);
      }
    }

    /* ------------------------------ tooltip content ------------------------------ */
    function updateTooltipContent() {
      const tip = tooltipRef.current;
      if (!tip || !hovered) return;
      const t = makeT(propsRef.current.lang);
      if (hovered.startsWith("isle:")) {
        const district = hovered.slice(5) as DistrictId;
        const island = propsRef.current.islands[district];
        tip.innerHTML = island.unlocked
          ? `<strong>${t(`ct.isle.${district}`)}</strong><span>${t("ws.lvl", { n: island.level })}</span>`
          : `<strong>${t("il.locked")}</strong><span>${t("ct.isle.unlockAt", { n: ISLE_UNLOCK_LEVELS[district] })}</span>`;
        return;
      }
      if (hovered === "center") {
        tip.innerHTML = `<strong>${t("ct.title")}</strong><span>${t("ct.sub")}</span>`;
        return;
      }
      const d = hovered as DistrictId;
      tip.innerHTML = `<strong>${t(`d.${d}.building`)}</strong><span>${t(`d.${d}.tagline`)}</span><span class="tt-lv">${t("ws.lvl", { n: propsRef.current.levels[d] })}</span>`;
    }

    /* ------------------------------ resize ------------------------------ */
    function onResize() {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    /* ------------------------------ API ------------------------------ */
    sceneApi.current = {
      flyTo,
      rebuildDistrict,
      rebuildIsle,
      rebuildDecor,
      syncIslands,
      setVoyage,
      burst: (view, kind) => {
        const origin =
          view === "isle"
            ? ISLE_POSITIONS[propsRef.current.activeIsle].clone().add(new THREE.Vector3(0, 3, 0))
            : view === "overview"
              ? new THREE.Vector3(0, 5, 0)
              : DISTRICT_POS[view].clone().add(new THREE.Vector3(0, 4.5, 0));
        burst.fire(origin, kind);
      },
    };
    handleRef.current = {
      fireBurst: (view, kind) => sceneApi.current?.burst(view, kind),
    };
    if (propsRef.current.voyage) setVoyage(true);

    /* ------------------------------ loop ------------------------------ */
    const clock = new THREE.Clock();
    let raf = 0;
    const introPose = viewPose("overview");
    const introStart = performance.now();
    const introFrom = camera.position.clone();
    const introTargetFrom = new THREE.Vector3(0, 20, 0);
    let introDone = false;
    let labelClock = 0;
    let perfFrames = 0;
    let perfTime = 0;
    const desiredYachtTarget = new THREE.Vector3();
    const followDelta = new THREE.Vector3();
    const nextYachtPosition = new THREE.Vector3();

    function yachtPositionAllowed(position: THREE.Vector3): boolean {
      if (Math.hypot(position.x, position.z) < 29.2) return false;
      for (const district of DISTRICT_IDS) {
        if (position.distanceToSquared(ISLE_POSITIONS[district]) < Math.pow(ISLE_RADIUS + 2.1, 2)) return false;
      }
      return Math.hypot(position.x, position.z) < 112;
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      const rawDt = clock.getDelta();
      const dt = Math.min(0.05, rawDt);
      const t = clock.elapsedTime;
      applyDaylight();

      perfFrames++;
      perfTime += rawDt * 1000;
      if (perfFrames >= 120) {
        const averageFrame = perfTime / perfFrames;
        let nextRatio = renderPixelRatio;
        if (averageFrame > 22 && renderPixelRatio > 0.85) nextRatio = Math.max(0.85, renderPixelRatio - 0.15);
        else if (averageFrame < 15 && renderPixelRatio < maxPixelRatio) nextRatio = Math.min(maxPixelRatio, renderPixelRatio + 0.1);
        if (Math.abs(nextRatio - renderPixelRatio) > 0.01) {
          renderPixelRatio = nextRatio;
          renderer.setPixelRatio(renderPixelRatio);
          renderer.setSize(container.clientWidth, container.clientHeight, false);
          renderer.domElement.dataset.quality = renderPixelRatio < 1 ? "balanced" : "high";
        }
        perfFrames = 0;
        perfTime = 0;
      }

      if (!introDone) {
        const k = Math.min(1, (performance.now() - introStart) / (reduceMotion ? 300 : 2600));
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(introFrom, introPose.pos, e);
        controls.target.lerpVectors(introTargetFrom, introPose.target, e);
        if (k >= 1) introDone = true;
      } else if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / tween.dur);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
        controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e);
        if (k >= 1) tween = null;
      }

      if (propsRef.current.voyage) {
        const keyboardThrottle = heldKeys.has("ArrowUp") || heldKeys.has("KeyW") ? 1 : heldKeys.has("ArrowDown") || heldKeys.has("KeyS") ? -1 : 0;
        const keyboardTurn = heldKeys.has("ArrowLeft") || heldKeys.has("KeyA") ? -1 : heldKeys.has("ArrowRight") || heldKeys.has("KeyD") ? 1 : 0;
        const throttle = THREE.MathUtils.clamp(keyboardThrottle + propsRef.current.helmInput.throttle, -1, 1);
        const turn = THREE.MathUtils.clamp(keyboardTurn + propsRef.current.helmInput.turn, -1, 1);
        const targetSpeed = throttle > 0 ? throttle * 7.2 : throttle < 0 ? throttle * 3.2 : 0;
        yachtSpeed = THREE.MathUtils.damp(yachtSpeed, targetSpeed, throttle === 0 ? 2.7 : 1.9, dt);
        yachtHeading -= turn * dt * (0.7 + Math.abs(yachtSpeed) * 0.075) * (yachtSpeed < 0 ? -1 : 1);
        nextYachtPosition.copy(yacht.position);
        nextYachtPosition.x += Math.sin(yachtHeading) * yachtSpeed * dt;
        nextYachtPosition.z += Math.cos(yachtHeading) * yachtSpeed * dt;
        if (yachtPositionAllowed(nextYachtPosition)) yacht.position.copy(nextYachtPosition);
        else yachtSpeed *= -0.18;
        yacht.position.y = -1.02 + Math.sin(t * 1.65) * 0.075;
        yacht.rotation.set(Math.sin(t * 1.3) * 0.025, yachtHeading, -turn * 0.07 - Math.sin(t * 1.1) * 0.018);
        wakeCooldown -= dt;
        if (Math.abs(yachtSpeed) > 0.8 && wakeCooldown <= 0) {
          emitWake();
          wakeCooldown = THREE.MathUtils.clamp(0.24 - Math.abs(yachtSpeed) * 0.018, 0.09, 0.22);
        }
        if (!tween) {
          desiredYachtTarget.set(yacht.position.x, yacht.position.y + 1.15, yacht.position.z);
          followDelta.subVectors(desiredYachtTarget, controls.target).multiplyScalar(1 - Math.exp(-dt * 5));
          controls.target.add(followDelta);
          camera.position.add(followDelta);
        }
      }
      for (const wake of wakes) {
        if (wake.life <= 0) continue;
        wake.life -= dt * 0.72;
        if (wake.life <= 0) {
          wake.mesh.visible = false;
          continue;
        }
        wake.mesh.scale.multiplyScalar(1 + dt * 1.25);
        (wake.mesh.material as THREE.MeshBasicMaterial).opacity = wake.life * 0.34;
      }

      controls.autoRotate = !propsRef.current.voyage && propsRef.current.selected === "overview" && !tween && !userInteracting && introDone && !reduceMotion;
      controls.update();

      for (const fn of staticTicks) fn(t, dt);
      for (const d of DISTRICT_IDS) for (const fn of districtTicks[d]) fn(t, dt);
      for (const district of DISTRICT_IDS) for (const fn of isleTicks[district]) fn(t, dt);
      for (const district of DISTRICT_IDS) for (const fn of decorTicks[district]) fn(t, dt);

      labelClock += dt;
      if (labelClock >= 1 / 30) {
        labelClock = 0;
        updateLabels();
        updateTooltipContent();
      }
      renderer.render(scene, camera);
    }
    frame();

    /* ------------------------------ cleanup ------------------------------ */
    return () => {
      window.clearTimeout(idleTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      controls.removeEventListener("start", onCtlStart);
      controls.removeEventListener("end", onCtlEnd);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
      sceneApi.current = null;
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- reactive effects ------------------------- */

  useEffect(() => {
    if (!sceneApi.current || voyage) return;
    sceneApi.current.flyTo(selected, selected === "overview" ? 2.0 : 1.5);
  }, [selected, activeIsle, voyage]);

  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    const prev = prevLevels.current;
    for (const d of DISTRICT_IDS) {
      if (prev && prev[d] !== levels[d]) {
        api.rebuildDistrict(d);
        if (levels[d] > prev[d]) {
          api.burst(d, d === "crypto" ? "jade" : "gold");
          sound.levelUp();
        }
      } else if (!prev) {
        api.rebuildDistrict(d);
      }
    }
    prevLevels.current = { ...levels };
  }, [levels]);

  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    const previous = prevIslands.current;
    const next = {} as Record<DistrictId, string>;
    for (const district of DISTRICT_IDS) {
      const island = islands[district];
      const structural = `${island.unlocked}:${island.level}:${island.theme}`;
      const decorKey = island.decor.join(",");
      const key = `${structural}|${decorKey}`;
      next[district] = key;
      const old = previous?.[district] ?? "";
      const [oldStructural, oldDecor = ""] = old.split("|");
      if (oldStructural !== structural) api.rebuildIsle(district);
      if (oldDecor !== decorKey || oldStructural !== structural) api.rebuildDecor(district);
      if (previous && !old.startsWith("true:") && island.unlocked) {
        if (activeIsle === district) api.burst("isle", "jade");
        sound.levelUp();
      }
    }
    api.syncIslands();
    prevIslands.current = next;
  }, [islands, activeIsle]);

  useEffect(() => {
    sceneApi.current?.setVoyage(voyage);
  }, [voyage]);

  /* ------------------------------ render ------------------------------ */
  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        ref={tooltipRef}
        className="chip pointer-events-none absolute left-0 top-0 z-30 rounded-md px-2.5 py-1.5 text-[11px] leading-tight opacity-0 transition-opacity duration-150"
        style={{ opacity: 0 }}
      />
      {[...DISTRICT_IDS, "center", ...DISTRICT_IDS.map((district) => `isle:${district}`)].map((id) => {
        const islandId = id.startsWith("isle:") ? (id.slice(5) as DistrictId) : null;
        const accent = id === "center" ? "#f0c268" : islandId ? DISTRICTS[islandId].accent : DISTRICTS[id as DistrictId].accent;
        return (
          <div key={id} ref={(el) => void (labelEls.current[id] = el)} className="world-label left-0 top-0 z-20" style={{ opacity: 0 }}>
            <span className="chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[9px] tracking-[0.14em] text-mist-300">
              <span className="h-1.5 w-1.5 rotate-45" style={{ background: accent }} />
              <span data-label-txt="" />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function disposeGroup(g: THREE.Group) {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const child = g.children[i];
    child.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (!material.userData.shared) material.dispose();
        }
      }
    });
    g.remove(child);
  }
}
