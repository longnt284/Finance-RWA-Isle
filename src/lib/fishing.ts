/* ------------------------------------------------------------------ */
/*  Câu cá — danh mục loài, xác suất cắn câu và hằng số của minigame    */
/*                                                                     */
/*  Tách khỏi Three.js và khỏi React để state, giao diện lẫn thế giới   */
/*  3D dùng chung một nguồn sự thật. Tên loài để song ngữ ngay trong    */
/*  dữ liệu thay vì đi qua từ điển i18n: 30+ loài × 2 ngôn ngữ sẽ làm   */
/*  từ điển phình ra mà chẳng ai dịch lại bao giờ.                      */
/* ------------------------------------------------------------------ */

import type { Season } from "./season";

export type FishRarity = "common" | "uncommon" | "rare" | "epic" | "legend";
/** `shore` = bến câu trên đảo · `vortex` = xoáy nước ngoài khơi · `both` = cả hai */
export type FishZone = "shore" | "vortex" | "both";
export type FishTime = "any" | "day" | "night";
/** Kiểu bơi quyết định nhịp giật của cá trong khung minigame. */
export type FishMotion = "calm" | "smooth" | "dart" | "sink" | "mixed";

export interface FishDef {
  id: string;
  vi: string;
  en: string;
  rarity: FishRarity;
  zone: FishZone;
  /** Giá bán cơ bản (xu) cho một con cỡ trung bình. */
  value: number;
  /** 0..1 — càng cao cá càng khó giữ trong khung. */
  difficulty: number;
  motion: FishMotion;
  /** Khoảng cân nặng (kg) — quyết định giá bán và kỷ lục cá nhân. */
  weight: [number, number];
  /** Chỉ xuất hiện trong các mùa này; bỏ trống nghĩa là quanh năm. */
  seasons?: Season[];
  time?: FishTime;
}

export const RARITY_ORDER: FishRarity[] = ["common", "uncommon", "rare", "epic", "legend"];

export const RARITY_META: Record<FishRarity, { color: string; weight: number; xp: number }> = {
  common: { color: "#8ba4a7", weight: 100, xp: 4 },
  uncommon: { color: "#4cd99a", weight: 46, xp: 9 },
  rare: { color: "#9fd0ff", weight: 18, xp: 20 },
  epic: { color: "#c6a8ff", weight: 6, xp: 45 },
  legend: { color: "#ffd88a", weight: 1.6, xp: 120 },
};

/* ------------------------------------------------------------------ */
/*  Danh mục loài                                                      */
/* ------------------------------------------------------------------ */

