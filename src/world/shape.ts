/* ------------------------------------------------------------------ */
/*  Hình dáng đảo chính — nguồn sự thật duy nhất                        */
/*                                                                     */
/*  Trước đây bán kính đảo nằm ở `ocean.ts`, cao độ mặt đất nằm ở       */
/*  `build.ts`, còn giới hạn gieo cỏ lại là một hằng số chép tay trong  */
/*  `grass.ts`. Ba nơi đó phải khớp nhau tuyệt đối, và chúng đã không   */
/*  khớp: cỏ dừng ở 17,4 trong khi bãi cát bắt đầu từ 17.               */
/*                                                                     */
/*  Toàn bộ hình học của hòn đảo giờ nằm ở đây, và mọi module khác đọc  */
/*  từ đây. Đường bờ không còn là đường tròn nên "bán kính đảo" một mình*/
/*  không đủ để mô tả nó nữa — phải là một hàm theo phương vị.          */
/* ------------------------------------------------------------------ */

/** Bán kính danh nghĩa của đảo chính — bán kính của đường tròn trước khi uốn. */
export const ISLAND_RADIUS = 32;

/** Bốn quận nằm trên vòng tròn này. */
export const DISTRICT_RING = 14.5;

/* ------------------------------------------------------------------ */
/* Đường bờ                                                            */
/* ------------------------------------------------------------------ */

/* Ba mũi đất (hài bậc 3), một lớp gợn phụ lệch nhịp (hài bậc 5) và một
   vịnh ăn sâu vào lòng đảo. Hài bậc 5 tồn tại chỉ để phá nhịp đều của
   bậc 3: ba mũi đất giống hệt nhau cách đều 120° vẫn đọc ra hình học,
   không đọc ra bờ biển. */
const CAPE_3 = 0.098;
const CAPE_5 = 0.043;
const CAPE_3_PHASE = 0.62;
const CAPE_5_PHASE = 2.31;

/* Ba mũi đất rơi vào 4,4° · 136,7° · 269,5°; ba vùng lõm rơi vào 89,5° · 184,4°
   · 316,7°. Vịnh phải nằm đúng một vùng lõm còn mũi đá phải nằm đúng một mũi
   đất, nếu không chúng triệt tiêu lẫn nhau và đường bờ lại tròn như cũ. */

/** Vịnh Thương Cảng — nằm ở vùng lõm hướng −x, nơi bến cảng viễn dương neo. */
export const BAY_ANGLE = 3.218;
const BAY_DEPTH = 0.158;
const BAY_WIDTH = 0.52;

/** Mũi đá: mũi đất hướng −z, đối diện cổng đảo nên không chắn lối vào. */
export const CLIFF_ANGLE = 4.703;
const CLIFF_WIDTH = 0.235;
/** Đỉnh mũi đá cao hơn cao nguyên bao nhiêu. */
const CLIFF_LIFT = 7.2;

