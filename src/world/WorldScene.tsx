import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DISTRICT_POS,
  buildSpire,
  buildExchange,
  buildVault,
  buildAcademy,
  buildLighthouse,
  buildTerrain,
  buildPaths,
  buildGate,
  makeTree,
  makeRock,
  makeCloud,
  makeSky,
  makeSunSprite,
  makeWater,
  makeDust,
  makeBurstPool,
  makeMats,
} from "./build";
import type { TickFn } from "./build";
import { DISTRICTS } from "../state/store";
import type { DistrictId, ViewId } from "../state/store";
import { sound } from "../lib/audio";

export interface WorldHandle {
  fireBurst(view: DistrictId, kind: "gold" | "jade"): void;
}

interface Props {
  levels: Record<DistrictId, number>;
  selected: ViewId;
  onSelect: (view: DistrictId | "center") => void;
  handleRef: React.MutableRefObject<WorldHandle | null>;
}

const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

type Builder = (level: number, m: ReturnType<typeof makeMats>, ticks: TickFn[]) => THREE.Group;
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
  const a = DISTRICT_POS[view];
  const dir = a.clone().setY(0).normalize();
  return {
    pos: a.clone().add(dir.multiplyScalar(13.5)).add(new THREE.Vector3(0, 10, 0)),
    target: a.clone().add(new THREE.Vector3(0, 2.4, 0)),
  };
}