export const FISH: FishDef[] = [
  /* ---------- bến câu trên đảo ---------- */
  { id: "sardine", vi: "Cá mòi", en: "Sardine", rarity: "common", zone: "shore", value: 12, difficulty: 0.16, motion: "calm", weight: [0.1, 0.4] },
  { id: "anchovy", vi: "Cá cơm", en: "Anchovy", rarity: "common", zone: "shore", value: 10, difficulty: 0.14, motion: "calm", weight: [0.05, 0.25] },
  { id: "mullet", vi: "Cá đối", en: "Grey Mullet", rarity: "common", zone: "shore", value: 18, difficulty: 0.22, motion: "smooth", weight: [0.4, 1.6] },
  { id: "goby", vi: "Cá bống", en: "Goby", rarity: "common", zone: "shore", value: 14, difficulty: 0.2, motion: "sink", weight: [0.1, 0.5] },
  { id: "tilapia", vi: "Cá rô phi", en: "Tilapia", rarity: "common", zone: "shore", value: 16, difficulty: 0.18, motion: "calm", weight: [0.3, 1.2] },
  { id: "crab", vi: "Cua đá", en: "Rock Crab", rarity: "common", zone: "shore", value: 22, difficulty: 0.24, motion: "sink", weight: [0.2, 0.9] },
  { id: "seabass", vi: "Cá chẽm", en: "Sea Bass", rarity: "uncommon", zone: "both", value: 42, difficulty: 0.34, motion: "smooth", weight: [1, 5] },
  { id: "snapper", vi: "Cá hồng", en: "Red Snapper", rarity: "uncommon", zone: "both", value: 48, difficulty: 0.36, motion: "smooth", weight: [1, 6] },
  { id: "grouper", vi: "Cá mú", en: "Grouper", rarity: "uncommon", zone: "shore", value: 55, difficulty: 0.4, motion: "sink", weight: [2, 9] },
  { id: "squid", vi: "Mực ống", en: "Squid", rarity: "uncommon", zone: "shore", value: 46, difficulty: 0.38, motion: "dart", weight: [0.3, 2], time: "night" },
  { id: "pufferfish", vi: "Cá nóc", en: "Pufferfish", rarity: "uncommon", zone: "shore", value: 50, difficulty: 0.42, motion: "mixed", weight: [0.4, 2.2], seasons: ["summer"] },
  { id: "flounder", vi: "Cá bơn", en: "Flounder", rarity: "uncommon", zone: "shore", value: 44, difficulty: 0.36, motion: "sink", weight: [0.5, 3], seasons: ["winter", "autumn"] },
  { id: "eel", vi: "Cá chình", en: "Moray Eel", rarity: "rare", zone: "shore", value: 96, difficulty: 0.52, motion: "dart", weight: [1, 7], time: "night" },
  { id: "lobster", vi: "Tôm hùm", en: "Spiny Lobster", rarity: "rare", zone: "shore", value: 120, difficulty: 0.5, motion: "sink", weight: [0.6, 3.5] },
  { id: "rainbowtrout", vi: "Cá hồi vân", en: "Rainbow Trout", rarity: "rare", zone: "shore", value: 105, difficulty: 0.48, motion: "smooth", weight: [1, 5], seasons: ["spring"] },

  /* ---------- xoáy nước ngoài khơi ---------- */
  { id: "mackerel", vi: "Cá thu", en: "Mackerel", rarity: "common", zone: "vortex", value: 24, difficulty: 0.26, motion: "smooth", weight: [0.5, 3] },
  { id: "bonito", vi: "Cá ngừ chấm", en: "Bonito", rarity: "uncommon", zone: "vortex", value: 58, difficulty: 0.4, motion: "dart", weight: [2, 8] },
  { id: "barracuda", vi: "Cá nhồng", en: "Barracuda", rarity: "rare", zone: "vortex", value: 128, difficulty: 0.56, motion: "dart", weight: [3, 14] },
  { id: "yellowfin", vi: "Cá ngừ vây vàng", en: "Yellowfin Tuna", rarity: "rare", zone: "vortex", value: 150, difficulty: 0.58, motion: "smooth", weight: [8, 40] },
  { id: "swordfish", vi: "Cá kiếm", en: "Swordfish", rarity: "epic", zone: "vortex", value: 320, difficulty: 0.68, motion: "dart", weight: [20, 110] },
  { id: "marlin", vi: "Cá cờ xanh", en: "Blue Marlin", rarity: "epic", zone: "vortex", value: 360, difficulty: 0.72, motion: "mixed", weight: [30, 180] },
  { id: "manta", vi: "Cá đuối bàn", en: "Manta Ray", rarity: "epic", zone: "vortex", value: 300, difficulty: 0.64, motion: "smooth", weight: [40, 260] },
  { id: "hammerhead", vi: "Cá mập đầu búa", en: "Hammerhead Shark", rarity: "epic", zone: "vortex", value: 380, difficulty: 0.74, motion: "dart", weight: [50, 300] },
  { id: "oarfish", vi: "Cá mái chèo", en: "Oarfish", rarity: "epic", zone: "vortex", value: 340, difficulty: 0.7, motion: "sink", weight: [20, 120], time: "night" },
  { id: "sunfish", vi: "Cá mặt trăng", en: "Ocean Sunfish", rarity: "epic", zone: "vortex", value: 330, difficulty: 0.66, motion: "calm", weight: [80, 700], time: "day" },
  { id: "lanternfish", vi: "Cá đèn lồng", en: "Lanternfish", rarity: "rare", zone: "vortex", value: 118, difficulty: 0.54, motion: "mixed", weight: [0.1, 0.8], time: "night" },
  { id: "coelacanth", vi: "Cá vây tay", en: "Coelacanth", rarity: "legend", zone: "vortex", value: 900, difficulty: 0.82, motion: "sink", weight: [30, 95] },
  { id: "goldenkoi", vi: "Cá chép vàng", en: "Golden Koi", rarity: "legend", zone: "both", value: 820, difficulty: 0.78, motion: "mixed", weight: [2, 12] },
  { id: "moonwhale", vi: "Cá voi trăng", en: "Moon Whale", rarity: "legend", zone: "vortex", value: 1400, difficulty: 0.88, motion: "smooth", weight: [400, 2600], time: "night" },
  { id: "krakenling", vi: "Bạch tuộc khổng lồ", en: "Krakenling", rarity: "legend", zone: "vortex", value: 1200, difficulty: 0.86, motion: "dart", weight: [60, 420] },
  { id: "abyssray", vi: "Đuối vực thẳm", en: "Abyss Ray", rarity: "legend", zone: "vortex", value: 1050, difficulty: 0.84, motion: "sink", weight: [90, 500] },

  /* ---------- vật phẩm rác, giữ cho cần câu có nhịp thở ---------- */
  { id: "seaweed", vi: "Rong biển", en: "Seaweed", rarity: "common", zone: "both", value: 4, difficulty: 0.1, motion: "calm", weight: [0.1, 0.6] },
  { id: "driftwood", vi: "Gỗ trôi", en: "Driftwood", rarity: "common", zone: "both", value: 6, difficulty: 0.12, motion: "calm", weight: [0.5, 4] },
  { id: "oldboot", vi: "Chiếc ủng cũ", en: "Old Boot", rarity: "common", zone: "shore", value: 3, difficulty: 0.1, motion: "sink", weight: [0.3, 1.4] },
  { id: "treasure", vi: "Rương kho báu", en: "Treasure Chest", rarity: "epic", zone: "vortex", value: 460, difficulty: 0.6, motion: "sink", weight: [5, 30] },
];

