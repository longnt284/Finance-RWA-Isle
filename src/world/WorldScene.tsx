import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
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
  makeDust,
  makeBurstPool,
  makeMats,
  makePerson,
  makeBoat,
  makeBird,
  makeLamp,
  makeDecor,
  makePalm,
  DECOR_IDS,
} from "./build";
import type { TickFn, Mats, DecorId } from "./build";
import {
  makeProp, placeProp, buildVillage, buildFishingPier, makeWhirlpool,
  propFlowerbed as makeFlowerPatch, PIER_POSITION, PIER_ROTATION,
} from "./props";
import { makeSky, makeSun, makeMoon, makeShootingStars, makeCloudLayer, skyStateFor } from "./atmosphere";
import { makeOcean, makeSandShelf, makeBoundary, TERRITORY_RADIUS, WATER_LEVEL } from "./ocean";
import { makeWeather } from "./weather";
import { makeYacht, YACHT_LENGTH } from "./yacht";
import { SEASON_PALETTES, WEATHER_PROFILES, seasonForDate, autoWeather } from "../lib/season";
import type { Season, WeatherId } from "../lib/season";
import { SHOP_BY_ID } from "../lib/shop";
import type { GroundPalette } from "../lib/shop";
import { DISTRICTS, ISLE_UNLOCK_LEVELS, ISLE_SLOTS, VISUAL_MAX } from "../state/store";
import type { DistrictId, ViewId, IslandTheme, IsleSlot, WorldPrefs, YachtTier } from "../state/store";
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
  yachtTier: YachtTier;
  world: WorldPrefs;
  /** Vật phẩm Chợ Trang Trí đang đặt trên từng đảo. */
  decor: Record<IsleSlot, string[]>;
  /** Người chơi bấm vào bến câu trên đảo. */
  onFish: (zone: "shore" | "vortex") => void;
  /** Du thuyền lọt vào một xoáy nước ngoài khơi. */
  onVortex: () => void;
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

/** Du thuyền không được vượt vành san hô; chừa một khoảng để không cấn vào rạn. */
const SAIL_LIMIT = TERRITORY_RADIUS - 6;

