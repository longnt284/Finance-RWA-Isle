import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GradeShader } from "./grade";
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
  type TerrainPalette,
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
  terrainHeightAt,
  DECOR_IDS,
} from "./build";
import type { TickFn, Mats, DecorId } from "./build";
import { makeGrass, DUNE_BAND } from "./grass";
import type { Grass } from "./grass";
import { makeCameraRig, polarBetween, CAMERA_SHOTS, SHOT_BY_ID } from "./camera";
import type { ShotId } from "./camera";
import {
  makeProp, placeProp, buildVillage, buildFishingPier, makeWhirlpool,
  propFlowerbed as makeFlowerPatch, PIER_POSITION, PIER_ROTATION,
  HARBOR_POSITION, HARBOR_ROTATION, buildHarbor, makeWaterfall,
} from "./props";
import { COAST_MAX, SHORELINE_U, coastRadius, scatter } from "./shape";
import { makeSky, makeSun, makeMoon, makeShootingStars, makeCloudLayer, skyStateFor, skyGradient } from "./atmosphere";
import { makeOcean, makeSandShelf, makeBoundary, TERRITORY_RADIUS, WATER_LEVEL } from "./ocean";
import { makeWeather } from "./weather";
import { makeYacht, YACHT_LENGTH } from "./yacht";
import { SEASON_PALETTES, WEATHER_PROFILES, seasonForDate, autoWeather, goldenPhase, goldenWeatherOk } from "../lib/season";
import { weatherBias } from "../lib/barometer";
import type { BarometerBand } from "../lib/barometer";
import type { Season, WeatherId, GoldenKind } from "../lib/season";
import { SHOP_BY_ID } from "../lib/shop";
import type { GroundPalette } from "../lib/shop";
import { DISTRICTS, ISLE_UNLOCK_LEVELS, ISLE_SLOTS, VISUAL_MAX } from "../state/store";
import type { DistrictId, ViewId, IslandTheme, IsleSlot, WorldPrefs, YachtTier } from "../state/store";
import { makeT } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import { sound } from "../lib/audio";

export interface WorldHandle {
  fireBurst(view: ViewId, kind: "gold" | "jade"): void;
  /** Bay tới một trong những góc máy đã ngắm sẵn. */
  flyToShot(id: ShotId): void;
  /** Chụp khung hình đang hiển thị ở độ phân giải gấp đôi, trả về data URL PNG. */
  capture(): string | null;
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
  /** Bấm vào bến cảng trong thế giới 3D thì mở bảng viễn dương. */
  onHarbor: () => void;
  /** Dải phong vũ biểu thị trường — nghiêng bảng cân thời tiết tự động. */
  barometer: BarometerBand;
  /** Du thuyền lọt vào một xoáy nước ngoài khơi. */
  onVortex: () => void;
  /** Giờ trong ngày do chế độ ảnh ấn định (0..24), hoặc `null` để bám đồng hồ thật. */
  timeOverride: number | null;
  /** Chế độ ảnh và chế độ "chỉ thế giới" đều tắt nhãn công trình. */
  showLabels: boolean;
  /** Mặt trời vừa chạm chân trời trong một khung hình đáng giữ lại. */
  onGolden: (kind: GoldenKind) => void;
}

const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

/**
 * Tắt `lagSmoothing` của GSAP.
 *
 * Mặc định, khi một khung hình kéo dài quá 500ms, GSAP chỉ nhích đồng hồ nội bộ
 * thêm 33ms để hoạt hình không "nhảy cóc". Với hoạt hình giao diện thì đó là
 * lựa chọn đúng; với chuyến bay của camera thì nó là thảm hoạ: trên máy đang
 * chạy 2 khung/giây, một cú bay 1,9 giây kéo dài thành gần một phút, và người
 * chơi tưởng nút bấm bị hỏng. Tắt đi thì thời lượng bám đồng hồ thật — máy yếu
 * thấy chuyến bay giật hơn, nhưng vẫn đúng 1,9 giây.
 */
