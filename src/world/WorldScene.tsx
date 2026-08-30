import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DISTRICT_POS,
  ISLE_POS,
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
  makeBird,
  makeLamp,
  makeDecor,
  DECOR_IDS,
} from "./build";
import type { TickFn, Mats, DecorId } from "./build";
import { DISTRICTS, ISLE_UNLOCK_LV, VISUAL_MAX } from "../state/store";
import type { DistrictId, ViewId } from "../state/store";
import { makeT } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import { sound } from "../lib/audio";

export interface WorldHandle {
  fireBurst(view: ViewId, kind: "gold" | "jade"): void;
}

interface Props {
  levels: Record<DistrictId, number>;
  selected: ViewId;
  onSelect: (view: ViewId) => void;
  handleRef: React.MutableRefObject<WorldHandle | null>;
  lang: Lang;
  decor: string[];
  isleUnlocked: boolean;
  isleLevel: number;
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

function viewPose(view: ViewId): { pos: THREE.Vector3; target: THREE.Vector3 } {
  if (view === "overview") {
    return { pos: new THREE.Vector3(31, 21, 35), target: new THREE.Vector3(0, 1.2, 0) };
  }
  if (view === "center") {
    return { pos: new THREE.Vector3(11.5, 8, 13.5), target: new THREE.Vector3(0, 3.6, 0) };
  }
  if (view === "isle") {
    const dir = ISLE_POS.clone().setY(0).normalize();
    return {
      pos: ISLE_POS.clone().add(dir.multiplyScalar(-11)).add(new THREE.Vector3(0, 8.5, 6)),
      target: ISLE_POS.clone().add(new THREE.Vector3(0, 1.6, 0)),
    };
  }
  const a = DISTRICT_POS[view];
  const dir = a.clone().setY(0).normalize();
  return {
    pos: a.clone().add(dir.multiplyScalar(13.5)).add(new THREE.Vector3(0, 10, 0)),
    target: a.clone().add(new THREE.Vector3(0, 2.4, 0)),
  };
}

export default function WorldScene({ levels, selected, onSelect, handleRef, lang, decor, isleUnlocked, isleLevel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const propsRef = useRef({ levels, selected, onSelect, lang, isleUnlocked, isleLevel, currentDecor: decor });
  propsRef.current = { levels, selected, onSelect, lang, isleUnlocked, isleLevel, currentDecor: decor };

  const sceneApi = useRef<{
    flyTo: (view: ViewId, dur?: number) => void;
    rebuildDistrict: (d: DistrictId) => void;
    rebuildIsle: () => void;
    rebuildDecor: () => void;
    burst: (view: ViewId, kind: "gold" | "jade") => void;
  } | null>(null);

  const prevLevels = useRef<Record<DistrictId, number> | null>(null);
  const prevIsleLv = useRef<number>(isleLevel);
  const prevUnlocked = useRef<boolean>(isleUnlocked);
  const prevDecor = useRef<string>(decor.join(","));

  /* ------------------------- mount scene once ------------------------- */
  useEffect(() => {
    const containerMaybe = containerRef.current;
    if (!containerMaybe) return;
    const container: HTMLDivElement = containerMaybe;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    sun.shadow.mapSize.set(2048, 2048);
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

    scene.add(makeSky());
    scene.add(makeSunSprite());
    const water = makeWater();
    scene.add(water.mesh);
    staticTicks.push(water.tick);
    const dust = makeDust();
    scene.add(dust.points);
    staticTicks.push(dust.tick);

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
      const r = 60 + Math.random() * 60;
      c.position.set(Math.cos(a) * r, 22 + Math.random() * 16, Math.sin(a) * r);
      c.scale.setScalar(2.2 + Math.random() * 2.4);
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
      onIsle?: boolean;
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
    for (let i = 0; i < 2; i++) {
      const p = makePerson(shirtColors[(i + 4) % shirtColors.length]);
      p.group.scale.setScalar(1.0);
      scene.add(p.group);
      p.group.visible = propsRef.current.isleUnlocked;
      isleWalkers.push({ p, mode: "ring", r: 4.6 + i * 0.9, speed: (0.14 + i * 0.05) * (i % 2 ? 1 : -1), phase: i * 2.6, onIsle: true });
    }

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
        const a = w.phase + t * w.speed;
        w.p.group.position.set(ISLE_POS.x + Math.cos(a) * w.r, 0.55, ISLE_POS.z + Math.sin(a) * w.r);
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

    /* ---------------------------- genesis isle ---------------------------- */
    const ghost = buildIsleGhost();
    ghost.group.position.copy(ISLE_POS);
    ghost.group.visible = !propsRef.current.isleUnlocked;
    ghost.group.userData.tag = "isle";
    scene.add(ghost.group);
    staticTicks.push(ghost.tick);

    const isleGroup = new THREE.Group();
    isleGroup.position.copy(ISLE_POS);
    isleGroup.userData.tag = "isle";
    isleGroup.visible = propsRef.current.isleUnlocked;
    scene.add(isleGroup);
    let isleTicks: TickFn[] = [];

    function rebuildIsle() {
      disposeGroup(isleGroup);
      isleTicks = [];
      const g = buildIsle(m, Math.max(8, propsRef.current.isleLevel), isleTicks);
      isleGroup.add(g);
    }
    if (propsRef.current.isleUnlocked) rebuildIsle();

    const decorGroup = new THREE.Group();
    decorGroup.position.copy(ISLE_POS);
    decorGroup.visible = propsRef.current.isleUnlocked;
    scene.add(decorGroup);
    let decorTicks: TickFn[] = [];
    function rebuildDecor() {
      disposeGroup(decorGroup);
      decorTicks = [];
      for (const id of DECOR_IDS) {
        if (!propsRef.current.currentDecor.includes(id)) continue;
        decorGroup.add(makeDecor(id as DecorId, m, decorTicks));
      }
    }
    rebuildDecor();

    /* ------------------------------ bursts ------------------------------ */
    const burst = makeBurstPool(scene);
    staticTicks.push(burst.tick);

    /* ------------------------------ camera tween ------------------------------ */
    let tween: { t0: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3 } | null = null;
    function flyTo(view: ViewId, dur = 1.6) {
      const { pos, target } = viewPose(view);
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
      const targets: THREE.Object3D[] = [lighthouse, ...DISTRICT_IDS.map((d) => districtGroups[d] as THREE.Object3D), isleGroup, ghost.group];
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
        propsRef.current.onSelect(tag as ViewId);
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
    const labelIds = [...DISTRICT_IDS, "center", "isle"];
    const tmpV = new THREE.Vector3();
    const labelTextCache: Record<string, string> = {};

    function labelText(id: string): string {
      const t = makeT(propsRef.current.lang);
      if (id === "center") return t("nav.center");
      if (id === "isle") {
        return propsRef.current.isleUnlocked ? t("il.title") : `${t("nav.isle")} · ${t("misc.levelShort", { n: ISLE_UNLOCK_LV })}`;
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
        const base = id === "isle" ? ISLE_POS : DISTRICT_POS[id];
        const lv = id === "center" ? 0 : id === "isle" ? 0 : propsRef.current.levels[id as DistrictId];
        tmpV.set(base.x, base.y + LABEL_HEIGHT[id](lv) + 1.2, base.z);
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
        el.classList.toggle("label-locked", id === "isle" && !propsRef.current.isleUnlocked);
        el.classList.toggle("label-active", propsRef.current.selected === id);
      }
    }

    /* ------------------------------ tooltip content ------------------------------ */
    function updateTooltipContent() {
      const tip = tooltipRef.current;
      if (!tip || !hovered) return;
      const t = makeT(propsRef.current.lang);
      if (hovered === "isle") {
        tip.innerHTML = propsRef.current.isleUnlocked
          ? `<strong>${t("il.title")}</strong><span>${t("ws.lvl", { n: propsRef.current.isleLevel })}</span>`
          : `<strong>${t("il.locked")}</strong><span>${t("ct.isle.unlockAt", { n: ISLE_UNLOCK_LV })}</span>`;
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
      burst: (view, kind) => {
        const origin =
          view === "isle"
            ? ISLE_POS.clone().add(new THREE.Vector3(0, 3, 0))
            : view === "overview"
              ? new THREE.Vector3(0, 5, 0)
              : DISTRICT_POS[view].clone().add(new THREE.Vector3(0, 4.5, 0));
        burst.fire(origin, kind);
      },
    };
    handleRef.current = {
      fireBurst: (view, kind) => sceneApi.current?.burst(view, kind),
    };

    /* ------------------------------ loop ------------------------------ */
    const clock = new THREE.Clock();
    let raf = 0;
    const introPose = viewPose("overview");
    const introStart = performance.now();
    const introFrom = camera.position.clone();
    let introDone = false;

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      if (!introDone) {
        const k = Math.min(1, (performance.now() - introStart) / 2600);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(introFrom, introPose.pos, e);
        controls.target.lerpVectors(new THREE.Vector3(0, 20, 0), introPose.target, e);
        if (k >= 1) introDone = true;
      } else if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / tween.dur);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
        controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e);
        if (k >= 1) tween = null;
      }

      controls.autoRotate = propsRef.current.selected === "overview" && !tween && !userInteracting && introDone;
      controls.update();

      for (const fn of staticTicks) fn(t, dt);
      for (const d of DISTRICT_IDS) for (const fn of districtTicks[d]) fn(t, dt);
      for (const fn of isleTicks) fn(t, dt);
      for (const fn of decorTicks) fn(t, dt);

      updateLabels();
      updateTooltipContent();
      renderer.render(scene, camera);
    }
    frame();

    /* ------------------------------ cleanup ------------------------------ */
    return () => {
      window.clearTimeout(idleTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
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
    if (!sceneApi.current) return;
    sceneApi.current.flyTo(selected, selected === "overview" ? 2.0 : 1.5);
  }, [selected]);

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
    if (isleUnlocked && !prevUnlocked.current) {
      api.rebuildIsle();
      api.rebuildDecor();
      api.burst("isle", "jade");
      sound.levelUp();
    } else if (isleUnlocked && isleLevel !== prevIsleLv.current) {
      api.rebuildIsle();
      if (isleLevel > prevIsleLv.current) api.burst("isle", "gold");
    }
    prevUnlocked.current = isleUnlocked;
    prevIsleLv.current = isleLevel;
  }, [isleUnlocked, isleLevel]);

  useEffect(() => {
    const key = decor.join(",");
    if (key === prevDecor.current) return;
    prevDecor.current = key;
    sceneApi.current?.rebuildDecor();
  }, [decor]);

  /* ------------------------------ render ------------------------------ */
  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        ref={tooltipRef}
        className="chip pointer-events-none absolute left-0 top-0 z-30 rounded-md px-2.5 py-1.5 text-[11px] leading-tight opacity-0 transition-opacity duration-150"
        style={{ opacity: 0 }}
      />
      {[...DISTRICT_IDS, "center", "isle"].map((id) => (
        <div key={id} ref={(el) => void (labelEls.current[id] = el)} className="world-label left-0 top-0 z-20" style={{ opacity: 0 }}>
          <span className="chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[9px] tracking-[0.14em] text-mist-300">
            <span className="h-1.5 w-1.5 rotate-45" style={{ background: id === "center" ? "#f0c268" : id === "isle" ? "#5ce8c4" : DISTRICTS[id as DistrictId].accent }} />
            <span data-label-txt="" />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function disposeGroup(g: THREE.Group) {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const child = g.children[i];
    child.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    g.remove(child);
  }
}