export const FISH_BY_ID = new Map(FISH.map((fish) => [fish.id, fish]));
export const FISH_COUNT = FISH.length;

export function fishName(fish: FishDef, lang: "vi" | "en"): string {
  return lang === "vi" ? fish.vi : fish.en;
}

/* ------------------------------------------------------------------ */
/*  Quay xổ số cắn câu                                                 */
/* ------------------------------------------------------------------ */

function eligible(fish: FishDef, zone: Exclude<FishZone, "both">, season: Season, night: boolean): boolean {
  if (fish.zone !== "both" && fish.zone !== zone) return false;
  if (fish.seasons && !fish.seasons.includes(season)) return false;
  if (fish.time === "night" && !night) return false;
  if (fish.time === "day" && night) return false;
  return true;
}

/**
 * Chọn ngẫu nhiên một loài theo trọng số độ hiếm.
 * `luck` (0..1) kéo trọng số về phía các loài hiếm — xoáy nước ngoài khơi có
 * luck cao hơn hẳn bến câu, đó là lý do người chơi chịu khó ra khơi.
 */
export function rollFish(zone: Exclude<FishZone, "both">, season: Season, night: boolean, luck = 0): FishDef {
  const pool = FISH.filter((fish) => eligible(fish, zone, season, night));
  const list = pool.length ? pool : FISH.filter((fish) => fish.zone !== "vortex");
  const weights = list.map((fish) => {
    const base = RARITY_META[fish.rarity].weight;
    const tier = RARITY_ORDER.indexOf(fish.rarity);
    /* Mỗi bậc hiếm được nhân thêm theo luck, nên luck=1 kéo cá hiếm lên gấp bội. */
    return base * Math.pow(1 + luck * 1.9, tier);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return list[i];
  }
  return list[list.length - 1];
}

/** Cân nặng ngẫu nhiên, lệch về phía nhỏ để con to thật sự đáng nhớ. */
export function rollWeight(fish: FishDef): number {
  const [min, max] = fish.weight;
  const skewed = Math.pow(Math.random(), 1.8);
  return Math.round((min + (max - min) * skewed) * 100) / 100;
}

/** Giá bán một con cá: giá cơ bản nhân theo cỡ so với trung bình của loài. */
export function fishValue(fish: FishDef, weight: number): number {
  const [min, max] = fish.weight;
  const mid = (min + max) / 2;
  const ratio = mid > 0 ? weight / mid : 1;
  return Math.max(1, Math.round(fish.value * (0.55 + ratio * 0.55)));
}

/* ------------------------------------------------------------------ */
/*  Mồi câu                                                            */
/*                                                                     */
/*  Xu trước đây chỉ có một chỗ để tiêu là Chợ Trang Trí, nên tiêu hết  */
/*  một lượt là chẳng còn lý do gì để đi câu tiếp. Mồi là cống tiêu thứ */
/*  hai, và là cống duy nhất trả lại thứ mà người chơi đang thiếu: cơ   */
/*  hội gặp loài hiếm.                                                 */
/* ------------------------------------------------------------------ */

export type BaitId = "worm" | "shrimp" | "squid" | "chum";

export interface BaitDef {
  id: BaitId;
  vi: string;
  en: string;
  /** Giá một hộp, tính bằng xu. */
  price: number;
  /** Số lần thả cần mà một hộp dùng được. */
  casts: number;
  /** Cộng thẳng vào `luck` của xổ số cắn câu. */
  luck: number;
}

/* Giá mỗi lượt thả cần tăng dần theo may mắn nó mua được: 1,4 · 3,0 · 6,4 ·
   11,2 xu một lượt. Người chơi mới đủ tiền mua giun ngay sau vài con cá, còn
   mồi mực thì phải bán cả giỏ. */
export const BAITS: BaitDef[] = [
  { id: "worm", vi: "Giun biển", en: "Sea Worm", price: 42, casts: 30, luck: 0.1 },
  { id: "shrimp", vi: "Tép bạc", en: "Silver Shrimp", price: 135, casts: 45, luck: 0.22 },
  { id: "squid", vi: "Mực cắt", en: "Cut Squid", price: 384, casts: 60, luck: 0.38 },
  { id: "chum", vi: "Mồi tanh", en: "Blood Chum", price: 896, casts: 80, luck: 0.55 },
];

export const BAIT_BY_ID = new Map(BAITS.map((bait) => [bait.id, bait]));

/** Hộp mồi đang dùng. `null` nghĩa là câu chay. */
export interface BaitState {
  id: BaitId;
  /** Số lượt thả cần còn lại. */
  left: number;
}

export function baitLuck(bait: BaitState | null): number {
  if (!bait || bait.left <= 0) return 0;
  return BAIT_BY_ID.get(bait.id)?.luck ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Giải câu cá trong ngày                                             */
/*                                                                     */
/*  Bộ sưu tập thưởng cho việc gặp đủ loài, còn giải này thưởng cho một */
/*  thứ khác hẳn: con cá to nhất bắt được hôm nay. Hai mục tiêu kéo về  */
/*  hai hướng ngược nhau, nên chúng không nuốt lẫn nhau.                */
/* ------------------------------------------------------------------ */

export interface TournamentTier {
  /** Ngưỡng cân nặng (kg) của con cá to nhất trong ngày. */
  kg: number;
  coins: number;
}

export const TOURNAMENT_TIERS: TournamentTier[] = [
  { kg: 1, coins: 40 },
  { kg: 5, coins: 120 },
  { kg: 20, coins: 340 },
  { kg: 60, coins: 780 },
  { kg: 150, coins: 1600 },
];

/** Bậc giải đã đạt với con cá to nhất trong ngày; 0 nghĩa là chưa tới bậc nào. */
export function tournamentTier(bestKg: number): number {
  let tier = 0;
  for (let i = 0; i < TOURNAMENT_TIERS.length; i++) {
    if (bestKg >= TOURNAMENT_TIERS[i].kg) tier = i + 1;
  }
  return tier;
}

/** Xu nhận được nếu lĩnh thưởng ngay bây giờ. */
export function tournamentReward(bestKg: number): number {
  const tier = tournamentTier(bestKg);
  return tier > 0 ? TOURNAMENT_TIERS[tier - 1].coins : 0;
}

/* ------------------------------------------------------------------ */
/*  Minigame — cùng cơ chế thanh trượt của Stardew Valley               */
/* ------------------------------------------------------------------ */

export interface FishingConfig {
  /** chiều cao khung giữ cá, 0..1 theo chiều dài cần */
  barHeight: number;
  /** tốc độ nạp tiến trình khi cá nằm trong khung */
  fillRate: number;
  /** tốc độ tụt tiến trình khi cá ra ngoài khung */
  drainRate: number;
  /** biên độ và nhịp di chuyển của cá */
  fishSpeed: number;
}

/**
 * Cấu hình theo độ khó của loài và cấp cần câu.
 * Cần câu lên cấp thì khung rộng ra và tiến trình nạp nhanh hơn — đó là toàn bộ
 * cảm giác "tiến bộ" của trò câu.
 */
export function fishingConfig(fish: FishDef, rodLevel: number): FishingConfig {
  const rod = Math.max(1, Math.min(5, rodLevel));
  return {
    barHeight: 0.17 + rod * 0.021 - fish.difficulty * 0.075,
    fillRate: 0.42 + rod * 0.035 - fish.difficulty * 0.12,
    drainRate: 0.20 + fish.difficulty * 0.30,
    /* Trần 1,09 đơn vị/giây, thấp hơn vận tốc tới hạn của khung (1,3 lên và 1,4
       xuống): con cá nhanh nhất vẫn phải trong tầm với của người chơi. */
    fishSpeed: 0.3 + fish.difficulty * 0.9,
  };
}

/** Cấp cần câu suy ra từ số cá đã bắt — không cần thêm một bảng nâng cấp nữa. */
export const ROD_STEPS = [0, 15, 45, 110, 240];

export function rodLevel(caught: number): number {
  let level = 1;
  for (let i = 0; i < ROD_STEPS.length; i++) if (caught >= ROD_STEPS[i]) level = i + 1;
  return level;
}

export function rodProgress(caught: number): { level: number; have: number; need: number } {
  const level = rodLevel(caught);
  if (level >= ROD_STEPS.length) return { level, have: 1, need: 1 };
  const base = ROD_STEPS[level - 1];
  const next = ROD_STEPS[level];
  return { level, have: caught - base, need: next - base };
}

/** Thời gian chờ cá cắn câu (giây) — ngẫu nhiên để mỗi lần thả cần một khác. */
export function biteDelay(): number {
  return 1.1 + Math.random() * 2.9;
}

/**
 * Vị trí mục tiêu tiếp theo của cá trong khung 0..1.
 * Mỗi kiểu bơi có một tính cách riêng: `dart` nhảy cóc, `sink` bám đáy,
 * `calm` gần như đứng yên.
 */
export function nextFishTarget(motion: FishMotion, current: number): number {
  const r = Math.random();
  switch (motion) {
    case "calm":
      return Math.max(0, Math.min(1, current + (r - 0.5) * 0.3));
    case "smooth":
      return Math.max(0, Math.min(1, current + (r - 0.5) * 0.7));
    case "dart":
      return r < 0.45 ? Math.random() : Math.max(0, Math.min(1, current + (r - 0.5) * 1.2));
    case "sink":
      return Math.pow(r, 2.1) * 0.85;
    default:
      return r;
  }
}