/** Khoảng cách góc ngắn nhất giữa hai phương vị, luôn nằm trong [0, π]. */
function angleGap(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** Hàm chuông theo góc: 1 ở tâm, tắt dần về 0 ở rìa. */
function angularBump(angle: number, center: number, width: number): number {
  const d = angleGap(angle, center) / width;
  return d >= 1 ? 0 : Math.pow(Math.cos((d * Math.PI) / 2), 2);
}

/**
 * Hệ số bờ tại một phương vị: nhân với `ISLAND_RADIUS` ra bán kính bờ thật.
 *
 * Giữ nó tách khỏi `coastRadius` vì lớp bọt sóng và thềm cát cần chính hệ số
 * này để nới ra ngoài đúng theo hình đảo, chứ không phải một đường tròn khác.
 */
export function coastFactor(angle: number): number {
  const capes = CAPE_3 * Math.sin(angle * 3 + CAPE_3_PHASE) + CAPE_5 * Math.sin(angle * 5 + CAPE_5_PHASE);
  const bay = BAY_DEPTH * angularBump(angle, BAY_ANGLE, BAY_WIDTH);
  return 1 + capes - bay;
}

/** Bán kính đường bờ tại phương vị `angle` (radian, đo bằng `atan2(z, x)`). */
export function coastRadius(angle: number): number {
  return ISLAND_RADIUS * coastFactor(angle);
}

/**
 * Cùng một hàm `coastFactor`, viết bằng GLSL.
 *
 * Mặt nước phải biết đường bờ nằm đâu để đặt dải bọt sóng và vùng nước nông
 * đúng chỗ. Chép tay các hằng số sang shader là cách chắc chắn để một ngày nào
 * đó bọt sóng vỗ vào chỗ không còn bờ; dựng chuỗi từ chính các hằng số ở trên
 * thì hai bên không thể lệch nhau.
 */
export const COAST_GLSL = `
  float coastRadiusAt(vec2 p) {
    float a = atan(p.y, p.x);
    float capes = ${CAPE_3.toFixed(4)} * sin(a * 3.0 + ${CAPE_3_PHASE.toFixed(4)})
                + ${CAPE_5.toFixed(4)} * sin(a * 5.0 + ${CAPE_5_PHASE.toFixed(4)});
    float gap = abs(a - ${BAY_ANGLE.toFixed(4)});
    gap = mod(gap, 6.28318531);
    gap = min(gap, 6.28318531 - gap);
    float t = gap / ${BAY_WIDTH.toFixed(4)};
    float bump = t >= 1.0 ? 0.0 : pow(cos(t * 1.57079633), 2.0);
    return ${ISLAND_RADIUS.toFixed(1)} * (1.0 + capes - ${BAY_DEPTH.toFixed(4)} * bump);
  }
`;

function sampleCoast(pick: (a: number, b: number) => number, seed: number): number {
  let value = seed;
  for (let i = 0; i < 720; i++) value = pick(value, coastRadius((i / 720) * Math.PI * 2));
  return value;
}

/** Bán kính bờ xa nhất — mọi thứ phải nằm ngoài nó mới chắc chắn ở trên biển. */
export const COAST_MAX = sampleCoast(Math.max, 0);
/** Bán kính bờ gần nhất — đáy vịnh. */
export const COAST_MIN = sampleCoast(Math.min, Infinity);

function smoothstep(x: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------ */
/* Toạ độ chuẩn hoá                                                    */
/* ------------------------------------------------------------------ */

/**
 * `u` = bán kính chia cho bán kính bờ tại chính phương vị đó.
 *
 * Mọi ngưỡng địa hình đều tính theo `u` chứ không theo bán kính tuyệt đối. Nhờ
 * vậy bãi cát rộng ra ở mũi đất và hẹp lại trong vịnh — tự nó, không cần một
 * bảng ngoại lệ nào.
 */
export function coastU(x: number, z: number): number {
  return Math.hypot(x, z) / coastRadius(Math.atan2(z, x));
}

/**
 * `u` nơi cao nguyên cỏ kết thúc và bãi cát bắt đầu.
 *
 * Ở mốc 0,655 thì bãi cát chiếm 57% diện tích đảo — hòn đảo đọc ra một cái đĩa
 * cát có chấm xanh ở giữa. 0,76 đưa con số đó về 42%, và vành đất mới mở rộng
 * ra thành chỗ ở được chứ không thành bãi trống.
 */
export const PLATEAU_U = 0.76;
/** `u` nơi mặt đất tụt hết độ sâu của bãi thoải. */
export const SHORE_U = 0.985;
/** Mặt nước nằm dưới mặt cao nguyên một chút, nên bờ có độ dốc. */
export const WATER_LEVEL = -1.45;
/** Bãi cát tụt xuống bấy nhiêu đơn vị từ mép cao nguyên tới mép ngoài cùng. */
export const SHORE_DROP = 2.35;
/** `u` ngoài cùng còn gieo cỏ — chừa một dải để cỏ không mọc xuống cát ướt. */
export const GRASS_U = 0.74;

/**
 * `u` nơi mặt đất cắt mặt nước — mép nước thật, không phải mép đảo.
 *
 * Bãi cát còn chạy tiếp ra ngoài mốc này rồi mới chìm hẳn, nên lấy `1.0` làm
 * mép nước thì dải bọt sóng vỗ vào chỗ cách bờ thật gần bốn đơn vị.
 */
export const SHORELINE_U = (() => {
  const target = -WATER_LEVEL / SHORE_DROP;
  let lo = PLATEAU_U;
  let hi = SHORE_U;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (smoothstep(mid, PLATEAU_U, SHORE_U) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** Khoảng cách từ `(px, pz)` tới đoạn thẳng `a`–`b`. */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const len2 = abx * abx + abz * abz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, (apx * abx + apz * abz) / len2)) : 0;
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

/* Bốn quận và quảng trường trung tâm. Giữ ở đây chứ không import từ `build.ts`
   để module này không phụ thuộc ngược — `build.ts` mới là bên đọc từ đây. */
const SQRT_HALF = Math.SQRT1_2;
export const DISTRICT_ANCHORS: [number, number][] = [
  [DISTRICT_RING * SQRT_HALF, -DISTRICT_RING * SQRT_HALF],
  [-DISTRICT_RING * SQRT_HALF, -DISTRICT_RING * SQRT_HALF],
  [-DISTRICT_RING * SQRT_HALF, DISTRICT_RING * SQRT_HALF],
  [DISTRICT_RING * SQRT_HALF, DISTRICT_RING * SQRT_HALF],
];

/** Bán kính quảng trường hải đăng, kể cả bậc thềm ngoài cùng. */
export const PLAZA_RADIUS = 9.8;

/**
 * Hệ số "đất được phép gợn": 0 ở quảng trường, bốn bệ công trình và dọc lối đi
 * lát đá; 1 ở nơi cỏ mọc tự do.
 */
export function terrainFlatness(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let flat = smoothstep(r, PLAZA_RADIUS - 1.3, PLAZA_RADIUS + 2.7);
  for (const [ax, az] of DISTRICT_ANCHORS) {
    flat *= smoothstep(Math.hypot(x - ax, z - az), 4.0, 7.0);
    flat *= smoothstep(segDist(x, z, 0, 0, ax, az), 1.2, 2.6);
  }
  return flat;
}

/* ------------------------------------------------------------------ */
/* Cao độ                                                              */
/* ------------------------------------------------------------------ */

/** Nhiễu nhiều tầng cho mặt cao nguyên. Rẻ, tất định, không cần texture. */
function plateauNoise(x: number, z: number): number {
  return (
    Math.sin(x * 0.28) * Math.cos(z * 0.31) * 0.5 +
    Math.sin(x * 0.11 + 2.1) * Math.sin(z * 0.13 + 1.3) * 0.7 +
    Math.cos(x * 0.45 - z * 0.37) * 0.25
  );
}

/**
 * Độ nhô của mũi đá, 0..1.
 *
 * Chỉ dâng lên ở nửa ngoài của đảo: mũi đá phải là một khối đá đứng bên bờ
 * biển, không phải một quả đồi mọc giữa xóm làng.
 */
export function cliffMask(x: number, z: number): number {
  const u = coastU(x, z);
  if (u < 0.4) return 0;
  const gap = angleGap(Math.atan2(z, x), CLIFF_ANGLE) / CLIFF_WIDTH;
  if (gap >= 1) return 0;
  /* Sườn dốc đứng chứ không phải hàm chuông: hàm chuông cho ra một cái mái vòm
     trơn nhẵn — mắt đọc nó thành lưng cá voi, không thành vách đá. `smoothstep`
     ngược giữ mặt bàn phẳng ở giữa rồi cắt gấp ở hai bên. */
  const across = smoothstep(gap, 1, 0.58);
  /* Dâng nhanh từ u = 0,40 tới 0,58 rồi giữ nguyên: đỉnh mũi đá là một mặt bàn
     đứng được, còn phía biển thì váy đá cắt thẳng xuống thành vách. */
  return across * smoothstep(u, 0.4, 0.58);
}

/**
 * Tầng đá trên mặt mũi đá, tính bằng đơn vị cao độ.
 *
 * Đá trầm tích nứt thành từng bậc chứ không mượt như đất sét. Vài bậc nông là
 * đủ để mắt đọc ra "đá" — thiếu chúng thì dù dựng đứng đến đâu nó vẫn ra một
 * khối nhựa đúc.
 */
function cliffTerrace(x: number, z: number, mask: number): number {
  if (mask <= 0) return 0;
  /* Hai tầng: bậc theo chiều ra biển, và nếp gãy theo chiều ngang. Biên độ phải
     đủ lớn so với chiều cao vách — 0,16 trên một khối cao 7 đơn vị thì mắt
     không thấy gì, và khối đá lại ra khối nhựa đúc. */
  const step = Math.sin(coastU(x, z) * 22) * 0.62 + Math.sin(x * 0.55 + z * 0.42) * 0.44;
  return step * mask;
}

/**
 * Cao độ mặt đảo tại `(x, z)` trong toạ độ thế giới — 0 là mặt cao nguyên.
 *
 * `buildTerrain` dựng lưới bằng đúng hàm này, nên cây trồng theo nó luôn đứng
 * đúng trên mặt đất. Bản trước hai bên tính khác nhau và cây lơ lửng tới 1,16
 * đơn vị ở ngay chỗ xóm làng.
 */
export function terrainHeightAt(x: number, z: number): number {
  const u = coastU(x, z);
  const flat = terrainFlatness(x, z);
  const bumps = plateauNoise(x, z) * 0.4 * flat;
  const shoreFall = smoothstep(u, PLATEAU_U, SHORE_U) * SHORE_DROP;
  const cliff = cliffMask(x, z);
  return bumps + cliff * CLIFF_LIFT + cliffTerrace(x, z, cliff) - shoreFall;
}

/**
 * Mặt đất ở đây có phải bãi cát không, 0..1.
 *
 * Dùng chung cho cả màu địa hình lẫn việc chọn chỗ gieo cỏ và trồng dừa, nên
 * "ranh giới cỏ–cát" chỉ được định nghĩa đúng một lần.
 */
export function sandiness(x: number, z: number): number {
  const beach = smoothstep(coastU(x, z), PLATEAU_U, PLATEAU_U + 0.16);
  /* Mũi đá là đá, không phải cát — dù nó nằm ngoài ngưỡng bãi biển. */
  return beach * (1 - Math.min(1, cliffMask(x, z) * 1.6));
}

/* ------------------------------------------------------------------ */
/* Gieo hạt tất định                                                   */
/* ------------------------------------------------------------------ */

/** Bộ sinh số giả ngẫu nhiên có hạt giống: mỗi lần tải trang ra đúng một đảo. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScatterSpot {
  x: number;
  z: number;
  y: number;
  /** 0..1 rút từ cùng bộ sinh — dùng cho tỉ lệ, màu, kiểu dáng. */
  roll: number;
}

export interface ScatterOptions {
  /** Bao nhiêu điểm cần đặt. */
  count: number;
  /** Dải `u` được phép gieo. */
  minU: number;
  maxU: number;
  /** Hạt giống — cùng hạt luôn ra cùng bố cục. */
  seed: number;
  /** Khoảng cách tối thiểu giữa hai điểm. */
  spacing: number;
  /** Chỉ nhận điểm có `terrainFlatness` từ mức này trở lên. */
  minFlatness?: number;
  /** Chỉ nhận điểm có `sandiness` nằm trong khoảng này. */
  minSand?: number;
  maxSand?: number;
  /** Loại điểm nằm trên mũi đá — dùng cho thứ không mọc được trên đá. */
  avoidCliff?: boolean;
  /** Bộ lọc bổ sung của bên gọi, ví dụ để tránh bến câu. */
  reject?: (x: number, z: number) => boolean;
}

/**
 * Rải vật thể trên đảo theo cách tất định, tôn trọng đường bờ và địa hình.
 *
 * Bản trước là những mảng toạ độ chép tay — hai mươi bảy cây thông, hai mươi
 * bốn cây dừa, mười bốn hòn đá. Chúng không thể giãn theo hòn đảo: nới bán
 * kính lên là toàn bộ vành ngoài trống trơn, còn muốn lấp thì phải gõ tay
 * thêm vài chục dòng toạ độ và tự nhẩm xem cái nào rơi xuống biển.
 */
export function scatter(options: ScatterOptions): ScatterSpot[] {
  const random = mulberry32(options.seed);
  const spots: ScatterSpot[] = [];
  const spacing2 = options.spacing * options.spacing;
  const maxRadius = COAST_MAX * options.maxU;
  const budget = options.count * 40;

  for (let attempt = 0; attempt < budget && spots.length < options.count; attempt++) {
    const angle = random() * Math.PI * 2;
    /* Căn bậc hai để mật độ đều theo diện tích: gieo `u` tuyến tính thì tâm
       đảo dày đặc còn vành ngoài thưa thớt. */
    const u = Math.sqrt(options.minU ** 2 + random() * (options.maxU ** 2 - options.minU ** 2));
    const radius = u * coastRadius(angle);
    if (radius > maxRadius) continue;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (options.minFlatness !== undefined && terrainFlatness(x, z) < options.minFlatness) continue;
    const sand = sandiness(x, z);
    if (options.minSand !== undefined && sand < options.minSand) continue;
    if (options.maxSand !== undefined && sand > options.maxSand) continue;
    if (options.avoidCliff && cliffMask(x, z) > 0.12) continue;
    if (options.reject?.(x, z)) continue;

    let clash = false;
    for (const spot of spots) {
      if ((spot.x - x) ** 2 + (spot.z - z) ** 2 < spacing2) {
        clash = true;
        break;
      }
    }
    if (clash) continue;

    spots.push({ x, z, y: terrainHeightAt(x, z), roll: random() });
  }
  return spots;
}