export default function WorldScene({ levels, selected, onSelect, handleRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const propsRef = useRef({ levels, selected, onSelect });
  propsRef.current = { levels, selected, onSelect };

  const sceneApi = useRef<{
    flyTo: (view: ViewId, dur?: number) => void;
    rebuildDistrict: (d: DistrictId) => void;
    burst: (view: DistrictId, kind: "gold" | "jade") => void;
  } | null>(null);

  const prevLevels = useRef<Record<DistrictId, number> | null>(null);

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

    const camera = new THREE.PerspectiveCamera(
      46,
      Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight)),
      0.1,
      900
    );
    camera.position.set(4, 85, 140);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 10;
    controls.maxDistance = 110;
    controls.maxPolarAngle = 1.42;
    controls.minPolarAngle = 0.12;
    controls.autoRotateSpeed = 0.4;
    controls.target.set(0, 1.2, 0);

    /* pause auto-rotate while the user interacts, resume after idle */
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

    /* lights */
    const hemi = new THREE.HemisphereLight(0x7fc4b8, 0x1d2a28, 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a0, 2.0);
    sun.position.set(-38, 42, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x5ce8c4, 0.35);
    rim.position.set(30, 18, 38);
    scene.add(rim);

    const mats = makeMats();

    /* environment */
    scene.add(makeSky());
    scene.add(makeSunSprite());
    const water = makeWater();
    scene.add(water.mesh);
    scene.add(buildTerrain());
    scene.add(buildPaths(mats));
    scene.add(buildGate(mats));
    const dust = makeDust();
    scene.add(dust.points);
    const bursts = makeBurstPool(scene);

    /* nature scatter (deterministic) */
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const leafMats = [mats.leaves1, mats.leaves2];
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 16 + rnd() * 8;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      let tooClose = Math.sqrt(x * x + z * z) < 15;
      for (const id of DISTRICT_IDS) {
        const p = DISTRICT_POS[id];
        if (Math.sqrt((x - p.x) ** 2 + (z - p.z) ** 2) < 6.5) tooClose = true;
      }
      if (tooClose) continue;
      const tree = makeTree(mats, 0.8 + rnd() * 0.9, leafMats[i % 2]);
      tree.position.set(x, 0, z);
      tree.rotation.y = rnd() * Math.PI;
      scene.add(tree);
    }
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 8 + rnd() * 16;
      const rock = makeRock(mats, 0.5 + rnd() * 1.1);
      rock.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      rock.rotation.y = rnd() * Math.PI;
      scene.add(rock);
    }

    /* clouds */
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const c = makeCloud();
      c.position.set(-70 + i * 42, 16 + (i % 2) * 5, -25 + i * 14);
      c.scale.setScalar(1.4 + (i % 3) * 0.7);
      clouds.push(c);
      scene.add(c);
    }

    /* lighthouse at center */
    const centerTicks: TickFn[] = [];
    const lighthouse = buildLighthouse(mats, centerTicks);
    scene.add(lighthouse);

    /* district roots */
    const roots: Record<DistrictId, THREE.Group> = {} as Record<DistrictId, THREE.Group>;
    const ticksByDistrict: Record<DistrictId, TickFn[]> = {} as Record<DistrictId, TickFn[]>;
    for (const d of DISTRICT_IDS) {
      const root = new THREE.Group();
      root.position.copy(DISTRICT_POS[d]);
      // hex pad
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(4.7, 5.1, 0.65, 6),
        mats.stoneDark
      );
      pad.position.y = 0.05;
      pad.receiveShadow = true;
      pad.castShadow = true;
      root.add(pad);
      const padRim = new THREE.Mesh(
        new THREE.CylinderGeometry(4.75, 4.75, 0.1, 6),
        mats.gold
      );
      padRim.position.y = 0.4;
      root.add(padRim);
      scene.add(root);
      roots[d] = root;
      ticksByDistrict[d] = [];
    }

    function rebuildDistrict(d: DistrictId) {
      const root = roots[d];
      const keep = root.children.slice(0, 2); // pad + rim
      for (const child of root.children) {
        if (keep.includes(child)) continue;
        root.remove(child);
        child.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.geometry.dispose();
        });
      }
      root.children.length = 0;
      root.add(...keep);
      ticksByDistrict[d].length = 0;
      const level = propsRef.current.levels[d];
      const bld = BUILDERS[d](level, mats, ticksByDistrict[d]);
      bld.position.y = 0.35;
      root.add(bld);
    }
    for (const d of DISTRICT_IDS) rebuildDistrict(d);

    /* hit targets (invisible) */
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hitMeshes: THREE.Mesh[] = [];
    const addHit = (id: string, pos: THREE.Vector3, r: number, h: number) => {
      const hm = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), hitMat);
      hm.position.copy(pos).add(new THREE.Vector3(0, h / 2, 0));
      hm.userData.viewId = id;
      scene.add(hm);
      hitMeshes.push(hm);
    };
    for (const d of DISTRICT_IDS) addHit(d, DISTRICT_POS[d], 4.9, 12);
    addHit("center", DISTRICT_POS.center, 5.6, 11);

    /* hover + selection rings */
    const hoverRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.3, 0.09, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.position.y = 0.14;
    hoverRing.visible = false;
    scene.add(hoverRing);

    const selectRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.7, 0.06, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x5ce8c4, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.position.y = 0.12;
    selectRing.visible = false;
    scene.add(selectRing);

    /* camera tween */
    let tween: {
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
      t: number;
      dur: number;
    } | null = null;

    function flyTo(view: ViewId, dur = 1.9) {
      const pose = viewPose(view);
      tween = {
        fromPos: camera.position.clone(),
        toPos: pose.pos,
        fromTarget: controls.target.clone(),
        toTarget: pose.target,
        t: 0,
        dur,
      };
      controls.enabled = false;
    }

    /* pointer interaction */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(-10, -10);
    let hoverId: string | null = null;
    let downX = 0, downY = 0, downT = 0;
    const clientXY = { x: 0, y: 0 };

    function onPointerMove(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
      clientXY.x = e.clientX;
      clientXY.y = e.clientY;
    }
    function onPointerDown(e: PointerEvent) {
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    }
    function onPointerUp(e: PointerEvent) {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (dx * dx + dy * dy > 42 || performance.now() - downT > 500) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.viewId as DistrictId | "center";
        sound.tick();
        propsRef.current.onSelect(id);
      }
    }
    function onPointerLeave() {
      ndc.set(-10, -10);
    }
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    /* labels + tooltip refs */
    const tooltip = tooltipRef.current;
    const labelIds = [...DISTRICT_IDS, "center"];
    const tmpV = new THREE.Vector3();

    function updateLabels() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const id of labelIds) {
        const el = labelEls.current[id];
        if (!el) continue;
        const base = DISTRICT_POS[id];
        const lv = id === "center" ? 0 : propsRef.current.levels[id as DistrictId];
        tmpV.set(base.x, base.y + LABEL_HEIGHT[id](lv) + 1.2, base.z);
        tmpV.project(camera);
        const behind = tmpV.z > 1;
        const x = (tmpV.x * 0.5 + 0.5) * w;
        const y = (-tmpV.y * 0.5 + 0.5) * h;
        const off = behind || x < -80 || x > w + 80 || y < -40 || y > h + 40;
        el.style.opacity = off ? "0" : "1";
        el.style.transform = `translate(-50%, -110%) translate3d(${x}px, ${y}px, 0)`;
      }
    }

    /* resize */
    function onResize() {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    /* main loop */
    const clock = new THREE.Clock();
    let raf = 0;
    let hoverScale: Record<string, number> = {};

    function loop() {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      if (tween) {
        tween.t += dt / tween.dur;
        const k = easeInOutCubic(Math.min(1, tween.t));
        camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
        if (tween.t >= 1) {
          tween = null;
          controls.enabled = true;
        }
      }
      controls.autoRotate = propsRef.current.selected === "overview" && !tween && !userInteracting;
      controls.update();

      water.tick(t, dt);
      dust.tick(t, dt);
      bursts.tick(t, dt);
      for (const c of clouds) {
        c.position.x += dt * 0.9;
        if (c.position.x > 95) c.position.x = -95;
      }
      for (const fn of centerTicks) fn(t, dt);
      for (const d of DISTRICT_IDS) for (const fn of ticksByDistrict[d]) fn(t, dt);

      /* hover raycast */
      raycaster.setFromCamera(ndc, camera);
      const hits = ndc.x < -5 ? [] : raycaster.intersectObjects(hitMeshes, false);
      const newHover = hits.length > 0 ? (hits[0].object.userData.viewId as string) : null;
      if (newHover !== hoverId) {
        hoverId = newHover;
        renderer.domElement.style.cursor = hoverId ? "pointer" : "grab";
        if (tooltip) {
          if (hoverId) {
            const isCenter = hoverId === "center";
            const meta = isCenter ? null : DISTRICTS[hoverId as DistrictId];
            const lv = isCenter ? 0 : propsRef.current.levels[hoverId as DistrictId];
            tooltip.innerHTML = `
              <div style="font-family:'Unbounded',sans-serif;font-size:11px;letter-spacing:0.14em;color:#ffd88a;">${isCenter ? "HẢI ĐĂNG TRUNG TÂM" : meta!.building.toUpperCase()}</div>
              <div style="margin-top:3px;font-size:12px;color:#b7cbc9;">${isCenter ? "Trái tim của đảo — nhấn để xem tổng quan" : `${meta!.label} · Cấp ${lv} — nhấn để mở quận`}</div>`;
            tooltip.style.opacity = "1";
          } else {
            tooltip.style.opacity = "0";
          }
        }
      }
      if (hoverId && tooltip) {
        tooltip.style.transform = `translate3d(${clientXY.x + 18}px, ${clientXY.y + 14}px, 0)`;
      }
      if (hoverId) {
        const p = DISTRICT_POS[hoverId];
        hoverRing.visible = true;
        hoverRing.position.set(p.x, 0.14, p.z);
        hoverRing.scale.setScalar(1 + Math.sin(t * 4) * 0.03);
      } else {
        hoverRing.visible = false;
      }

      const sel = propsRef.current.selected;
      if (sel !== "overview" && DISTRICT_POS[sel]) {
        const p = DISTRICT_POS[sel];
        selectRing.visible = true;
        selectRing.position.set(p.x, 0.12, p.z);
        selectRing.rotation.z = t * 0.5;
      } else {
        selectRing.visible = false;
      }

      /* subtle hover scale on building roots */
      const nextScale: Record<string, number> = {};
      for (const d of DISTRICT_IDS) {
        const target = hoverId === d ? 1.035 : 1;
        const cur = hoverScale[d] ?? 1;
        const ns = cur + (target - cur) * Math.min(1, dt * 8);
        nextScale[d] = ns;
        roots[d].scale.setScalar(ns);
      }
      hoverScale = nextScale;

      updateLabels();
      renderer.render(scene, camera);
    }
    loop();

    /* intro flight */
    const introTimer = window.setTimeout(() => {
      flyTo("overview", 3.0);
    }, 250);

    sceneApi.current = {
      flyTo,
      rebuildDistrict,
      burst: (view, kind) => {
        const p = DISTRICT_POS[view];
        bursts.fire(p.clone().add(new THREE.Vector3(0, 3.2, 0)), kind);
      },
    };

    /* ------------------------- cleanup ------------------------- */
    return () => {
      window.clearTimeout(introTimer);
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
          const mm = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
          else mm.dispose();
        }
      });
      renderer.dispose();
      const host = container;
      if (host && renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      sceneApi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------- react to level changes ------------------- */
  useEffect(() => {
    const prev = prevLevels.current;
    if (!prev) {
      prevLevels.current = { ...levels };
      return;
    }
    for (const d of DISTRICT_IDS) {
      if (prev[d] !== levels[d]) {
        sceneApi.current?.rebuildDistrict(d);
      }
    }
    prevLevels.current = { ...levels };
  }, [levels]);

  /* ------------------- react to selection ------------------- */
  useEffect(() => {
    sceneApi.current?.flyTo(selected);
  }, [selected]);

  /* ------------------- expose handle ------------------- */
  useEffect(() => {
    handleRef.current = {
      fireBurst: (view, kind) => sceneApi.current?.burst(view, kind),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {DISTRICT_IDS.map((d) => (
          <div key={d} ref={(el) => { labelEls.current[d] = el; }} className="world-label transition-opacity duration-300">
            <div className="chip rounded-md px-2.5 py-1 text-center">
              <div className="font-display text-[9px] tracking-[0.18em] text-mist-300">{DISTRICTS[d].label.toUpperCase()}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-1 w-1 rotate-45"
                    style={{ background: i < levels[d] ? DISTRICTS[d].accent : "rgba(139,164,167,0.3)" }}
                  />
                ))}
              </div>
            </div>
            <div className="mx-auto h-3 w-px bg-gradient-to-b from-[rgba(224,170,80,0.5)] to-transparent" />
          </div>
        ))}
        <div ref={(el) => { labelEls.current["center"] = el; }} className="world-label transition-opacity duration-300">
          <div className="chip rounded-md px-2.5 py-1 text-center">
            <div className="font-display text-[9px] tracking-[0.18em] text-gold-300">HẢI ĐĂNG</div>
          </div>
          <div className="mx-auto h-3 w-px bg-gradient-to-b from-[rgba(255,216,138,0.5)] to-transparent" />
        </div>
        <div
          ref={tooltipRef}
          className="panel absolute left-0 top-0 z-20 max-w-[240px] rounded-lg px-3.5 py-2.5 opacity-0 transition-opacity duration-150"
          style={{ willChange: "transform" }}
        />
      </div>
    </>
  );
}