gsap.ticker.lagSmoothing(0);

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
  levels, selected, onSelect, handleRef, lang, islands, activeIsle, voyage, helmInput, yachtTier, world, decor,
  onFish, onHarbor, barometer, onVortex, timeOverride, showLabels, onGolden,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const propsRef = useRef({
    levels, selected, onSelect, lang, islands, activeIsle, voyage, helmInput, yachtTier, world, decor,
    onFish, onHarbor, barometer, onVortex, timeOverride, showLabels, onGolden,
  });
  propsRef.current = {
    levels, selected, onSelect, lang, islands, activeIsle, voyage, helmInput, yachtTier, world, decor,
    onFish, onHarbor, barometer, onVortex, timeOverride, showLabels, onGolden,
  };

  const sceneApi = useRef<{
    flyTo: (view: ViewId, dur?: number) => void;
    flyToShot: (id: ShotId) => void;
    capture: () => string | null;
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
    /* Photoreal cần pixel để nét: desktop lên tới 2.0, mobile 1.35. Composer
       có MSAA riêng nên cờ antialias của renderer chỉ là lớp dự phòng khi
       post tắt — bật luôn để khung fallback vẫn sắc. */
    const maxPixelRatio = compactGpu ? 1.35 : 2.0;
    let renderPixelRatio = Math.min(window.devicePixelRatio, maxPixelRatio);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", stencil: false });
    renderer.setPixelRatio(renderPixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    /* three r185 đã bỏ PCFSoftShadowMap (tự rơi về PCF thường kèm warning).
       Dùng PCFShadowMap tường minh: hết warning, và `shadow.radius` có tác
       dụng làm mềm viền bóng — thứ PCFSoft vốn bỏ qua. */
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", lang === "vi" ? "Bản đồ quần đảo tài chính 3D tương tác" : "Interactive 3D finance archipelago");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08222b, 0.011);

    /* Cận cảnh 0,6 và viễn cảnh 950 thay cho 0,1–1400. GTAO đọc chiều sâu từ
       một depth texture số nguyên: tỉ lệ xa/gần 14.000 lần như bản trước làm
       độ chính xác vỡ vụn, bóng tiếp xúc biến thành những vệt sọc. Vòm trời
       nằm ở bán kính 620 nên 950 vẫn thừa chỗ. */
    const camera = new THREE.PerspectiveCamera(46, Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight)), 0.1, 1400);
    const BASE_FOV = 46;
    camera.position.set(4, 95, 155);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 9;
    controls.maxDistance = 165;
    /* `maxPolarAngle` được giá máy ghi lại mỗi khung theo khoảng cách; giá trị
       này chỉ là điểm khởi đầu cho khung hình đầu tiên. */
    controls.maxPolarAngle = 1.5;
    controls.minPolarAngle = 0.1;
    controls.autoRotateSpeed = 0.4;
    controls.target.set(0, 1.2, 0);

    let userInteracting = false;
    let idleTimer = 0;
    const onCtlStart = () => {
      userInteracting = true;
      window.clearTimeout(idleTimer);
      /* Người chơi vừa cầm lấy chuột: khung hình dựng sẵn hết hiệu lực, giới
         hạn góc tự động quay lại làm việc của nó. */
      rig.polarOverride = null;
    };
    const onCtlEnd = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        userInteracting = false;
      }, 4500);
    };
    controls.addEventListener("start", onCtlStart);
    controls.addEventListener("end", onCtlEnd);

    const rig = makeCameraRig(camera, controls);

    /* ------------------------------ lights ------------------------------
       3-point điện ảnh: key mặt trời có bóng, fill bán cầu trời/đất,
       rim lam-lục tách khối khỏi nền biển. Đèn đường là pool 4 PointLight
       chỉ bật về đêm để tiền cảnh có điểm ấm mà không tốn draw. */
    const hemi = new THREE.HemisphereLight(0xc4e8ec, 0x6a6047, 0.62);
    scene.add(hemi);
    const sunLight = new THREE.DirectionalLight(0xffd9a8, 2.2);
    sunLight.castShadow = true;
    /* Khung bóng đổ rộng 104 đơn vị. Ở 2048 điểm ảnh thì mỗi texel phủ 5cm —
       đủ để mép bóng của lan can, cột đèn hay tàu lá dừa vỡ thành răng cưa.
       Gấp đôi lên 4096 đưa con số đó xuống 2,5cm, và đó là khác biệt giữa
       "bóng đổ có hình" với "vệt tối". Nhưng tấm bóng đổ cũng là thứ tốn bộ
       nhớ và băng thông bậc nhất, nên nó phải nghe theo mức chất lượng người
       chơi chọn chứ không được cố định. */
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -52;
    sunLight.shadow.camera.right = 52;
    sunLight.shadow.camera.top = 52;
    sunLight.shadow.camera.bottom = -52;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.0002;
    /* `normalBias` đẩy điểm lấy mẫu ra theo pháp tuyến. Nó xử lý được vệt sọc
       tự đổ bóng trên mặt cong mà `bias` thuần tuý không xử lý nổi, lại không
       làm bóng "bay" khỏi chân vật thể như khi tăng `bias` lên. */
    sunLight.shadow.normalBias = 0.035;
    sunLight.shadow.radius = 2.2;
    scene.add(sunLight);
    /* Ánh trăng là nguồn sáng riêng nên ban đêm vẫn đọc được hình khối. */
    const moonLight = new THREE.DirectionalLight(0x9fc4ff, 0);
    scene.add(moonLight);
    const rim = new THREE.DirectionalLight(0x5ce8c4, 0.62);
    rim.position.set(38, 18, 42);
    scene.add(rim);
    /* Đèn đường ấm quanh quảng trường — ban ngày tắt, ban đêm bật dần. */
    const lampLights: THREE.PointLight[] = [];
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xffc069, 0, 16, 1.8);
      scene.add(pl);
      lampLights.push(pl);
    }
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

    function refreshEnvMap(daylight: number, fogHex: number, shallowHex: number, sunDir: THREE.Vector3) {
      /* Sắc trời được tính lại mỗi lần vì mặt nước cũng đọc chúng để phản chiếu;
         chỉ riêng việc *nướng* cubemap mới cần dè sẻn. */
      envTop.setHex(0x0b2b45).lerp(new THREE.Color(0x8fc7e8), daylight);
      envHorizon.setHex(fogHex).lerp(new THREE.Color(0xffd9b0), daylight * 0.5);
      envGround.setHex(shallowHex).multiplyScalar(0.35 + daylight * 0.6);

      /* Chỉ nướng lại khi ánh sáng đổi đủ nhiều — mỗi phút một lần là quá thừa. */
      const sunSlot = `${Math.round(Math.atan2(sunDir.z, sunDir.x) * 4)}|${Math.round(sunDir.y * 8)}`;
      const key = `${Math.round(daylight * 12)}|${fogHex}|${shallowHex}|${sunSlot}`;
      if (key === envKey) return;
      envKey = key;
      /* Tấm 32×16 của bản trước quá thô để mang được đĩa mặt trời: sau khi PMREM
         làm mờ, vàng và kính chỉ nhận về một mảng sáng đều. Ở 96×48 thì mặt trời
         còn lại thành một điểm chói thật, và đó chính là highlight khiến kim loại
         ra kim loại. */
      const W = 96;
      const H = 48;
      const data = new Uint8Array(W * H * 4);
      const mix = new THREE.Color();
      const sunTint = new THREE.Color(0xfff0d0).lerp(new THREE.Color(0xff9a55), 1 - THREE.MathUtils.clamp(sunDir.y * 2.2, 0, 1));
      const dir = new THREE.Vector3();
      for (let y = 0; y < H; y++) {
        /* v = 0 ở đỉnh trời, 1 ở đáy biển; chân trời nằm giữa. */
        const v = y / (H - 1);
        const theta = v * Math.PI;
        for (let x = 0; x < W; x++) {
          if (v < 0.5) mix.copy(envTop).lerp(envHorizon, Math.pow(v * 2, 0.7));
          else mix.copy(envHorizon).lerp(envGround, Math.pow((v - 0.5) * 2, 0.6));
          /* Đĩa mặt trời nướng thẳng vào bản đồ môi trường. */
          const phi = (x / W) * Math.PI * 2 - Math.PI;
          dir.set(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
          const align = dir.dot(sunDir);
          if (align > 0.986 && sunDir.y > -0.05) {
            const strength = THREE.MathUtils.smoothstep(align, 0.986, 0.9995) * (0.35 + daylight * 0.9);
            mix.lerp(sunTint, strength);
          }
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
      scene.environmentIntensity = 0.55 + daylight * 0.6;
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

    let terrainKey: string | null = null;
    let activeSeason: Season = seasonForDate(new Date());
    /* Thảm cỏ được dựng sau, nhưng `rebuildTerrain` là nơi duy nhất biết bảng
       màu của mùa nên nó vẫn phải là chỗ tô lại cỏ. */
    let grassLayer: Grass | null = null;
    let duneLayer: Grass | null = null;

    /** Sắc lá của mùa, đã pha sắc nền người chơi mua ở Chợ (nếu có). */
    function foliageOf(season: Season): TerrainPalette {
      const ground = groundPaletteOf("main");
      const palette = SEASON_PALETTES[season];
      /* Sắc nền mua ở Chợ pha vào màu mùa chứ không thay hẳn — mùa đông vẫn ra
         mùa đông, chỉ là thảm cỏ mang sắc người chơi chọn. */
      return {
        foliage: ground ? new THREE.Color(palette.foliage).lerp(new THREE.Color(ground.top), 0.72).getHex() : palette.foliage,
        foliageAlt: ground
          ? new THREE.Color(palette.foliageAlt).lerp(new THREE.Color(ground.rim), 0.55).getHex()
          : palette.foliageAlt,
        snow: palette.snow,
      };
    }

    /* Lưới địa hình dựng đúng một lần. Sang mùa chỉ ghi lại mảng màu. Bản trước
       vứt cả khối đi rồi dựng lại, nên danh sách vật cản của camera phải được
       vá tay mỗi lần — quên một nhịp là camera chui xuống dưới đảo. */
    const terrain = buildTerrain(foliageOf(activeSeason));
    scene.add(terrain.mesh);

    function rebuildTerrain(season: Season) {
      const ground = groundPaletteOf("main");
      const key = `${season}|${ground ? ground.top.toString(16) : "-"}`;
      const palette = SEASON_PALETTES[season];
      const tint = foliageOf(season);
      /* Cây và thảm cỏ dùng vật liệu dùng chung nên chỉ cần đổi màu, không dựng lại. */
      m.leaves1.color.setHex(palette.foliage);
      m.leaves2.color.setHex(palette.foliageAlt);
      grassLayer?.setPalette(tint.foliage, tint.foliageAlt, palette.snow);
      duneLayer?.setPalette(tint.foliage, tint.foliageAlt, palette.snow);
      if (terrainKey === key) return;
      terrainKey = key;
      terrain.setPalette(tint);
    }
    rebuildTerrain(activeSeason);

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
    const waterSkyTop = new THREE.Color();
    const waterSkyHorizon = new THREE.Color();
    let lastEnvKey = "";
    let currentWeather: WeatherId = "clear";
    let currentDaylight = 0.7;

    /**
     * Kích thước tấm bóng đổ theo mức chất lượng. Đổi lúc đang chạy được, miễn
     * là huỷ tấm cũ đi để three cấp phát lại ở kích thước mới.
     */
    let shadowSize = 0;
    function applyShadowQuality() {
      const prefs = propsRef.current.world;
      const wanted = compactGpu ? 1024 : prefs.quality === "high" ? 4096 : prefs.quality === "balanced" ? 1536 : 2560;
      if (wanted === shadowSize) return;
      shadowSize = wanted;
      sunLight.shadow.mapSize.set(wanted, wanted);
      sunLight.shadow.map?.dispose();
      sunLight.shadow.map = null;
    }

    /**
     * Đồng hồ của thế giới. Chế độ ảnh ấn định một giờ cụ thể để người chơi
     * dựng khung hình hoàng hôn lúc mười giờ sáng; mọi lúc khác nó là đồng hồ
     * thật của máy.
     */
    function worldNow(): Date {
      const override = propsRef.current.timeOverride;
      const now = new Date();
      if (override === null) return now;
      const virtual = new Date(now.getTime());
      virtual.setHours(Math.floor(override), Math.round((override % 1) * 60), 0, 0);
      return virtual;
    }

    /** Cường độ hạt theo thiết lập chất lượng — máy yếu vẫn mượt. */
    function effectStrength(): number {
      const prefs = propsRef.current.world;
      if (!prefs.effects || reduceMotion) return 0;
      if (prefs.quality === "balanced") return 0.5;
      if (prefs.quality === "high") return 1;
      return compactGpu ? 0.5 : 1;
    }

    function applyEnvironment(force = false) {
      const now = worldNow();
      const prefs = propsRef.current.world;
      const minute = now.getHours() * 60 + now.getMinutes();
      const season: Season = prefs.mode === "manual" ? prefs.season : seasonForDate(now);
      const state = skyStateFor(now);
      const isNight = state.daylight < 0.28;
      /* Thời tiết tự động nghiêng theo phong vũ biểu thị trường. Ở chế độ tay
         thì không: người chơi đã tự chọn trời rồi, đừng cãi lại họ. */
      const band = propsRef.current.barometer;
      const chosen: WeatherId =
        prefs.mode === "manual" ? prefs.weather : autoWeather(now, season, isNight, weatherBias(band));
      const key = `${minute}|${season}|${chosen}|${prefs.quality}|${prefs.effects}|${band}`;
      if (!force && key === lastEnvKey) return;
      lastEnvKey = key;

      const palette = SEASON_PALETTES[season];
      const profile = WEATHER_PROFILES[chosen];
      currentWeather = chosen;
      currentDaylight = state.daylight;
      activeSeason = season;
      rebuildTerrain(season);
      applyShadowQuality();
      refreshEnvMap(state.daylight, palette.fog, palette.shallow, state.sunDir);

      /* ---- ánh sáng ---- */
      const lit = state.daylight * profile.lightScale;
      sunLight.position.copy(state.sunDir).multiplyScalar(110);
      sunLight.intensity = 0.18 + lit * 2.1;
      sunLight.color.copy(sunWarm).lerp(sunPale, state.daylight);
      seasonTint.setHex(palette.sunTint);
      sunLight.color.lerp(seasonTint, 0.35);
      sunLight.castShadow = state.sunDir.y > 0.02;

      moonLight.position.copy(state.moonDir).multiplyScalar(110);
      moonLight.intensity = Math.max(0, state.moonDir.y) * (1 - state.daylight) * 0.7 * profile.lightScale;

      hemi.intensity = 0.32 + lit * 0.78;
      rim.intensity = 0.28 + (1 - state.daylight) * 0.5;
      renderer.toneMappingExposure = 0.94 + state.daylight * 0.34 + palette.warmth * 0.07;

      /* Đèn đường: tắt ban ngày, ấm dần về đêm. 4 đèn đặt quanh quảng trường. */
      const nightK = 1 - THREE.MathUtils.smoothstep(state.daylight, 0.12, 0.45);
      const lampBase: [number, number][] = [[6.5, 6.5], [-6.5, 6.5], [6.5, -6.5], [-6.5, -6.5]];
      lampLights.forEach((pl, i) => {
        const [lx, lz] = lampBase[i % lampBase.length];
        pl.position.set(lx, 2.6, lz);
        pl.intensity = nightK * 14 * profile.lightScale;
      });

      /* ---- sương mù và biển ---- */
      /* Sương mù nhạt đi nhiều so với bản trước. Ở mật độ 0,0085 thì ngay cả đảo
         chính — cách camera khoảng 110 đơn vị — đã chìm một nửa vào sương, khiến
         cả khung hình bạc phếch thay vì trong veo như vùng biển nhiệt đới. */
      fogColor.setHex(palette.fog).lerp(new THREE.Color(0x7fb8cf), state.daylight * 0.38).multiplyScalar(0.45 + state.daylight * 0.62);
      (scene.fog as THREE.FogExp2).color.copy(fogColor);
      (scene.fog as THREE.FogExp2).density = 0.0036 * profile.fogScale;
      shallowColor.setHex(palette.shallow);
      skyGradient(state, profile.overcast, waterSkyTop, waterSkyHorizon);
      ocean.apply({
        daylight: state.daylight,
        sunDir: state.sunDir,
        moonDir: state.moonDir,
        fog: fogColor,
        shallow: shallowColor,
        rain: profile.rain,
        /* Đúng bộ màu mà shader vòm trời đang vẽ, nên trời in xuống nước khớp
           với trời treo trên đầu — kể cả khi mây kéo đến. */
        skyTop: waterSkyTop,
        skyHorizon: waterSkyHorizon,
      });
      boundary.setTint(shallowColor);

      /* ---- bầu trời ---- */
      sky.apply(state, profile.overcast);
      sunBody.apply(state);
      moonBody.apply(state);
      shootingStars.setActive(isNight && profile.overcast < 0.4 && effectStrength() > 0);
      cloudTint.setHex(palette.fog).lerp(new THREE.Color(0xd8e6e2), 0.25 + state.daylight * 0.5);
      cloudLayer.setCover(profile.overcast, cloudTint);
      /* Bóng mây đậm nhất lúc trời có mây rải rác. Quang hẳn thì không có gì để
         đổ bóng, mà u ám hẳn thì cả bầu trời là một tấm mây liền — cũng không
         có bóng, chỉ có ánh sáng bẹt. Cả hai đầu đều về 0. */
      const scatter = profile.overcast * (1 - profile.overcast) * 4;
      terrain.setCloudShadow(scatter * state.daylight * 0.9);

      /* ---- hạt thời tiết ---- */
      weather.set(chosen, effectStrength());
      (dust.points.material as THREE.PointsMaterial).opacity = 0.18 + state.daylight * 0.42;
      dust.points.visible = effectStrength() > 0;

      /* Gió là thứ duy nhất trong khung hình cho biết trời đang lặng hay đang
         giông trước cả khi hạt mưa rơi xuống. Nó chạy trong vertex shader nên
         không tốn gì, và vẫn thổi kể cả khi người chơi tắt hạt hiệu ứng. */
      const wind = reduceMotion ? 0 : 0.24 + profile.rain * 0.7 + profile.overcast * 0.35;
      grassLayer?.setWind(wind);
      /* Cỏ đụn cao hơn nên ngả mạnh hơn trong cùng một cơn gió. */
      duneLayer?.setWind(wind * 1.25);

      checkGolden(now, chosen);
    }

    /* ---------------------- khoảnh khắc bình minh / hoàng hôn ----------------------
       Thời gian trong trò này vẫn trôi đều, nhưng có hai lát cắt trong ngày mà
       khung hình đẹp hẳn lên. Hệ thống biết chính xác lúc nào chúng tới, nên nó
       lên tiếng mời người chơi ở lại thay vì để họ tình cờ bắt gặp. */
    let goldenKey = "";
    function checkGolden(now: Date, weather: WeatherId) {
      /* Chỉ mời khi đó là khoảnh khắc thật. Giờ do chế độ ảnh ấn định thì người
         chơi đang tự dựng hoàng hôn rồi, mời nữa là thừa. */
      if (propsRef.current.timeOverride !== null || propsRef.current.world.mode === "manual") return;
      const kind = goldenPhase(now);
      if (!kind) return;
      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}|${kind}`;
      if (key === goldenKey) return;
      /* Trời mưa hay giông thì mặt trời chẳng chạm được mặt biển. Không ghi
         `goldenKey` để nếu trời quang lại trong cửa sổ ấy thì vẫn kịp mời. */
      if (!goldenWeatherOk(weather)) return;
      goldenKey = key;
      propsRef.current.onGolden(kind);
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

    /* ---------------------- cây cối, đá và đèn ----------------------
       Bản trước là ba mảng toạ độ chép tay: hai mươi bảy cây thông, hai mươi
       bốn cây dừa, mười bốn hòn đá. Chúng không giãn theo hòn đảo được — nới
       bán kính lên là cả vành ngoài trống trơn, mà muốn lấp thì phải gõ tay
       thêm mấy chục dòng toạ độ rồi tự nhẩm xem cái nào rơi xuống biển.

       `scatter` gieo tất định theo hạt giống nên bố cục vẫn cố định qua các
       lần tải trang, nhưng nó biết đường bờ, biết chỗ nào là lối đi lát đá, và
       biết chỗ nào là cát. */
    const scenery = new THREE.Group();

    /* Bến câu và bến cảng phải giữ được khoảng trống quanh chúng. */
    const clearings: [number, number, number][] = [
      [PIER_POSITION.x, PIER_POSITION.z, 6.5],
      [HARBOR_POSITION.x, HARBOR_POSITION.z, 8.5],
    ];
    const nearClearing = (x: number, z: number) =>
      clearings.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r);

    /* Rừng thông trên cao nguyên: tránh vách đá vì thông không mọc trên đá trần. */
    for (const spot of scatter({
      count: 74,
      minU: 0.3,
      maxU: 0.73,
      seed: 0x7d3e1,
      spacing: 2.5,
      minFlatness: 0.72,
      maxSand: 0.05,
      avoidCliff: true,
      reject: nearClearing,
    })) {
      const tree = makeTree(m, 0.78 + spot.roll * 0.5, spot.roll > 0.5 ? m.leaves1 : m.leaves2, spot.roll);
      tree.position.set(spot.x, spot.y, spot.z);
      tree.rotation.y = spot.roll * Math.PI * 2;
      scenery.add(tree);
    }

    /* Dừa men theo bãi cát — chúng là thứ vẽ ra đường bờ khi nhìn từ xa. */
    for (const spot of scatter({
      count: 62,
      minU: 0.72,
      maxU: 0.94,
      seed: 0x2c19f,
      spacing: 2.3,
      minSand: 0.25,
      avoidCliff: true,
      reject: nearClearing,
    })) {
      const palm = makePalm(m);
      palm.position.set(spot.x, spot.y, spot.z);
      palm.scale.setScalar((0.82 + spot.roll * 0.4) * 1.25);
      palm.rotation.y = spot.roll * Math.PI * 2;
      scenery.add(palm);
    }

    /* Đá rải ngoài mép nước và trên mũi đá, cho đường bờ có nhịp. */
    for (const spot of scatter({
      count: 46,
      minU: 0.78,
      maxU: 0.99,
      seed: 0x5ba07,
      spacing: 2.0,
      reject: nearClearing,
    })) {
      const rock = makeRock(m, 0.55 + spot.roll * 0.85, spot.roll);
      rock.position.set(spot.x, spot.y + 0.1, spot.z);
      rock.rotation.y = spot.roll * 7.3;
      scenery.add(rock);
    }

    for (const d of DISTRICT_IDS) {
      const a = DISTRICT_POS[d];
      const len = Math.sqrt(a.x * a.x + a.z * a.z);
      const px = a.x * 0.72 + (-a.z / len) * 1.6;
      const pz = a.z * 0.72 + (a.x / len) * 1.6;
      const lamp = makeLamp(m);
      lamp.position.set(px, terrainHeightAt(px, pz), pz);
      scenery.add(lamp);
    }

    /* ---------------------- thảm cỏ dựng bằng instancing ----------------------
       Bốn nghìn ngọn cỏ trong đúng một lệnh vẽ. Không có nó, khoảng giữa những
       công trình chỉ là một mảng màu xanh phẳng. Cây thông và cây dừa vẫn dựng
       từng cây một: mỗi cây có số tầng tán, độ cong thân và độ rủ tàu lá riêng,
       gộp chúng thành một hình dùng chung sẽ đánh mất đúng cái làm chúng đẹp. */
    /* 15.000 ngọn desktop / 3.200 mobile, vẫn trong đúng một lệnh vẽ.

       Con số này không phải chọn cho đẹp: vùng cỏ nở từ bán kính 17,4 lên 23,2
       nên diện tích tăng 1,78 lần. Giữ nguyên 8.000 ngọn là mật độ tụt đi gần
       một nửa, và khoảng giữa các công trình lại thành mảng phẳng — đúng thứ mà
       thảm cỏ sinh ra để xoá. */
    grassLayer = makeGrass(reduceMotion ? 0 : compactGpu ? 3200 : 15000);
    if (grassLayer.mesh) {
      scene.add(grassLayer.mesh);
      staticTicks.push(grassLayer.tick);
    }
    /* Dải cỏ đụn chờm qua ranh giới cỏ–cát và thò tiếp ra bãi. Không có nó thì
       chỗ cỏ gặp cát là một đường màu cắt ngang — hai mảng dán cạnh nhau chứ
       không phải một bãi biển. Một lệnh vẽ nữa, mật độ bằng một phần tư. */
    duneLayer = makeGrass(reduceMotion ? 0 : compactGpu ? 900 : 4200, DUNE_BAND);
    if (duneLayer.mesh) {
      scene.add(duneLayer.mesh);
      staticTicks.push(duneLayer.tick);
    }
    /* Dựng xong mới có gì để tô: gọi lại để thảm cỏ nhận bảng màu của mùa. */
    rebuildTerrain(activeSeason);
    const FLOWER_COLORS = [0xb79cff, 0xff9ac1, 0xf0c268, 0x5ce8c4, 0xe9f3f0];
    for (const spot of scatter({
      count: 24,
      minU: 0.2,
      maxU: 0.68,
      seed: 0x9f4d2,
      spacing: 3.4,
      minFlatness: 0.85,
      maxSand: 0.02,
      avoidCliff: true,
      reject: nearClearing,
    })) {
      const bed = makeFlowerPatch(FLOWER_COLORS[Math.floor(spot.roll * FLOWER_COLORS.length) % FLOWER_COLORS.length]);
      bed.position.set(spot.x, spot.y, spot.z);
      bed.rotation.y = spot.roll * 6.3;
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

    const falls = makeWaterfall();
    scene.add(falls.group);
    staticTicks.push(falls.tick);

    const harbor = buildHarbor(m, staticTicks);
    harbor.position.copy(HARBOR_POSITION);
    harbor.rotation.y = HARBOR_ROTATION;
    harbor.userData.tag = "harbor";
    scene.add(harbor);

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
      { g: makeBoat(m), r: 62, speed: 0.04, phase: 0.8 },
      { g: makeBoat(m), r: 78, speed: -0.028, phase: 3.6 },
      { g: makeBoat(m), r: 96, speed: 0.021, phase: 5.1 },
    ];
    boats.forEach((b) => scene.add(b.g));

    const birds: (ReturnType<typeof makeBird> & { r: number; h: number; speed: number; phase: number })[] = [];
    for (let i = 0; i < 5; i++) {
      const b = makeBird();
      scene.add(b.group);
      birds.push({ ...b, r: 24 + Math.random() * 14, h: 11 + Math.random() * 7, speed: 0.22 + Math.random() * 0.16, phase: Math.random() * Math.PI * 2 });
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
      /* `seaRadius` phải vượt hẳn mép nước của từng hòn đảo, còn `seaY` là mực
         nước tính theo gốc của nhóm chứa — đảo riêng nằm cao hơn đảo chính. */
      const layout =
        slot === "main"
          ? { radius: 25.5, seaRadius: COAST_MAX + 2.6, seaY: WATER_LEVEL }
          : { radius: ISLE_RADIUS - 1.4, seaRadius: ISLE_RADIUS + 1.6, seaY: WATER_LEVEL - 0.2 };
      const ids = propsRef.current.decor[slot] ?? [];
      ids.forEach((id, index) => {
        const item = SHOP_BY_ID.get(id);
        /* `ground` không có hình khối riêng — nó nằm trong bảng màu nền đảo. */
        if (!item || item.kind === "ground") return;
        const copies = Math.max(1, item.count ?? 1);
        for (let copy = 0; copy < copies; copy++) {
          const node = makeProp(item, m, shopTicks[slot]);
          placeProp(item, index, layout, holder, node, copy);
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
        const radius = COAST_MAX + 22 + Math.random() * (SAIL_LIMIT - COAST_MAX - 32);
        /* Đỉnh sóng cao tới 0,34 so với mực nước trung bình; đặt vòng xoáy thấp
           hơn thế thì nó lúc ẩn lúc hiện sau từng con sóng. */
        target.set(Math.cos(angle) * radius, WATER_LEVEL + 0.42, Math.sin(angle) * radius);
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
    /** Bán kính bắt: rộng hơn vòng xoáy nhìn thấy để lái vào không phải ngắm. */
    const VORTEX_CATCH = 6.5;

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
    /* Bộ đệm của composer phải tự khử răng cưa: cờ `antialias` của renderer chỉ
       áp cho khung hình vẽ thẳng ra màn hình, nên trước đây hễ bật bloom là mọi
       đường mái, cột buồm và mép lá lại lởm chởm. Đây chính là chỗ chữ "sắc
       nét" bị đánh mất. */
    /* MSAA 8x trên desktop cho mép mái, cột buồm, tàu lá không còn răng cưa
       ngay cả khi bloom bật. Mobile giữ 4x — đủ sắc mà không đốt GPU. */
    const composerTarget = new THREE.WebGLRenderTarget(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight),
      { type: THREE.HalfFloatType, samples: compactGpu ? 4 : 8 }
    );
    const composer = new EffectComposer(renderer, composerTarget);
    composer.setPixelRatio(renderPixelRatio);
    composer.setSize(container.clientWidth, container.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    /* ------------------------------ GTAO ------------------------------
       Che khuất môi trường theo phương pháp ground-truth: chỗ hai khối gặp
       nhau — chân tường, kẽ mái, gốc cây, mép bậc thềm — tối lại đúng như ngoài
       đời. Đây là thứ khiến hòn đảo hết trông như đồ chơi nhựa xếp trên mặt
       phẳng. Bán kính để 0,75 đơn vị: nhà ở đây cao 5–10 đơn vị nên đó đúng là
       cỡ của một bóng tiếp xúc, còn để rộng hơn thì cả sườn đảo xám lại. */
    const gtaoPass = new GTAOPass(scene, camera, container.clientWidth, container.clientHeight);
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    gtaoPass.blendIntensity = 0.9;
    gtaoPass.updateGtaoMaterial({
      radius: 0.75,
      distanceExponent: 1.4,
      thickness: 1.2,
      scale: 1.05,
      samples: compactGpu ? 8 : 16,
      screenSpaceRadius: false,
    });
    composer.addPass(gtaoPass);

    /* Bloom điện ảnh: ngưỡng cao để chỉ đèn, mặt trời, rune mới nở quầng;
       radius rộng cho halo mềm, strength điều theo ngày/đêm ở renderFrame. */
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.55,
      0.85,
      0.85
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    /* Chỉnh màu và "khuyết tật ống kính" đi sau cùng, tức là trên dữ liệu đã
       tone-map — đúng thứ tự của một chuỗi hậu kỳ thật. */
    const gradePass = new ShaderPass(GradeShader);
    gradePass.material.uniforms.uResolution.value.set(container.clientWidth, container.clientHeight);
    composer.addPass(gradePass);

    /**
     * Bloom là hiệu ứng đắt nhất trong khung hình. Ở chế độ tự động, nó tự tắt
     * khi thời gian dựng khung vượt 26ms — máy yếu giữ được nhịp mượt thay vì
     * đẹp mà giật. Người chơi chọn "cao" thì tôn trọng lựa chọn đó.
     */
    let averageFrameMs = 16;
    function bloomEnabled(): boolean {
      const prefs = propsRef.current.world;
      if (!prefs.effects) return false;
      if (prefs.quality === "balanced") return false;
      if (prefs.quality === "high") return true;
      return !compactGpu && renderPixelRatio >= 1 && averageFrameMs < 26;
    }

    /**
     * Chuỗi hậu kỳ tính cả lớp chỉnh màu, nên nó bật ở cả mức "cân bằng" —
     * lớp đó chỉ tốn đúng một lượt vẽ toàn màn hình nhưng lại là thứ mang lại
     * phần lớn cảm giác "ảnh chụp". Chỉ khi người chơi tắt hẳn hiệu ứng, hoặc
     * máy yếu đang tụt khung hình, mới vẽ thẳng ra màn hình.
     */
    function postEnabled(): boolean {
      const prefs = propsRef.current.world;
      if (!prefs.effects) return false;
      if (prefs.quality === "high") return true;
      return !compactGpu || averageFrameMs < 30;
    }

    /**
     * GTAO đắt hơn bloom: nó vẽ lại toàn cảnh một lượt nữa để lấy pháp tuyến và
     * chiều sâu. Ngưỡng tự động vì thế chặt hơn (20ms thay vì 26ms) và máy yếu
     * bị loại thẳng — thà không có bóng tiếp xúc còn hơn tụt xuống 30fps.
     */
    function gtaoEnabled(): boolean {
      const prefs = propsRef.current.world;
      if (!prefs.effects || compactGpu) return false;
      if (prefs.quality === "balanced") return false;
      if (prefs.quality === "high") return true;
      return renderPixelRatio >= 1 && averageFrameMs < 20;
    }

    /* Đoạn mở đầu tự lái camera từ ngoài không gian xuống. Cờ này nằm ở đây,
       trên `flyToPose`, vì một chuyến bay do người chơi yêu cầu được quyền cắt
       ngang nó. */
    let introDone = false;

    /* ------------------------------ camera tween ------------------------------
       Chuyến bay của camera do GSAP dẫn nhịp. Cái được không phải là "đường
       cong mượt hơn" — `easeInOutCubic` viết tay vẫn mượt — mà là việc một
       chuyến bay mới tự huỷ chuyến đang chạy, kể cả khi nó đang tween cả tiêu
       cự lẫn vị trí. Bản trước ghi đè `tween` giữa chừng nên nếu người chơi
       bấm hai góc máy liên tiếp, tiêu cự sẽ kẹt lại ở giá trị dở dang. */
    const flight = { k: 1 };
    const flyFromPos = new THREE.Vector3();
    const flyToPos = new THREE.Vector3();
    const flyFromTgt = new THREE.Vector3();
    const flyToTgt = new THREE.Vector3();
    let flyFromFov = BASE_FOV;
    let flyToFov = BASE_FOV;
    let flying = false;
    let flightTween: gsap.core.Tween | null = null;

    function flyToPose(pos: THREE.Vector3, target: THREE.Vector3, fov: number, dur: number) {
      /* Đoạn mở đầu cũng lái camera. Người chơi bấm một quận hay một góc máy
         trong hai giây rưỡi đó thì phải được đi ngay, chứ không phải ngồi nhìn
         cú bấm của mình bị nuốt mất. */
      introDone = true;
      flightTween?.kill();
      flyFromPos.copy(camera.position);
      flyToPos.copy(pos);
      flyFromTgt.copy(controls.target);
      flyToTgt.copy(target);
      /* FOV punch điện ảnh: mở rộng 4,5° lúc cất cánh rồi siết lại khi hạ —
         cảm giác tốc độ mà không cần tăng thời gian bay.
         Chỉ punch khi đang đứng yên. Nếu cú bay trước còn dở dang thì `camera.fov`
         đã mang sẵn phần mở rộng của lần đó; cộng thêm 4,5° nữa là mỗi lần bấm
         lại nống thêm một nấc, bấm liên tiếp mấy quận là khung hình phình thành
         mắt cá. Bay tiếp từ đúng tiêu cự hiện tại thì nối liền mạch. */
      const punch = reduceMotion || flying ? 0 : 4.5;
      flyFromFov = camera.fov + punch;
      if (punch > 0) {
        camera.fov = flyFromFov;
        camera.updateProjectionMatrix();
      }
      flyToFov = fov;
      flight.k = 0;
      flying = true;
      flightTween = gsap.to(flight, {
        k: 1,
        duration: reduceMotion ? 0.25 : dur,
        ease: "power3.inOut",
        onComplete: () => {
          flightTween = null;
        },
      });
    }

    function flyTo(view: ViewId, dur = 1.6) {
      const { pos, target } = viewPose(view, propsRef.current.activeIsle);
      rig.polarOverride = null;
      flyToPose(pos, target, BASE_FOV, dur);
      sound.whoosh();
    }

    /** Bay tới một khung hình đã ngắm sẵn, kèm tiêu cự riêng của khung đó. */
    function flyToShot(id: ShotId) {
      const shot = SHOT_BY_ID.get(id) ?? CAMERA_SHOTS[0];
      /* Bốn trong sáu khung hình đặt máy thấp hơn điểm ngắm và ngước lên; giới
         hạn góc tự động sẽ đẩy chúng vọt lên trời nếu không được nới ra. */
      rig.polarOverride = polarBetween(shot.pos, shot.target) + 0.03;
      flyToPose(shot.pos.clone(), shot.target.clone(), shot.fov, 1.9);
      sound.whoosh();
    }

    function setVoyage(active: boolean) {
      yachtHolder.visible = active;
      yachtSpeed = 0;
      heldKeys.clear();
      controls.minDistance = active ? 6 : 9;
      controls.maxDistance = active ? 38 : 165;
      /* Ngoài khơi không có gì để camera đâm vào, mà tia va chạm lại hay quét
         trúng chính con tàu — tắt hẳn giá va chạm khi đang lái. */
      rig.enabled = !active;
      if (active) {
        const target = yachtHolder.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const behind = new THREE.Vector3(
          -Math.sin(yachtHeading) * yachtCamera.distance,
          yachtCamera.height,
          -Math.cos(yachtHeading) * yachtCamera.distance
        );
        flyToPose(yachtHolder.position.clone().add(behind), target, BASE_FOV, 1.2);
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
      const tip = tooltipRef.current;
      /* Chế độ chỉ-thế-giới không có chú giải: người chơi đang ngắm cảnh, một
         thẻ chữ bám theo con trỏ là thứ duy nhất còn che khung hình. */
      if (!propsRef.current.showLabels) {
        if (hovered) {
          hovered = null;
          renderer.domElement.style.cursor = "grab";
        }
        if (tip) tip.style.opacity = "0";
        return;
      }
      /* Raycast là phần đắt nhất trong khung hình; 60ms một lần là đủ mượt
         với con trỏ mà không ăn hết ngân sách CPU khi rê chuột nhanh. */
      const now = performance.now();
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
        else if (tag === "harbor") propsRef.current.onHarbor();
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
      /* Chế độ ảnh và chế độ "chỉ thế giới" đều muốn khung hình sạch: nhãn tắt
         hẳn chứ không chỉ mờ đi, để chúng không lọt vào ảnh xuất ra. */
      const visible = propsRef.current.showLabels;
      for (const id of labelIds) {
        const el = labelEls.current[id];
        if (!el) continue;
        if (!visible) {
          el.style.opacity = "0";
          continue;
        }
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
      gradePass.material.uniforms.uResolution.value.set(w, h);
    }
    window.addEventListener("resize", onResize);

    /* ------------------------- ảnh chụp độ phân giải cao -------------------------
       `preserveDrawingBuffer` để `false` vì bật lên là mỗi khung hình phải giữ
       thêm một bộ đệm màu suốt phiên chơi. Đổi lại, muốn đọc pixel thì phải vẽ
       và đọc trong cùng một nhịp đồng bộ, trước khi trình duyệt kịp xoá bộ đệm.
       Toàn bộ hàm này vì thế không được có một `await` nào. */
    function capture(): string | null {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      /* Gấp đôi mật độ điểm ảnh so với lúc chơi: ảnh xuất ra để chia sẻ và
         phóng to, không phải để hiển thị vừa khít khung hiện tại. */
      const shotRatio = Math.min(2.6, Math.max(2, window.devicePixelRatio || 1));
      const resolution = gradePass.material.uniforms.uResolution.value as THREE.Vector2;
      const wasResolution = resolution.clone();
      try {
        renderer.setPixelRatio(shotRatio);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(shotRatio);
        composer.setSize(w, h);
        /* Quang sai của ống kính tính theo `uResolution`. Bộ đệm lúc chụp lớn
           gấp đôi, nên không cập nhật con số này thì viền màu trong ảnh xuất ra
           đậm gấp đôi những gì người chơi vừa ngắm. */
        resolution.set(w * shotRatio, h * shotRatio);
        renderFrame(clock.elapsedTime, true);
        return renderer.domElement.toDataURL("image/png");
      } catch {
        /* Trình duyệt có thể từ chối `toDataURL` nếu canvas bị "vấy bẩn"; lúc
           đó thà không có ảnh còn hơn làm sập cả thế giới 3D. */
        return null;
      } finally {
        resolution.copy(wasResolution);
        renderer.setPixelRatio(renderPixelRatio);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(renderPixelRatio);
        composer.setSize(w, h);
      }
    }

    /* ---------------------- vật cản của camera ----------------------
       Chỉ những khối thật sự chắn tầm nhìn mới nằm trong danh sách. Biển, trời,
       mây và thảm cỏ bị bỏ ra: đâm xuyên qua chúng là chuyện bình thường, còn
       đưa chúng vào thì mỗi lần lia camera là một lần camera bị giật vào. */
    rig.colliders = [
      lighthouse,
      village,
      pier,
      harbor,
      ...DISTRICT_IDS.map((d) => districtGroups[d] as THREE.Object3D),
      ...DISTRICT_IDS.map((d) => isleGroups[d] as THREE.Object3D),
    ];
    rig.colliders.push(terrain.mesh);
    staticTicks.push((t) => terrain.tick(t));

    /* ------------------------------ API ------------------------------ */
    sceneApi.current = {
      flyTo,
      flyToShot,
      capture,
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
      flyToShot: (id) => sceneApi.current?.flyToShot(id),
      capture: () => sceneApi.current?.capture() ?? null,
    };
    if (propsRef.current.voyage) setVoyage(true);

    /* ------------------------------ loop ------------------------------ */
    const clock = new THREE.Clock();
    let raf = 0;
    const introPose = viewPose("overview");
    const introStart = performance.now();
    const introFrom = camera.position.clone();
    const introTargetFrom = new THREE.Vector3(0, 20, 0);
    let labelClock = 0;
    let perfFrames = 0;
    let perfTime = 0;
    const desiredYachtTarget = new THREE.Vector3();
    const followDelta = new THREE.Vector3();
    const nextYachtPosition = new THREE.Vector3();

    function yachtPositionAllowed(position: THREE.Vector3): boolean {
      /* Bờ không còn là đường tròn: một hằng số duy nhất thì hoặc du thuyền
         húc vào mũi đất, hoặc không vào nổi vịnh. */
      const radial = Math.hypot(position.x, position.z);
      if (radial < coastRadius(Math.atan2(position.z, position.x)) * SHORELINE_U + 2.4) return false;
      for (const district of DISTRICT_IDS) {
        if (position.distanceToSquared(ISLE_POSITIONS[district]) < Math.pow(ISLE_RADIUS + 2.1, 2)) return false;
      }
      return radial < SAIL_LIMIT;
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
      /* 60 khung một lần thay vì 120: ở 30fps là hai giây, đủ nhanh để máy yếu
         hạ chất lượng trước khi người chơi kịp bực. */
      if (perfFrames >= 60) {
        const averageFrame = perfTime / perfFrames;
        averageFrameMs = averageFrame;
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

      /* Trả camera về đúng quỹ đạo mà `OrbitControls` tưởng nó đang ở, trước
         khi bất cứ ai chạm vào vị trí camera trong khung này. */
      rig.beforeControls();

      /* Intro điện ảnh 3.4s: từ cao lao xuống + siết tiêu cự 58→46 cho
         cảm giác dolly-zoom nhẹ. Dùng ease riêng cho vị trí và FOV để
         FOV về đích sớm hơn một nhịp — hạ cánh "dính" thay vì trôi. */
      if (!introDone) {
        const k = Math.min(1, (performance.now() - introStart) / (reduceMotion ? 300 : 3400));
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(introFrom, introPose.pos, e);
        controls.target.lerpVectors(introTargetFrom, introPose.target, e);
        const introFov = THREE.MathUtils.lerp(58, BASE_FOV, Math.min(1, k * 1.15));
        if (Math.abs(introFov - camera.fov) > 0.01) {
          camera.fov = introFov;
          camera.updateProjectionMatrix();
        }
        if (k >= 1) introDone = true;
      } else if (flying) {
        /* easeOutExpo phần đầu cho cú vọt, easeInOut phần cuối để hạ êm:
           dùng smoothstep trên k của GSAP để FOV siết nhanh hơn vị trí. */
        const e = flight.k;
        const ePos = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
        camera.position.lerpVectors(flyFromPos, flyToPos, ePos);
        controls.target.lerpVectors(flyFromTgt, flyToTgt, ePos);
        const eFov = THREE.MathUtils.smoothstep(e, 0, 1);
        const fov = THREE.MathUtils.lerp(flyFromFov, flyToFov, eFov);
        if (Math.abs(fov - camera.fov) > 0.005) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        if (e >= 1) flying = false;
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

        if (!flying) {
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

      controls.autoRotate = !propsRef.current.voyage && propsRef.current.selected === "overview" && !flying && !userInteracting && introDone && !reduceMotion;
      controls.update();
      /* Kẹp góc chúi theo khoảng cách, đẩy camera ra trước vật cản, ghim sàn.
         Dùng `rawDt` chứ không phải `dt`: `dt` đã bị kẹp xuống 0,05 giây để vật
         lý du thuyền không nhảy cóc, còn giá máy cần thời gian thật. */
      rig.afterControls(rawDt);

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
      renderFrame(t);
    }

    /**
     * Vẽ một khung hình.
     *
     * Tách khỏi `frame()` vì chế độ ảnh cần vẽ lại đúng cảnh này ở độ phân giải
     * cao rồi đọc canvas ngay trong cùng một nhịp đồng bộ — `preserveDrawingBuffer`
     * bị tắt để tiết kiệm bộ nhớ, nên chỉ có cách đó mới lấy được pixel.
     *
     * `hero` là khung dành cho ảnh tĩnh: nó không có ngân sách khung hình để lo,
     * nên bật hết hiệu ứng kể cả khi lúc chơi chúng đang bị tự động hạ xuống.
     */
    function renderFrame(t: number, hero = false) {
      const effects = propsRef.current.world.effects;
      if (!(hero ? effects : postEnabled())) {
        renderer.render(scene, camera);
        return;
      }
      bloomPass.enabled = hero ? effects : bloomEnabled();
      gtaoPass.enabled = hero ? effects && !compactGpu : gtaoEnabled();
      /* Bloom điện ảnh: ngày giữ halo gọn để không bệt, đêm mở mạnh cho đèn,
         rune, mặt trăng nở quầng. Radius rộng sẵn nên chỉ cần điều strength. */
      bloomPass.strength = 0.32 + (1 - currentDaylight) * 0.68;
      const grade = gradePass.material.uniforms;
      grade.uTime.value = t;
      grade.uGrain.value = 0.020 + (1 - currentDaylight) * 0.028;
      grade.uVignette.value = 0.26 + (1 - currentDaylight) * 0.13;
      /* Nét và split màu thích ứng: ngày nét căng, đêm giảm nét để không
         khuếch đại noise; teal-orange giữ nguyên để da trời luôn điện ảnh. */
      if (grade.uSharp) grade.uSharp.value = hero ? 0.5 : 0.38 + currentDaylight * 0.12;
      if (grade.uTeal) grade.uTeal.value = 0.85;
      if (grade.uGain) grade.uGain.value = 1.03 + currentDaylight * 0.02;
      composer.render();
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
      flightTween?.kill();
      gtaoPass.dispose();
      grassLayer?.dispose();
      duneLayer?.dispose();
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
          /* Tấm nào dựng riêng cho cảnh này thì dọn; tấm cache dùng chung
             (mây) phải để lại cho lần mount sau. */
          const map = sprite.material.map;
          if (map && !map.userData.shared) map.dispose();
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
