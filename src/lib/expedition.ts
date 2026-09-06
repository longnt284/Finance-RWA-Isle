/* ------------------------------------------------------------------ */
/*  Bến cảng viễn dương                                                */
/*                                                                     */
/*  Trước tính năng này, xu chỉ đến từ một nguồn duy nhất — bán cá —    */
/*  và câu cá đòi người chơi phải ngồi trước màn hình. Nghĩa là đóng    */
/*  tab lại thì hòn đảo đứng im hoàn toàn.                             */
/*                                                                     */
/*  Chuyến viễn dương là nguồn xu thứ hai và là nguồn duy nhất chạy     */
/*  khi không ai nhìn: phái tàu đi, đóng tab, quay lại lấy hàng. Toàn   */
/*  bộ tính bằng dấu thời gian nên không cần một vòng lặp nền nào, và   */
/*  cũng không có gì để chỉnh đồng hồ máy mà ăn gian — phần thưởng rút  */
/*  từ chính lúc khởi hành.                                            */
/* ------------------------------------------------------------------ */

/* Gọi là `expedition` chứ không phải `voyage`: trong repo này `voyage` đã có
   nghĩa "người chơi đang tự cầm lái du thuyền" và App.tsx dùng đúng nghĩa đó.
   Hai khái niệm trùng tên là cách chắc chắn để một ngày nào đó ai đó nối nhầm
   nút bấm. */
export type ExpeditionId = "coastal" | "archipelago" | "mist" | "deep" | "grand";

export interface ExpeditionRoute {
  id: ExpeditionId;
  /** Hạng du thuyền tối thiểu mở được tuyến. */
  tier: number;
  /** Thời gian đi về, tính bằng phút. */
  minutes: number;
  coinMin: number;
  coinMax: number;
  /** Xác suất mang về một món hàng lạ, 0..1. */
  relicChance: number;
  /** Giá trần của món hàng lạ tuyến này mang về được. */
  relicCap: number;
}

/* Xu mỗi giờ tăng dần theo tuyến, nhưng không tuyến nào bỏ xa tuyến khác:
   tuyến dài thắng ở chỗ ít phải quay lại bấm, không ở chỗ trả gấp mấy lần.
   Tuyến ngắn nhất 20 phút để một buổi chơi bình thường vẫn kịp một chuyến. */
export const EXPEDITION_ROUTES: ExpeditionRoute[] = [
  { id: "coastal", tier: 1, minutes: 20, coinMin: 55, coinMax: 105, relicChance: 0.04, relicCap: 260 },
  { id: "archipelago", tier: 2, minutes: 60, coinMin: 190, coinMax: 320, relicChance: 0.1, relicCap: 520 },
  { id: "mist", tier: 3, minutes: 180, coinMin: 620, coinMax: 980, relicChance: 0.2, relicCap: 900 },
  { id: "deep", tier: 4, minutes: 360, coinMin: 1320, coinMax: 1980, relicChance: 0.32, relicCap: 1500 },
  { id: "grand", tier: 5, minutes: 720, coinMin: 2800, coinMax: 4100, relicChance: 0.46, relicCap: 2600 },
];

export const EXPEDITION_BY_ID = new Map(EXPEDITION_ROUTES.map((route) => [route.id, route]));

/** Chuyến đang chạy. `null` nghĩa là tàu đang neo ở bến. */
export interface ExpeditionState {
  routeId: ExpeditionId;
  /** Dấu thời gian lúc khởi hành — vừa là đồng hồ đếm ngược vừa là hạt giống. */
  startedAt: number;
}

export interface ExpeditionOutcome {
  coins: number;
  /** Mã hạng mục Chợ mang về được, hoặc `null`. */
  relic: string | null;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Thời điểm tàu cập bến, tính bằng mili giây. */
export function expeditionEndsAt(expedition: ExpeditionState): number {
  const route = EXPEDITION_BY_ID.get(expedition.routeId);
  if (!route) return expedition.startedAt;
  return expedition.startedAt + route.minutes * 60_000;
}

/** Còn bao nhiêu mili giây nữa tàu về. 0 nghĩa là đã về tới nơi. */
export function expeditionRemaining(expedition: ExpeditionState, now: number): number {
  return Math.max(0, expeditionEndsAt(expedition) - now);
}

/** Tiến độ chuyến đi, 0..1. */
export function expeditionProgress(expedition: ExpeditionState, now: number): number {
  const route = EXPEDITION_BY_ID.get(expedition.routeId);
  if (!route) return 1;
  const total = route.minutes * 60_000;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - expedition.startedAt) / total));
}

/** Tuyến này đã mở với hạng du thuyền hiện tại chưa. */
export function routeUnlocked(route: ExpeditionRoute, yachtTier: number): boolean {
  return yachtTier >= route.tier;
}

/**
 * Kết quả một chuyến, rút tất định từ dấu thời gian khởi hành.
 *
 * Tất định là điều kiện bắt buộc chứ không phải lựa chọn cho gọn: nếu quay
 * ngẫu nhiên lúc nhận hàng thì tải lại trang trước khi bấm là quay lại được,
 * và người chơi nào cũng sẽ tìm ra chuyện đó.
 *
 * `pool` là danh sách mã hạng mục Chợ mà người chơi chưa có, đã lọc theo giá
 * trần của tuyến. Bên gọi cung cấp để module này không phải biết gì về danh
 * mục Chợ.
 */
export function expeditionOutcome(expedition: ExpeditionState, pool: string[]): ExpeditionOutcome {
  const route = EXPEDITION_BY_ID.get(expedition.routeId);
  if (!route) return { coins: 0, relic: null };
  const random = mulberry32(hash(expedition.routeId) ^ expedition.startedAt);
  const coins = Math.round(route.coinMin + random() * (route.coinMax - route.coinMin));
  const wantsRelic = random() < route.relicChance;
  const relic = wantsRelic && pool.length ? pool[Math.floor(random() * pool.length) % pool.length] : null;
  return { coins, relic };
}

/** Chuỗi đếm ngược ngắn gọn: `2g 14p` hoặc `47p` hoặc `Đã cập bến`. */
export function formatRemaining(ms: number, lang: "vi" | "en"): string {
  if (ms <= 0) return lang === "vi" ? "Đã cập bến" : "Docked";
  const minutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return lang === "vi" ? `${rest} phút` : `${rest} min`;
  if (rest === 0) return lang === "vi" ? `${hours} giờ` : `${hours} h`;
  return lang === "vi" ? `${hours} giờ ${rest} phút` : `${hours}h ${rest}m`;
}
