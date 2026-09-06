/* ------------------------------------------------------------------ */
/*  Chuỗi nhiệm vụ tuần                                                */
/*                                                                     */
/*  Nhiệm vụ ngày đo một việc trong một hôm. Chuỗi tuần đo một thói     */
/*  quen: bốn chặng phải làm theo đúng thứ tự, và cả tuần mới đủ chỗ    */
/*  để làm hết cả bốn.                                                 */
/*                                                                     */
/*  Để ở đây chứ không ở `state/store.tsx` vì đây là luật chơi, không   */
/*  phải trạng thái React — và luật chơi thì phải kiểm được bằng Node   */
/*  mà không cần dựng cả một cây component.                            */
/* ------------------------------------------------------------------ */

/** Chỉ số mà một nhiệm vụ hay một chặng đo được. */
export type QuestMetric =
  | "task" | "quick" | "goal" | "networth" | "watch" | "note" | "visit" | "exam" | "voyage" | "decor"
  | "fish" | "news" | "shop";

export interface ChainStep {
  metric: QuestMetric;
  target: number;
}

export interface ChainDef {
  id: string;
  steps: ChainStep[];
  coins: number;
  /** Giá trần của món quà cuối chuỗi. */
  relicCap: number;
}

/** Chuỗi của tuần hiện tại. */
export interface WeeklyState {
  week: string;
  chainId: string;
  /** Chặng đang làm, 0..3. Bằng số chặng nghĩa là xong cả chuỗi. */
  step: number;
  /** Tiến độ của riêng chặng đang làm. */
  progress: number;
  claimed: boolean;
}

/* Mỗi chuỗi kéo về một hướng chơi khác nhau, và không chuỗi nào đo cùng một
   chỉ số hai lần: lặp lại thì chặng thứ hai chỉ là chặng thứ nhất kéo dài. */
export const CHAIN_DEFS: ChainDef[] = [
  {
    id: "c_helm",
    steps: [
      { metric: "task", target: 12 },
      { metric: "networth", target: 3 },
      { metric: "exam", target: 1 },
      { metric: "voyage", target: 4 },
    ],
    coins: 900,
    relicCap: 1400,
  },
  {
    id: "c_tide",
    steps: [
      { metric: "fish", target: 25 },
      { metric: "shop", target: 2 },
      { metric: "voyage", target: 3 },
      { metric: "decor", target: 5 },
    ],
    coins: 780,
    relicCap: 1100,
  },
  {
    id: "c_ledger",
    steps: [
      { metric: "quick", target: 10 },
      { metric: "note", target: 4 },
      { metric: "watch", target: 4 },
      { metric: "goal", target: 3 },
    ],
    coins: 720,
    relicCap: 1000,
  },
  {
    id: "c_compass",
    steps: [
      { metric: "visit", target: 4 },
      { metric: "news", target: 6 },
      { metric: "task", target: 20 },
      { metric: "exam", target: 2 },
    ],
    coins: 1050,
    relicCap: 1800,
  },
];

export const CHAIN_BY_ID = new Map(CHAIN_DEFS.map((chain) => [chain.id, chain]));
export const CHAIN_LENGTH = 4;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Khoá tuần theo chuẩn ISO — tuần bắt đầu từ thứ Hai.
 *
 * Không dùng `Math.floor(mốc thời gian / 7 ngày)`: mốc đó trôi dần so với ngày
 * trong tuần, nên người chơi sẽ thấy chuỗi đổi vào thứ Tư tuần này rồi thứ Bảy
 * tuần sau, mà không hiểu vì sao.
 */
export function weekKey(now: number = Date.now()): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  /* Thứ Năm cùng tuần quyết định năm ISO của tuần đó — đó là toàn bộ mẹo của
     ISO 8601, và cũng là thứ khiến tuần đầu tháng Giêng không bị đếm hai lần. */
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday + 3);
  const year = date.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  firstThursday.setHours(0, 0, 0, 0);
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Tuần nào ra chuỗi nào — cùng một tuần luôn ra cùng một chuỗi. */
export function chainForWeek(week: string): string {
  return CHAIN_DEFS[hash(week) % CHAIN_DEFS.length].id;
}

export function emptyWeekly(week: string): WeeklyState {
  return { week, chainId: chainForWeek(week), step: 0, progress: 0, claimed: false };
}

/** Chặng đang phải làm, hoặc `null` khi cả chuỗi đã xong. */
export function chainStep(weekly: WeeklyState): ChainStep | null {
  const chain = CHAIN_BY_ID.get(weekly.chainId);
  if (!chain || weekly.step >= chain.steps.length) return null;
  return chain.steps[weekly.step];
}

export function chainComplete(weekly: WeeklyState): boolean {
  const chain = CHAIN_BY_ID.get(weekly.chainId);
  return !!chain && weekly.step >= chain.steps.length;
}

/**
 * Cộng tiến độ cho chặng đang làm, và sang chặng kế nếu vừa đủ.
 *
 * Chỉ chặng ĐANG làm mới nhận tiến độ. Cho cả bốn chặng cùng chạy thì "chuỗi"
 * chỉ còn là bốn nhiệm vụ rời rạc dán chung một cái tên.
 */
export function bumpChain(weekly: WeeklyState, metric: QuestMetric, amount = 1): WeeklyState {
  const chain = CHAIN_BY_ID.get(weekly.chainId);
  if (!chain || weekly.step >= chain.steps.length) return weekly;
  const step = chain.steps[weekly.step];
  if (step.metric !== metric) return weekly;
  const progress = weekly.progress + amount;
  if (progress < step.target) return { ...weekly, progress };
  return { ...weekly, step: weekly.step + 1, progress: 0 };
}