function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function viewPose(view: ViewId, activeIsle: DistrictId = "crypto"): { pos: THREE.Vector3; target: THREE.Vector3 } {
  if (view === "overview") {
    /* Lùi ra và hạ thấp một chút so với bản trước để thấy trọn vành lãnh thổ. */
    return { pos: new THREE.Vector3(62, 44, 74), target: new THREE.Vector3(0, 1.2, 4) };
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

export default function WorldScene({
  levels, selected, onSelect, handleRef, lang, islands, activeIsle, voyage, helmInput, yachtTier, world, decor, onFish, onVortex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const propsRef = useRef({ levels, selected, onSelect, lang, islands, activeIsle, voyage, helmInput, yachtTier, world, decor, onFish, onVortex });
  propsRef.current = { levels, selected, onSelect, lang, islands, activeIsle, voyage, helmInput, yachtTier, world, decor, onFish, onVortex };

  const sceneApi = useRef<{
    flyTo: (view: ViewId, dur?: number) => void;
    rebuildDistrict: (d: DistrictId) => void;
    rebuildIsle: (district: DistrictId) => void;
    rebuildDecor: (district: DistrictId) => void;
    rebuildYacht: () => void;
    rebuildShop: (slot: IsleSlot) => void;
    syncIslands: () => void;
    setVoyage: (active: boolean) => void;
    refreshEnvironment: () => void;
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

    const camera = new THREE.PerspectiveCamera(46, Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight)), 0.1, 1400);
    camera.position.set(4, 95, 155);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 9;
    controls.maxDistance = 165;
    controls.maxPolarAngle = 1.5;
    controls.minPolarAngle = 0.1;
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
    /* Đất phản xạ lên bằng sắc cát ấm chứ không phải xanh xám: mặt dưới của tán
       dừa và hiên nhà không còn tối đen như bản trước. */
    const hemi = new THREE.HemisphereLight(0xbfe4e8, 0x6a6047, 0.55);
    scene.add(hemi);
    const sunLight = new THREE.DirectionalLight(0xffd9a8, 2.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(compactGpu ? 1024 : 2048, compactGpu ? 1024 : 2048);
    sunLight.shadow.camera.left = -52;
    sunLight.shadow.camera.right = 52;
    sunLight.shadow.camera.top = 52;
    sunLight.shadow.camera.bottom = -52;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    /* Ánh trăng là nguồn sáng riêng nên ban đêm vẫn đọc được hình khối. */
    const moonLight = new THREE.DirectionalLight(0x9fc4ff, 0);
    scene.add(moonLight);
    const rim = new THREE.DirectionalLight(0x5ce8c4, 0.5);
    rim.position.set(38, 18, 42);
    scene.add(rim);
    /* Chớp giông: đèn bán cầu trắng, bình thường tắt hẳn. */
    const lightning = new THREE.HemisphereLight(0xdbe7ff, 0x7d8fa8, 0);
    scene.add(lightning);

    /* ---------------------- bản đồ môi trường (phản chiếu) ----------------------
       Vàng, kính và mặt đá bóng chỉ "ra chất" khi có gì đó để phản chiếu. Thay vì
       tải một file HDR nặng, dựng một dải gradient trời–chân trời–biển rồi cho
       PMREM nướng thành cubemap: vài chục kilobyte bộ nhớ, không thêm request. */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    let envTarget: THREE.WebGLRenderTarget | null = null;
    let envKey = "";
    const envTop = new THREE.Color();
    const envHorizon = new THREE.Color();
    const envGround = new THREE.Color();

    function refreshEnvMap(daylight: number, fogHex: number, shallowHex: number) {
      /* Chỉ nướng lại khi ánh sáng đổi đủ nhiều — mỗi phút một lần là quá thừa. */
      const key = `${Math.round(daylight * 12)}|${fogHex}|${shallowHex}`;
      if (key === envKey) return;
      envKey = key;
      const W = 32;
      const H = 16;
      const data = new Uint8Array(W * H * 4);
      envTop.setHex(0x0b2b45).lerp(new THREE.Color(0x8fc7e8), daylight);
      envHorizon.setHex(fogHex).lerp(new THREE.Color(0xffd9b0), daylight * 0.5);
      envGround.setHex(shallowHex).multiplyScalar(0.35 + daylight * 0.6);
      const mix = new THREE.Color();
      for (let y = 0; y < H; y++) {
        /* v = 0 ở đỉnh trời, 1 ở đáy biển; chân trời nằm giữa. */
        const v = y / (H - 1);
        if (v < 0.5) mix.copy(envTop).lerp(envHorizon, Math.pow(v * 2, 0.7));
        else mix.copy(envHorizon).lerp(envGround, Math.pow((v - 0.5) * 2, 0.6));
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          data[i] = Math.round(THREE.MathUtils.clamp(mix.r, 0, 1) * 255);
          data[i + 1] = Math.round(THREE.MathUtils.clamp(mix.g, 0, 1) * 255);
          data[i + 2] = Math.round(THREE.MathUtils.clamp(mix.b, 0, 1) * 255);
          data[i + 3] = 255;
        }
      }
      const texture = new THREE.DataTexture(data, W, H);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.needsUpdate = true;
      const target = pmrem.fromEquirectangular(texture);
      texture.dispose();
      envTarget?.dispose();
      envTarget = target;
      scene.environment = target.texture;
      scene.environmentIntensity = 0.35 + daylight * 0.45;
    }

    /* ------------------------------ world ------------------------------ */
    const m = makeMats();
    const staticTicks: TickFn[] = [];

    const sky = makeSky();
    scene.add(sky.mesh);
    staticTicks.push(sky.tick);
    const sunBody = makeSun();
    scene.add(sunBody.sprite);
    const moonBody = makeMoon();
    scene.add(moonBody.sprite);
    const shootingStars = makeShootingStars(compactGpu ? 2 : 3);
    scene.add(shootingStars.group);
    staticTicks.push(shootingStars.tick);
    const cloudLayer = makeCloudLayer(compactGpu ? 6 : 9);
    scene.add(cloudLayer.group);
    staticTicks.push(cloudLayer.tick);

    const ocean = makeOcean();
    scene.add(ocean.mesh);
    staticTicks.push(ocean.tick);
    const sandShelf = makeSandShelf();
    scene.add(sandShelf);
    const boundary = makeBoundary();
    scene.add(boundary.group);
    staticTicks.push(boundary.tick);

    const weather = makeWeather();
    scene.add(weather.group);
    staticTicks.push(weather.tick);

    const dust = makeDust();
    scene.add(dust.points);
    staticTicks.push(dust.tick);

    /* ---------------------- terrain (rebuilt per season) ---------------------- */

    /** Sắc nền người chơi mua ở Chợ, nếu đang đặt trên đảo đó. */
    function groundPaletteOf(slot: IsleSlot): GroundPalette | null {
      for (const id of propsRef.current.decor[slot] ?? []) {
        const item = SHOP_BY_ID.get(id);
        if (item?.cat === "ground" && item.palette) return item.palette;
      }
      return null;
    }

    let terrain: THREE.Mesh | null = null;
    let terrainKey: string | null = null;
    let activeSeason: Season = seasonForDate(new Date());
    function rebuildTerrain(season: Season) {
      const ground = groundPaletteOf("main");
      const key = `${season}|${ground ? ground.top.toString(16) : "-"}`;
      if (terrainKey === key) return;
      terrainKey = key;
      if (terrain) {
        scene.remove(terrain);
        terrain.geometry.dispose();
        (terrain.material as THREE.Material).dispose();
      }
      const palette = SEASON_PALETTES[season];
      /* Sắc nền mua ở Chợ pha vào màu mùa chứ không thay hẳn — mùa đông vẫn ra
         mùa đông, chỉ là thảm cỏ mang sắc người chơi chọn. */
      const foliage = ground ? new THREE.Color(palette.foliage).lerp(new THREE.Color(ground.top), 0.72).getHex() : palette.foliage;
      const foliageAlt = ground ? new THREE.Color(palette.foliageAlt).lerp(new THREE.Color(ground.rim), 0.55).getHex() : palette.foliageAlt;
      terrain = buildTerrain({ foliage, foliageAlt, snow: palette.snow });
      scene.add(terrain);
      /* Cây và thảm cỏ dùng vật liệu dùng chung nên chỉ cần đổi màu, không dựng lại. */
      m.leaves1.color.setHex(palette.foliage);
      m.leaves2.color.setHex(palette.foliageAlt);
    }
    rebuildTerrain(seasonForDate(new Date()));

    scene.add(buildPaths(m));
    scene.add(buildGate(m));

    const lighthouse = buildLighthouse(m, staticTicks);
    lighthouse.position.copy(DISTRICT_POS.center);
    lighthouse.userData.tag = "center";
    scene.add(lighthouse);

    /* ------------------------ môi trường: giờ, mùa, thời tiết ------------------------ */
    const fogColor = new THREE.Color();
    const shallowColor = new THREE.Color();
    const sunWarm = new THREE.Color(0xff9a63);
    const sunPale = new THREE.Color(0xffe2bd);
    const seasonTint = new THREE.Color();
    const cloudTint = new THREE.Color();
    let lastEnvKey = "";
    let currentWeather: WeatherId = "clear";
    let currentDaylight = 0.7;

    /** Cường độ hạt theo thiết lập chất lượng — máy yếu vẫn mượt. */
    function effectStrength(): number {
      const prefs = propsRef.current.world;
      if (!prefs.effects || reduceMotion) return 0;
      if (prefs.quality === "balanced") return 0.5;
      if (prefs.quality === "high") return 1;
      return compactGpu ? 0.5 : 1;
    }

    function applyEnvironment(force = false) {
      const now = new Date();
      const prefs = propsRef.current.world;
      const minute = now.getHours() * 60 + now.getMinutes();
      const season: Season = prefs.mode === "manual" ? prefs.season : seasonForDate(now);
      const state = skyStateFor(now);
      const isNight = state.daylight < 0.28;
      const chosen: WeatherId = prefs.mode === "manual" ? prefs.weather : autoWeather(now, season, isNight);
      const key = `${minute}|${season}|${chosen}|${prefs.quality}|${prefs.effects}`;
      if (!force && key === lastEnvKey) return;
      lastEnvKey = key;

      const palette = SEASON_PALETTES[season];
      const profile = WEATHER_PROFILES[chosen];
      currentWeather = chosen;
      currentDaylight = state.daylight;
      activeSeason = season;
      rebuildTerrain(season);
      refreshEnvMap(state.daylight, palette.fog, palette.shallow);

      /* ---- ánh sáng ---- */
      const lit = state.daylight * profile.lightScale;
      sunLight.position.copy(state.sunDir).multiplyScalar(110);
      sunLight.intensity = 0.18 + lit * 2.1;
      sunLight.color.copy(sunWarm).lerp(sunPale, state.daylight);
      seasonTint.setHex(palette.sunTint);
      sunLight.color.lerp(seasonTint, 0.35);
      sunLight.castShadow = state.sunDir.y > 0.02;

      moonLight.position.copy(state.moonDir).multiplyScalar(110);
      moonLight.intensity = Math.max(0, state.moonDir.y) * (1 - state.daylight) * 0.55 * profile.lightScale;

      hemi.intensity = 0.28 + lit * 0.72;
      rim.intensity = 0.2 + (1 - state.daylight) * 0.4;
      renderer.toneMappingExposure = 0.9 + state.daylight * 0.34 + palette.warmth * 0.07;

      /* ---- sương mù và biển ---- */
      /* Sương mù nhạt đi nhiều so với bản trước. Ở mật độ 0,0085 thì ngay cả đảo
         chính — cách camera khoảng 110 đơn vị — đã chìm một nửa vào sương, khiến
         cả khung hình bạc phếch thay vì trong veo như vùng biển nhiệt đới. */
      fogColor.setHex(palette.fog).lerp(new THREE.Color(0x7fb8cf), state.daylight * 0.38).multiplyScalar(0.45 + state.daylight * 0.62);
      (scene.fog as THREE.FogExp2).color.copy(fogColor);
      (scene.fog as THREE.FogExp2).density = 0.0036 * profile.fogScale;
      shallowColor.setHex(palette.shallow);
      ocean.apply({ daylight: state.daylight, sunDir: state.sunDir, moonDir: state.moonDir, fog: fogColor, shallow: shallowColor, rain: profile.rain });
      boundary.setTint(shallowColor);

      /* ---- bầu trời ---- */
      sky.apply(state, profile.overcast);
      sunBody.apply(state);
      moonBody.apply(state);
      shootingStars.setActive(isNight && profile.overcast < 0.4 && effectStrength() > 0);
      cloudTint.setHex(palette.fog).lerp(new THREE.Color(0xd8e6e2), 0.25 + state.daylight * 0.5);
      cloudLayer.setCover(profile.overcast, cloudTint);

      /* ---- hạt thời tiết ---- */
      weather.set(chosen, effectStrength());
      (dust.points.material as THREE.PointsMaterial).opacity = 0.18 + state.daylight * 0.42;
      dust.points.visible = effectStrength() > 0;
    }
    applyEnvironment(true);

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
      [15.5, 3, 1.2], [-15, 4, 1.05], [14, -12, 0.9], [-14, -12.5, 1.15], [5.5, 14, 1.0],
      [-5.5, 14.5, 0.85], [17.5, -4, 0.8], [-17.5, -4.5, 0.95], [0.5, -15.5, 1.1], [-8, -16, 0.8],
      [8.5, -16.5, 0.9], [12, 11.5, 0.95], [-12, 11.5, 1.05], [18, 8, 0.85], [-18, 8.5, 0.9],
    ];
    for (const [x, z, s] of treeSpots) {
      const tree = makeTree(m, s, Math.random() > 0.5 ? m.leaves1 : m.leaves2);
      tree.position.set(x, 0, z);
      tree.rotation.y = x * z;
      scenery.add(tree);
    }
    /* Đá rải trên bãi cát mới mở rộng, làm mép đảo có nhịp chứ không trống trơn. */
    const rockSpots: [number, number, number][] = [
      [21.5, -6, 1.3], [-22, -5, 1.1], [19, 14, 0.9], [-19, 14.5, 1.2], [3, 20.5, 1.0],
      [-4, 21, 0.8], [23, 2, 0.7], [-23.5, 1, 0.9], [10, -20, 1.1], [-10, -20.5, 0.8],
      [24.2, -10.5, 0.6], [-24.6, 8.2, 0.65], [13.5, 20.4, 0.55], [-6.5, -22.6, 0.7],
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

    /* Dừa và luống hoa men theo bãi cát. Ảnh tham chiếu của hòn đảo dày đặc cây
       cối; bản cũ chỉ có 15 cây thông nên mép đảo trông trơ trọi. */
    const palmSpots: [number, number, number][] = [
      [20.5, 4.5, 1.0], [21.8, -1.5, 0.9], [19.6, 9.4, 1.05], [16.8, 15.2, 0.95], [11.5, 19.4, 1.0],
      [5.4, 21.6, 0.88], [-1.5, 22.2, 1.0], [-8.2, 21.0, 0.92], [-14.4, 18.2, 1.0], [-19.2, 12.6, 0.95],
      [-21.6, 6.2, 1.05], [-22.2, -0.8, 0.9], [-20.8, -7.4, 1.0], [-17.4, -13.6, 0.95], [-12.2, -17.8, 1.0],
      [-5.6, -20.6, 0.88], [1.8, -21.4, 1.02], [8.6, -20.2, 0.94], [14.8, -16.8, 1.0], [19.2, -11.4, 0.92],
      [9.2, 8.6, 0.8], [-9.4, 8.2, 0.85], [9.0, -6.8, 0.8], [-8.8, -6.4, 0.85],
    ];
    for (const [x, z, s] of palmSpots) {
      const palm = makePalm(m);
      palm.position.set(x, 0, z);
      palm.scale.setScalar(s * 1.25);
      palm.rotation.y = x * z;
      scenery.add(palm);
    }
    const flowerSpots: [number, number, number][] = [
      [6.4, 6.2, 0xb79cff], [-6.6, 6.0, 0xff9ac1], [6.2, -4.4, 0xf0c268], [-6.4, -4.2, 0x5ce8c4],
      [13.8, 6.8, 0xff9ac1], [-13.6, 6.6, 0xb79cff], [3.2, 11.4, 0xf0c268], [-3.4, 11.2, 0xe9f3f0],
      [15.4, -8.2, 0xb79cff], [-15.2, -8.0, 0xff9ac1],
    ];
    for (const [x, z, color] of flowerSpots) {
      const bed = makeFlowerPatch(color);
      bed.position.set(x, 0, z);
      bed.rotation.y = x + z;
      scenery.add(bed);
    }
    scene.add(scenery);

    /* ---------------------- xóm làng và bến câu ---------------------- */
    const village = buildVillage(m, staticTicks);
    scene.add(village);

    const pier = buildFishingPier(m, staticTicks);
    pier.position.copy(PIER_POSITION);
    pier.rotation.y = PIER_ROTATION;
    pier.userData.tag = "fishing";
    scene.add(pier);

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
      { g: makeBoat(m), r: 52, speed: 0.04, phase: 0.8 },
      { g: makeBoat(m), r: 68, speed: -0.028, phase: 3.6 },
      { g: makeBoat(m), r: 88, speed: 0.021, phase: 5.1 },
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
        b.g.position.set(Math.cos(a) * b.r, WATER_LEVEL + 0.2 + Math.sin(t * 1.2 + b.phase) * 0.1, Math.sin(a) * b.r);
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
      if (island.unlocked) {
        holder.add(buildIsle(m, island.level, isleTicks[district], district, island.theme, groundPaletteOf(district)));
      }
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
        shopHolders[district].visible = unlocked;
        const walker = isleWalkers.find((candidate) => candidate.island === district);
        if (walker) walker.p.group.visible = unlocked;
      }
    }

    for (const district of DISTRICT_IDS) {
      rebuildIsle(district);
      rebuildDecor(district);
    }

    /* ---------------------- đồ trang trí mua từ Chợ ---------------------- */
    const shopHolders = {} as Record<IsleSlot, THREE.Group>;
    const shopTicks = {} as Record<IsleSlot, TickFn[]>;
    for (const slot of ISLE_SLOTS) {
      const holder = new THREE.Group();
      if (slot === "main") holder.position.set(0, 0, 0);
      else holder.position.copy(ISLE_POSITIONS[slot]).setY(0.2);
      scene.add(holder);
      shopHolders[slot] = holder;
      shopTicks[slot] = [];
    }

    function rebuildShop(slot: IsleSlot) {
      const holder = shopHolders[slot];
      disposeGroup(holder);
      shopTicks[slot] = [];
      if (slot !== "main" && !propsRef.current.islands[slot].unlocked) return;
      const radius = slot === "main" ? 20.5 : ISLE_RADIUS - 1.4;
      const ids = propsRef.current.decor[slot] ?? [];
      ids.forEach((id, index) => {
        const item = SHOP_BY_ID.get(id);
        /* `ground` không có hình khối riêng — nó nằm trong bảng màu nền đảo. */
        if (!item || item.kind === "ground") return;
        const copies = Math.max(1, item.count ?? 1);
        for (let copy = 0; copy < copies; copy++) {
          const node = makeProp(item, m, shopTicks[slot]);
          placeProp(item, index, radius, holder, node, copy);
        }
      });
      /* Sắc nền của đảo riêng nằm trong địa hình nên phải dựng lại cả hòn đảo. */
      if (slot === "main") rebuildTerrain(activeSeason);
    }
    for (const slot of ISLE_SLOTS) rebuildShop(slot);
    syncIslands();

    /* ---------------------- xoáy nước ngoài khơi ---------------------- */
    const WHIRLPOOL_COUNT = compactGpu ? 3 : 5;
    /** Xoáy phải nằm ngoài thềm cát nhưng trong vành san hô, tránh đè lên đảo riêng. */
    function randomVortexSpot(target: THREE.Vector3) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 46 + Math.random() * (SAIL_LIMIT - 56);
        target.set(Math.cos(angle) * radius, WATER_LEVEL + 0.05, Math.sin(angle) * radius);
        const clash = DISTRICT_IDS.some((district) => target.distanceToSquared(ISLE_POSITIONS[district]) < Math.pow(ISLE_RADIUS + 7, 2));
        if (!clash) return;
      }
    }
    const whirlpools = Array.from({ length: WHIRLPOOL_COUNT }, () => {
      const pool = makeWhirlpool();
      randomVortexSpot(pool.group.position);
      scene.add(pool.group);
      staticTicks.push(pool.tick);
      return { pool, cooldown: 0 };
    });
    /** Bán kính bắt: du thuyền chạm vào là mở bảng câu cá. */
    const VORTEX_CATCH = 4.6;

    /* ---------------------------- player yacht ---------------------------- */
    const yachtHolder = new THREE.Group();
    yachtHolder.position.set(0, WATER_LEVEL + 0.43, 34);
    yachtHolder.visible = propsRef.current.voyage;
    scene.add(yachtHolder);
    let yachtTicks: TickFn[] = [];
    let yachtCamera = { height: 8, distance: 13 };
    let yachtLength = YACHT_LENGTH[1];

    function rebuildYacht() {
      disposeGroup(yachtHolder);
      const build = makeYacht(propsRef.current.yachtTier, m);
      yachtHolder.add(build.group);
      yachtTicks = build.ticks;
      yachtCamera = { height: build.cameraHeight, distance: build.cameraDistance };
      yachtLength = build.length;
    }
    rebuildYacht();

    let yachtHeading = 0;
    let yachtSpeed = 0;
    let wakeCooldown = 0;
    const heldKeys = new Set<string>();
    const wakes = Array.from({ length: 18 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({ color: index % 2 ? 0xc9f4ef : 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.34, 16), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = WATER_LEVEL + 0.09;
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
        yachtHolder.position.x - Math.sin(yachtHeading) * (yachtLength * 0.55),
        WATER_LEVEL + 0.1,
        yachtHolder.position.z - Math.cos(yachtHeading) * (yachtLength * 0.55)
      );
      wake.mesh.scale.setScalar(0.55 + yachtLength * 0.07);
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

    /* ------------------------------ bloom ------------------------------
       Đèn hải đăng, rune ngọc, vàng và xoáy nước đều là nguồn sáng — không có
       bloom thì chúng chỉ là những mảng màu phẳng. `RenderPass` vẽ vào bộ đệm
       tuyến tính (tone mapping bị hoãn lại), `OutputPass` mới tone-map và mã hoá
       sRGB một lần duy nhất ở cuối, nên nước và bầu trời — vốn tự gọi
       `<tonemapping_fragment>` — không bị nướng hai lần. */
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderPixelRatio);
    composer.setSize(container.clientWidth, container.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.62,
      0.72,
      0.82
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    /** Bloom là hiệu ứng đắt nhất trong khung hình; máy yếu thì tắt hẳn. */
    function bloomEnabled(): boolean {
      const prefs = propsRef.current.world;
      if (!prefs.effects) return false;
      if (prefs.quality === "balanced") return false;
      if (prefs.quality === "high") return true;
      return !compactGpu && renderPixelRatio >= 1;
    }

    /* ------------------------------ camera tween ------------------------------ */
    let tween: { t0: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3 } | null = null;
    function flyTo(view: ViewId, dur = 1.6) {
      const { pos, target } = viewPose(view, propsRef.current.activeIsle);
      tween = {
        t0: performance.now(),
        dur: (reduceMotion ? 0.25 : dur) * 1000,
        fromPos: camera.position.clone(),
        toPos: pos,
        fromTgt: controls.target.clone(),
        toTgt: target,
      };
      sound.whoosh();
    }

    function setVoyage(active: boolean) {
      yachtHolder.visible = active;
      yachtSpeed = 0;
      heldKeys.clear();
      controls.minDistance = active ? 6 : 9;
      controls.maxDistance = active ? 38 : 165;
      if (active) {
        const target = yachtHolder.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const behind = new THREE.Vector3(
          -Math.sin(yachtHeading) * yachtCamera.distance,
          yachtCamera.height,
          -Math.cos(yachtHeading) * yachtCamera.distance
        );
        tween = {
          t0: performance.now(),
          dur: reduceMotion ? 250 : 1200,
          fromPos: camera.position.clone(),
          toPos: yachtHolder.position.clone().add(behind),
          fromTgt: controls.target.clone(),
          toTgt: target,
        };
      }
    }

    /* ------------------------------ picking ------------------------------ */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;
    let lastPickAt = 0;
    const downPos = { x: 0, y: 0 };

    function pickAt(cx: number, cy: number): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -((cy - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets: THREE.Object3D[] = [
        lighthouse,
        pier,
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
      /* Raycast là phần đắt nhất trong khung hình; 60ms một lần là đủ mượt
         với con trỏ mà không ăn hết ngân sách CPU khi rê chuột nhanh. */
      const now = performance.now();
      const tip = tooltipRef.current;
      if (now - lastPickAt >= 60) {
        lastPickAt = now;
        const tag = pickAt(e.clientX, e.clientY);
        if (tag !== hovered) {
          hovered = tag;
          renderer.domElement.style.cursor = tag ? "pointer" : "grab";
        }
      }
      if (tip) {
        if (hovered) {
          const rect = container.getBoundingClientRect();
          tip.style.opacity = "1";
          tip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 10}px)`;
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
        if (tag === "fishing") propsRef.current.onFish("shore");
        else if (tag.startsWith("isle:")) propsRef.current.onSelect("isle", tag.slice(5) as DistrictId);
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
        const height = islandId ? LABEL_HEIGHT.isle(lv) : LABEL_HEIGHT[id](Math.min(lv, VISUAL_MAX));
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
      if (hovered === "fishing") {
        tip.innerHTML = `<strong>${t("fs.spot")}</strong><span>${t("fs.spotHint")}</span>`;
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
      composer.setSize(w, h);
      bloomPass.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    /* ------------------------------ API ------------------------------ */
    sceneApi.current = {
      flyTo,
      rebuildDistrict,
      rebuildIsle,
      rebuildDecor,
      rebuildYacht,
      rebuildShop,
      syncIslands,
      setVoyage,
      refreshEnvironment: () => applyEnvironment(true),
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
      return Math.hypot(position.x, position.z) < SAIL_LIMIT;
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      const rawDt = clock.getDelta();
      const dt = Math.min(0.05, rawDt);
      const t = clock.elapsedTime;
      applyEnvironment();

      /* ---- chớp giông ---- */
      const flash = weather.flash;
      lightning.intensity = flash * 2.6;
      if (flash > 0.01) renderer.toneMappingExposure = (0.82 + currentDaylight * 0.32) + flash * 0.5;

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
          composer.setPixelRatio(renderPixelRatio);
          composer.setSize(container.clientWidth, container.clientHeight);
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
        /* Tàu càng lớn càng nhanh nhưng cũng càng ì khi bẻ lái. */
        const topSpeed = 6.4 + propsRef.current.yachtTier * 0.7;
        const targetSpeed = throttle > 0 ? throttle * topSpeed : throttle < 0 ? throttle * (topSpeed * 0.42) : 0;
        yachtSpeed = THREE.MathUtils.damp(yachtSpeed, targetSpeed, throttle === 0 ? 2.7 : 1.9, dt);
        const agility = 0.82 - propsRef.current.yachtTier * 0.055;
        yachtHeading -= turn * dt * (agility + Math.abs(yachtSpeed) * 0.07) * (yachtSpeed < 0 ? -1 : 1);
        nextYachtPosition.copy(yachtHolder.position);
        nextYachtPosition.x += Math.sin(yachtHeading) * yachtSpeed * dt;
        nextYachtPosition.z += Math.cos(yachtHeading) * yachtSpeed * dt;
        if (yachtPositionAllowed(nextYachtPosition)) yachtHolder.position.copy(nextYachtPosition);
        else yachtSpeed *= -0.18;
        yachtHolder.position.y = WATER_LEVEL + 0.43 + Math.sin(t * 1.65) * 0.075;
        yachtHolder.rotation.set(Math.sin(t * 1.3) * 0.025, yachtHeading, -turn * 0.07 - Math.sin(t * 1.1) * 0.018);
        wakeCooldown -= dt;
        if (Math.abs(yachtSpeed) > 0.8 && wakeCooldown <= 0) {
          emitWake();
          wakeCooldown = THREE.MathUtils.clamp(0.24 - Math.abs(yachtSpeed) * 0.018, 0.09, 0.22);
        }
        /* Vách sáng ranh giới hiện dần trong 22 đơn vị cuối trước rạn san hô. */
        const distanceOut = Math.hypot(yachtHolder.position.x, yachtHolder.position.z);
        boundary.setProximity(THREE.MathUtils.smoothstep(distanceOut, SAIL_LIMIT - 22, SAIL_LIMIT));

        /* Lái vào xoáy nước: mở bảng câu cá, xoáy tắt rồi mọc lại chỗ khác. */
        for (const entry of whirlpools) {
          if (entry.cooldown > 0) continue;
          const dx = yachtHolder.position.x - entry.pool.group.position.x;
          const dz = yachtHolder.position.z - entry.pool.group.position.z;
          if (dx * dx + dz * dz > VORTEX_CATCH * VORTEX_CATCH) continue;
          entry.cooldown = 26;
          entry.pool.setActive(false);
          burst.fire(entry.pool.group.position.clone().setY(WATER_LEVEL + 1.2), "jade");
          propsRef.current.onVortex();
        }

        if (!tween) {
          desiredYachtTarget.set(yachtHolder.position.x, yachtHolder.position.y + 1.15, yachtHolder.position.z);
          followDelta.subVectors(desiredYachtTarget, controls.target).multiplyScalar(1 - Math.exp(-dt * 5));
          controls.target.add(followDelta);
          camera.position.add(followDelta);
        }
      } else {
        boundary.setProximity(0);
      }
      /* Xoáy đã dùng mọc lại ở chỗ khác sau vài chục giây — biển không bao giờ
         hết chỗ câu, nhưng cũng không đứng yên một điểm. */
      for (const entry of whirlpools) {
        if (entry.cooldown <= 0) continue;
        entry.cooldown -= dt;
        if (entry.cooldown <= 0) {
          randomVortexSpot(entry.pool.group.position);
          entry.pool.setActive(true);
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

      /* Trường hạt thời tiết luôn bám quanh camera nên không bao giờ thấy mép. */
      if (currentWeather !== "clear") weather.setCenter(controls.target.x, controls.target.z);

      controls.autoRotate = !propsRef.current.voyage && propsRef.current.selected === "overview" && !tween && !userInteracting && introDone && !reduceMotion;
      controls.update();

      for (const fn of staticTicks) fn(t, dt);
      for (const fn of yachtTicks) fn(t, dt);
      for (const d of DISTRICT_IDS) for (const fn of districtTicks[d]) fn(t, dt);
      for (const district of DISTRICT_IDS) for (const fn of isleTicks[district]) fn(t, dt);
      for (const district of DISTRICT_IDS) for (const fn of decorTicks[district]) fn(t, dt);
      for (const slot of ISLE_SLOTS) for (const fn of shopTicks[slot]) fn(t, dt);

      labelClock += dt;
      if (labelClock >= 1 / 30) {
        labelClock = 0;
        updateLabels();
        updateTooltipContent();
      }
      /* Bloom mạnh hơn về đêm: ban ngày ánh mặt trời đã đủ chói, thêm quầng sáng
         chỉ làm cảnh bệt màu. */
      if (bloomEnabled()) {
        bloomPass.strength = 0.34 + (1 - currentDaylight) * 0.62;
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
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
        const sprite = o as THREE.Sprite;
        if (sprite.isSprite) {
          sprite.material.map?.dispose();
          sprite.material.dispose();
        }
      });
      composer.dispose();
      envTarget?.dispose();
      pmrem.dispose();
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

  useEffect(() => {
    sceneApi.current?.rebuildYacht();
  }, [yachtTier]);

  /* Đặt hay cất một món ở Chợ chỉ dựng lại đúng hòn đảo đó. */
  const prevDecor = useRef<Record<IsleSlot, string> | null>(null);
  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    const next = {} as Record<IsleSlot, string>;
    for (const slot of ISLE_SLOTS) {
      const key = (decor[slot] ?? []).join(",");
      next[slot] = key;
      if (prevDecor.current && prevDecor.current[slot] === key) continue;
      if (prevDecor.current) api.rebuildShop(slot);
    }
    prevDecor.current = next;
  }, [decor]);

  /* Đổi mùa, thời tiết hoặc chất lượng thì áp dụng ngay, không đợi sang phút mới. */
  useEffect(() => {
    sceneApi.current?.refreshEnvironment();
  }, [world.mode, world.season, world.weather, world.quality, world.effects]);

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
