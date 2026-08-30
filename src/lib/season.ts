/* ------------------------------------------------------------------ */
/*  Mùa và thời tiết — logic thuần, không phụ thuộc Three.js            */
/*  Tách riêng để state và UI dùng được mà không kéo theo bundle 3D.    */
/* ------------------------------------------------------------------ */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type WeatherId = "clear" | "cloudy" | "rain" | "storm" | "snow" | "petals" | "leaves" | "mist" | "fireflies";
export type DayPhase = "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night";

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
export const WEATHERS: WeatherId[] = ["clear", "cloudy", "rain", "storm", "snow", "petals", "leaves", "mist", "fireflies"];
export const DAY_PHASES: DayPhase[] = ["dawn", "morning", "noon", "afternoon", "dusk", "night"];

/** Mùa theo lịch dương, quy ước Bắc bán cầu (áp dụng cho Việt Nam). */
export function seasonForDate(date: Date): Season {
  const month = date.getMonth();
  if (month >= 1 && month <= 3) return "spring";
  if (month >= 4 && month <= 6) return "summer";
  if (month >= 7 && month <= 9) return "autumn";
  return "winter";
}

export function phaseForHour(hour: number): DayPhase {
  if (hour < 5) return "night";
  if (hour < 7.5) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 14) return "noon";
  if (hour < 16.5) return "afternoon";
  if (hour < 19) return "dusk";
  return "night";
}

export interface SeasonPalette {
  /** sắc lá cây và thảm cỏ */
  foliage: number;
  foliageAlt: number;
  /** sắc nước nông ven bờ */
  shallow: number;
  /** sương mù xa */
  fog: number;
  /** ám sắc ánh sáng mặt trời */
  sunTint: number;
  /** hệ số ấm 0..1 dùng cho tone mapping */
  warmth: number;
  /** lượng tuyết phủ trên thảm cỏ 0..1 */
  snow: number;
}

export const SEASON_PALETTES: Record<Season, SeasonPalette> = {
  spring: { foliage: 0x4fae74, foliageAlt: 0x74c88d, shallow: 0x3fb4a8, fog: 0x1a4f55, sunTint: 0xffe6c4, warmth: 0.62, snow: 0 },
  summer: { foliage: 0x2f8f5c, foliageAlt: 0x4bb87a, shallow: 0x30bcc0, fog: 0x17515c, sunTint: 0xfff0cf, warmth: 0.86, snow: 0 },
  autumn: { foliage: 0xb2803a, foliageAlt: 0xd0a24a, shallow: 0x3c9aa0, fog: 0x3a3a34, sunTint: 0xffcf96, warmth: 0.72, snow: 0 },
  winter: { foliage: 0x5a7f70, foliageAlt: 0x7d9a8c, shallow: 0x4e8ea8, fog: 0x2a3f4c, sunTint: 0xdce9ff, warmth: 0.32, snow: 0.55 },
};

export interface WeatherProfile {
  /** độ phủ mây 0..1 */
  overcast: number;
  /** cường độ mưa dùng cho shader nước và hạt 0..1 */
  rain: number;
  /** hệ số nhân cho sương mù */
  fogScale: number;
  /** giảm cường độ mặt trời */
  lightScale: number;
  /** có sấm chớp không */
  lightning: boolean;
}

export const WEATHER_PROFILES: Record<WeatherId, WeatherProfile> = {
  clear: { overcast: 0.0, rain: 0, fogScale: 1.0, lightScale: 1.0, lightning: false },
  cloudy: { overcast: 0.45, rain: 0, fogScale: 1.15, lightScale: 0.84, lightning: false },
  rain: { overcast: 0.72, rain: 0.65, fogScale: 1.5, lightScale: 0.62, lightning: false },
  storm: { overcast: 0.95, rain: 1.0, fogScale: 1.95, lightScale: 0.44, lightning: true },
  snow: { overcast: 0.7, rain: 0.12, fogScale: 1.6, lightScale: 0.74, lightning: false },
  petals: { overcast: 0.14, rain: 0, fogScale: 1.05, lightScale: 0.98, lightning: false },
  leaves: { overcast: 0.2, rain: 0, fogScale: 1.1, lightScale: 0.95, lightning: false },
  mist: { overcast: 0.35, rain: 0, fogScale: 2.3, lightScale: 0.78, lightning: false },
  fireflies: { overcast: 0.08, rain: 0, fogScale: 1.0, lightScale: 1.0, lightning: false },
};

/** Bảng cân theo mùa — số càng lớn càng dễ xuất hiện. */
const SEASON_WEIGHTS: Record<Season, Partial<Record<WeatherId, number>>> = {
  spring: { clear: 30, petals: 24, mist: 14, rain: 16, cloudy: 16 },
  summer: { clear: 34, cloudy: 16, rain: 18, storm: 12, fireflies: 20 },
  autumn: { clear: 26, leaves: 26, mist: 16, rain: 16, cloudy: 16 },
  winter: { cloudy: 26, mist: 20, snow: 18, rain: 14, clear: 22 },
};

/** Thời tiết chỉ hợp lệ vào ban đêm. */
const NIGHT_ONLY: WeatherId[] = ["fireflies"];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Thời tiết tự động: cố định trong mỗi khối 3 giờ nên không nhấp nháy giữa các
 * khung hình, nhưng vẫn đổi vài lần mỗi ngày.
 */
export function autoWeather(date: Date, season: Season, isNight: boolean): WeatherId {
  const block = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${Math.floor(date.getHours() / 3)}`;
  const weights = SEASON_WEIGHTS[season];
  const entries = (Object.entries(weights) as [WeatherId, number][]).filter(
    ([id]) => isNight || !NIGHT_ONLY.includes(id)
  );
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = hash(block) * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return "clear";
}
