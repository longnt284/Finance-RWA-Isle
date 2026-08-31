import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { dayKey, uid } from "../lib/format";
import type { Currency } from "../lib/format";
import { makeT } from "../lib/i18n";
import type { Lang, TFn } from "../lib/i18n";
import { DEFAULT_WATCH } from "../lib/market";
import type { Season, WeatherId } from "../lib/season";
import { FISH_BY_ID, FISH_COUNT, RARITY_META } from "../lib/fishing";
import { SHOP_BY_ID, FREE_ITEMS } from "../lib/shop";

/* ============================== Types ============================== */

export type DistrictId = "crypto" | "stocks" | "vault" | "academy";
export type ViewId = DistrictId | "center" | "overview" | "isle";
/** Nơi có thể đặt đồ trang trí: đảo chính cộng bốn đảo riêng. */
export type IsleSlot = DistrictId | "main";

export interface Goal {
  id: string;
  district: DistrictId;
  title: string;
  target: number;
  current: number;
  unit: string;
  done: boolean;
  ts: number;
}

export interface Task {
  id: string;
  district: DistrictId;
  title: string;
  xp: number;
  done: boolean;
  ts: number;
  awardedXp?: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  ts: number;
}

export interface CustomAch {
  id: string;
  name: string;
  desc: string;
  done: boolean;
  ts: number;
}

export interface Snapshot {
  t: number;
  v: number;
}

export type LogKind = "xp" | "level" | "goal" | "milestone" | "system" | "event" | "ach" | "exam" | "quest";

export interface LogEntry {
  id: string;
  ts: number;
  /**
   * Khoá i18n của dòng nhật ký. Nhật ký được dịch lại mỗi lần vẽ, nên đổi ngôn
   * ngữ là đổi luôn những dòng đã ghi từ trước — trước đây câu chữ bị "nướng"
   * vào state lúc sự kiện xảy ra nên bảng Hoạt động lẫn hai thứ tiếng.
   */
  k?: string;
  /** Tham số đã là giá trị cuối: con số, hoặc chuỗi do chính người dùng nhập. */
  p?: Record<string, string | number>;
  /** Tham số mà giá trị lại là một khoá i18n khác (tên quận, tên công trình…). */
  pk?: Record<string, string>;
  /** Bản lưu cũ đã nướng sẵn câu chữ. Chỉ dùng khi thiếu `k`. */
  text?: string;
  kind: LogKind;
  xp?: number;
}

/** Dựng câu chữ cho một dòng nhật ký theo ngôn ngữ đang chọn. */
export function renderLog(t: TFn, entry: LogEntry): string {
  if (!entry.k) return entry.text ?? "";
  const vars: Record<string, string | number> = { ...entry.p };
  if (entry.pk) for (const [name, key] of Object.entries(entry.pk)) vars[name] = t(key);
  return t(entry.k, vars);
}

export interface Toast {
  id: string;
  title: string;
  sub?: string;
  kind: "gold" | "jade" | "info";
}

export type YachtTier = 1 | 2 | 3 | 4 | 5;
export type IslandTheme = "emerald" | "sunset" | "lagoon" | "violet";
export type QualityMode = "auto" | "high" | "balanced";

/** Cấu hình thế giới: để `auto` thì mùa và thời tiết bám theo đồng hồ thật. */
export interface WorldPrefs {
  mode: "auto" | "manual";
  season: Season;
  weather: WeatherId;
  quality: QualityMode;
  /** cho phép tắt hiệu ứng hạt trên máy yếu */
  effects: boolean;
}

/** Thông tin tài khoản đám mây. Không bao giờ chứa mật khẩu hay token. */
export interface AccountInfo {
  id: string;
  email: string;
  displayName: string;
  syncedAt: number;
}

/** Tiến độ nhiệm vụ hằng ngày, làm mới mỗi 0h theo giờ máy người dùng. */
export interface DailyQuestState {
  day: string;
  ids: string[];
  progress: Record<string, number>;
  claimed: string[];
}

/** Một dòng trong bộ sưu tập cá — giữ mãi kể cả khi con cá đã bán. */
export interface FishRecord {
  /** tổng số con đã bắt được của loài này */
  n: number;
  /** kỷ lục cân nặng (kg) */
  best: number;
  /** lần đầu bắt được */
  first: number;
}

/** Cá đang nằm trong giỏ, chưa bán. Giữ nguyên cân nặng để bán đúng giá. */
export interface CatchEntry {
  id: string;
  /** cân nặng (kg) */
  w: number;
  /** giá bán (xu) */
  v: number;
  ts: number;
}

/** Đồ trang trí đã mua và đang đặt ở đâu. */
export interface ShopState {
  owned: string[];
  placed: Record<IsleSlot, string[]>;
}

export interface State {
  city: string;
  focus: DistrictId;
  onboarded: boolean;
  lang: Lang;
  currency: Currency;
  xp: Record<DistrictId, number>;
  /** Cấp đã được cấp chứng nhận qua bài khảo thí — đây mới là cấp có hiệu lực. */
  certified: Record<DistrictId, number>;
  /** Số lần đã thi ở mỗi lĩnh vực; dùng làm hạt giống để mỗi lần thi ra đề khác. */
  examAttempts: Record<DistrictId, number>;
  examsPassed: number;
  goals: Goal[];
  tasks: Task[];
  notes: Note[];
  customAch: CustomAch[];
  snapshots: Snapshot[];
  log: LogEntry[];
  streak: number;
  lastVisit: string;
  lastClaim: string;
  claims: number;
  /** Vị trí trong chu kỳ điểm danh 7 ngày (0..6). */
  checkinDay: number;
  quests: DailyQuestState;
  events: number;
  totalTasksDone: number;
  visits: string[];
  watchlist: string[];
  isleDecor: Record<DistrictId, string[]>;
  isleTheme: Record<DistrictId, IslandTheme>;
  /** Xu — kiếm bằng bán cá, tiêu ở Chợ Trang Trí. */
  coins: number;
  /** Bộ sưu tập cá: mọi loài từng bắt được. */
  fish: Record<string, FishRecord>;
  /** Giỏ cá chưa bán. */
  basket: CatchEntry[];
  fishCaught: number;
  /** Tổng xu đã kiếm từ bán cá — dùng cho thống kê và thành tựu. */
  fishEarned: number;
  shop: ShopState;
  yachtTier: YachtTier;
  world: WorldPrefs;
  account: AccountInfo | null;
  /** Người dùng đã đọc và đồng ý cam kết riêng tư trước khi tạo tài khoản. */
  privacyAccepted: boolean;
  tutorialSeen: boolean;
  toasts: Toast[];
}

/* ============================== Meta ============================== */

export const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];
export const ISLE_SLOTS: IsleSlot[] = ["main", "crypto", "stocks", "vault", "academy"];
/** Số món tối đa đặt trên một đảo — quá tay thì đảo thành bãi phế liệu. */
export const PLACE_LIMIT = 14;

export const DISTRICTS: Record<DistrictId, { accent: string }> = {
  crypto: { accent: "#5ce8c4" },
  stocks: { accent: "#f0c268" },
  vault: { accent: "#ffd88a" },
  academy: { accent: "#9fd0ff" },
};

export function dLabel(t: TFn, d: DistrictId): string {
  return t(dLabelKey(d));
}
export function dBuilding(t: TFn, d: DistrictId): string {
  return t(dBuildingKey(d));
}
/* Nhật ký lưu khoá chứ không lưu câu đã dịch, nên cần hai hàm khoá riêng. */
export function dLabelKey(d: DistrictId): string {
  return `d.${d}.name`;
}
export function dBuildingKey(d: DistrictId): string {
  return `d.${d}.building`;
}

/**
 * Cấp 0 → 15. Khoảng cách giữa các cấp giãn dần: 60 XP cho cấp 1 nhưng 8.400 XP
 * cho cấp 15, nên hành trình cuối đòi hỏi kỷ luật thật chứ không cày vặt được.
 */
export const LEVEL_XP = [0, 60, 200, 450, 850, 1450, 2300, 3500, 5000, 7000, 9500, 12800, 17000, 22400, 29200, 37600];
export const MAX_LEVEL = 15;
/** Kiến trúc trong thế giới 3D thay đổi tới bậc 8; cấp cao hơn tiếp tục cộng chỉ số. */
export const VISUAL_MAX = 8;
export const ISLE_UNLOCK_LV = 8;
export const ISLE_UNLOCK_LEVELS: Record<DistrictId, number> = {
  crypto: ISLE_UNLOCK_LV,
  stocks: 7,
  vault: 6,
  academy: 5,
};
/** Cấp 1 được trao tự động; từ cấp 2 trở đi mỗi lần thăng cấp phải qua khảo thí. */
export const EXAM_FREE_LEVEL = 1;

export function levelFor(xp: number): number {
  let lv = 0;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lv = i;
  return Math.min(lv, MAX_LEVEL);
}

export function xpIntoLevel(xp: number): { have: number; need: number; pct: number } {
  const lv = levelFor(xp);
  if (lv >= MAX_LEVEL) return { have: xp - LEVEL_XP[MAX_LEVEL], need: 1, pct: 100 };
  const base = LEVEL_XP[lv];
  const next = LEVEL_XP[lv + 1];
  return { have: xp - base, need: next - base, pct: Math.round(((xp - base) / (next - base)) * 100) };
}

/** thưởng XP theo chuỗi ngày: +5% mỗi ngày, tối đa ×1.5 */
export function xpMult(streak: number): number {
  return 1 + Math.min(10, Math.max(0, streak)) * 0.05;
}

/**
 * Cấp đang chờ khảo thí ở một lĩnh vực, hoặc `null` nếu chưa đủ XP.
 * Đây là điều kiện hiển thị nút "Vào phòng khảo thí".
 */
export function pendingExamLevel(state: State, district: DistrictId): number | null {
  const eligible = levelFor(state.xp[district]);
  const certified = state.certified[district];
  return eligible > certified ? certified + 1 : null;
}

export function totalLevels(state: State): number {
  return DISTRICT_IDS.reduce((sum, d) => sum + state.certified[d], 0);
}

/* ============================== Du thuyền ============================== */

export const MAX_YACHT_TIER: YachtTier = 5;
export const YACHT_TIERS: YachtTier[] = [1, 2, 3, 4, 5];
/** Tổng cấp của cả bốn lĩnh vực cần đạt để mở khoá từng hạng du thuyền. */
export const YACHT_REQUIREMENT: Record<YachtTier, number> = { 1: 0, 2: 10, 3: 20, 4: 34, 5: 48 };

export function yachtTierFor(levels: number): YachtTier {
  let tier: YachtTier = 1;
  for (const candidate of YACHT_TIERS) if (levels >= YACHT_REQUIREMENT[candidate]) tier = candidate;
  return tier;
}

/** Hạng cao nhất người chơi đủ điều kiện nâng lên ngay lúc này. */
export function availableYachtTier(state: State): YachtTier {
  return yachtTierFor(totalLevels(state));
}

/* ============================== Điểm danh ============================== */

/** Phần thưởng chu kỳ 7 ngày; ngày thứ bảy là mốc lớn để giữ chân. */
export const CHECKIN_REWARDS = [30, 40, 55, 70, 90, 115, 180];
export const CHECKIN_CYCLE = CHECKIN_REWARDS.length;
/** Giữ tên cũ cho các chuỗi dịch và tài liệu tham chiếu tới quà ngày đầu. */
export const DAILY_XP = CHECKIN_REWARDS[0];

export function checkinReward(day: number): number {
  return CHECKIN_REWARDS[Math.max(0, Math.min(CHECKIN_CYCLE - 1, day))];
}

/**
 * Ô trong chu kỳ mà lần điểm danh tới sẽ rơi vào — hoặc ô vừa nhận nếu hôm nay
 * đã điểm danh rồi. Dùng chung cho HUD, bảng điểm danh và reducer để ba nơi
 * không bao giờ hiển thị lệch nhau khi người chơi bỏ lỡ một ngày.
 */
export function checkinIndex(state: State, now: number = Date.now()): number {
  if (state.lastClaim === dayKey(now)) return state.checkinDay;
  const continued = state.lastClaim === dayKey(now - 86400000);
  return continued ? (state.checkinDay + 1) % CHECKIN_CYCLE : 0;
}

/* ============================== Nhiệm vụ ngày ============================== */

export type QuestMetric =
  | "task" | "quick" | "goal" | "networth" | "watch" | "note" | "visit" | "exam" | "voyage" | "decor"
  | "fish" | "news" | "shop";

export interface QuestDef {
  id: string;
  metric: QuestMetric;
  target: number;
  xp: number;
}

export const QUEST_DEFS: QuestDef[] = [
  { id: "q_task3", metric: "task", target: 3, xp: 45 },
  { id: "q_task5", metric: "task", target: 5, xp: 75 },
  { id: "q_quick2", metric: "quick", target: 2, xp: 35 },
  { id: "q_goal1", metric: "goal", target: 1, xp: 40 },
  { id: "q_networth", metric: "networth", target: 1, xp: 35 },
  { id: "q_watch1", metric: "watch", target: 1, xp: 25 },
  { id: "q_note1", metric: "note", target: 1, xp: 30 },
  { id: "q_visit3", metric: "visit", target: 3, xp: 35 },
  { id: "q_voyage", metric: "voyage", target: 1, xp: 35 },
  { id: "q_exam", metric: "exam", target: 1, xp: 90 },
  { id: "q_decor", metric: "decor", target: 1, xp: 25 },
  { id: "q_fish3", metric: "fish", target: 3, xp: 40 },
  { id: "q_fish8", metric: "fish", target: 8, xp: 80 },
  { id: "q_news", metric: "news", target: 1, xp: 20 },
  { id: "q_shop", metric: "shop", target: 1, xp: 35 },
];

export const QUEST_BY_ID = new Map(QUEST_DEFS.map((quest) => [quest.id, quest]));
export const QUESTS_PER_DAY = 3;

function dayHash(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ba nhiệm vụ cố định trong ngày — cùng một ngày luôn ra cùng bộ. */
export function questsForDay(day: string): string[] {
  const pool = QUEST_DEFS.map((quest) => quest.id);
  const seed = dayHash(day);
  const picked: string[] = [];
  for (let i = 0; i < QUESTS_PER_DAY && pool.length; i++) {
    const index = (seed >>> (i * 5)) % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function emptyQuests(day: string): DailyQuestState {
  return { day, ids: questsForDay(day), progress: {}, claimed: [] };
}

export function questDone(state: State, id: string): boolean {
  const def = QUEST_BY_ID.get(id);
  if (!def) return false;
  return (state.quests.progress[id] ?? 0) >= def.target;
}

export function questClaimable(state: State, id: string): boolean {
  return questDone(state, id) && !state.quests.claimed.includes(id);
}

/** Cộng tiến độ cho mọi nhiệm vụ hôm nay đang đo cùng một chỉ số. */
function bumpQuests(quests: DailyQuestState, metric: QuestMetric, amount = 1): DailyQuestState {
  let changed = false;
  const progress = { ...quests.progress };
  for (const id of quests.ids) {
    const def = QUEST_BY_ID.get(id);
    if (!def || def.metric !== metric) continue;
    const next = Math.min(def.target, (progress[id] ?? 0) + amount);
    if (next !== (progress[id] ?? 0)) {
      progress[id] = next;
      changed = true;
    }
  }
  return changed ? { ...quests, progress } : quests;
}

/* ============================== Achievements ============================== */

export type AchTier = "easy" | "mid" | "hard";

export interface AchDef {
  id: string;
  tier: AchTier;
  reward: number;
  done: (s: State) => boolean;
}

export const ACH_DEFS: AchDef[] = [
  { id: "a1", tier: "easy", reward: 20, done: (s) => s.totalTasksDone >= 1 },
  { id: "a2", tier: "easy", reward: 20, done: (s) => s.streak >= 3 },
  { id: "a3", tier: "easy", reward: 25, done: (s) => new Set(s.visits).size >= 3 },
  { id: "a4", tier: "mid", reward: 60, done: (s) => s.totalTasksDone >= 10 },
  { id: "a5", tier: "mid", reward: 60, done: (s) => s.claims >= 5 },
  { id: "a6", tier: "mid", reward: 60, done: (s) => s.watchlist.length >= 5 },
  { id: "a7", tier: "mid", reward: 70, done: (s) => DISTRICT_IDS.filter((d) => s.certified[d] >= 3).length >= 2 },
  { id: "a8", tier: "hard", reward: 150, done: (s) => s.certified.crypto >= 5 },
  { id: "a9", tier: "hard", reward: 150, done: (s) => (s.snapshots.length ? s.snapshots[s.snapshots.length - 1].v >= 5e8 : false) },
  { id: "a10", tier: "hard", reward: 120, done: (s) => s.streak >= 7 },
  { id: "a11", tier: "hard", reward: 250, done: (s) => s.certified.crypto >= ISLE_UNLOCK_LV },
  { id: "a12", tier: "hard", reward: 150, done: (s) => s.certified.academy >= 5 },
  { id: "a13", tier: "hard", reward: 200, done: (s) => DISTRICT_IDS.reduce((sum, d) => sum + s.xp[d], 0) >= 3000 },
  { id: "a14", tier: "mid", reward: 50, done: (s) => s.events >= 5 },
  { id: "a15", tier: "easy", reward: 30, done: (s) => s.examsPassed >= 1 },
  { id: "a16", tier: "mid", reward: 80, done: (s) => s.examsPassed >= 10 },
  { id: "a17", tier: "hard", reward: 220, done: (s) => s.yachtTier >= 4 },
  { id: "a18", tier: "hard", reward: 320, done: (s) => s.yachtTier >= MAX_YACHT_TIER },
  { id: "a19", tier: "hard", reward: 400, done: (s) => DISTRICT_IDS.some((d) => s.certified[d] >= MAX_LEVEL) },
  { id: "a20", tier: "mid", reward: 70, done: (s) => s.claims >= CHECKIN_CYCLE },
  { id: "a21", tier: "easy", reward: 25, done: (s) => s.fishCaught >= 1 },
  { id: "a22", tier: "mid", reward: 80, done: (s) => Object.keys(s.fish).length >= 12 },
  { id: "a23", tier: "hard", reward: 260, done: (s) => Object.keys(s.fish).length >= FISH_COUNT },
  {
    id: "a24",
    tier: "hard",
    reward: 200,
    done: (s) => Object.keys(s.fish).some((id) => FISH_BY_ID.get(id)?.rarity === "legend"),
  },
  { id: "a25", tier: "mid", reward: 70, done: (s) => s.shop.owned.filter((id) => !FREE_ITEMS.includes(id)).length >= 10 },
  { id: "a26", tier: "hard", reward: 240, done: (s) => s.shop.owned.filter((id) => !FREE_ITEMS.includes(id)).length >= 40 },
  { id: "a27", tier: "mid", reward: 60, done: (s) => s.fishEarned >= 2000 },
];

/* ============================== Actions ============================== */

type Action =
  | { type: "INIT_DAY"; today: string; yesterday: string }
  | { type: "COMPLETE_ONBOARDING"; name: string; focus: DistrictId; demo: boolean }
  | { type: "ADD_GOAL"; goal: Goal }
  | { type: "ADD_TASK"; task: Task }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "SET_GOAL_PROGRESS"; id: string; current: number }
  | { type: "LOG_TRADE"; district: DistrictId; labelKey: string; xp: number }
  | { type: "AWARD_ACH"; district: DistrictId; achId: string; xp: number }
  | { type: "LOG_NETWORTH"; value: number }
  | { type: "ADD_NOTE"; note: Note }
  | { type: "DELETE_NOTE"; id: string }
  | { type: "ADD_CUSTOM_ACH"; ach: CustomAch }
  | { type: "COMPLETE_CUSTOM_ACH"; id: string }
  | { type: "ADD_WATCH"; id: string }
  | { type: "REMOVE_WATCH"; id: string }
  | { type: "TOGGLE_DECOR"; district: DistrictId; id: string }
  | { type: "SET_ISLE_THEME"; district: DistrictId; theme: IslandTheme }
  | { type: "CATCH_FISH"; fishId: string; weight: number; value: number }
  | { type: "SELL_FISH"; fishId: string }
  | { type: "SELL_ALL" }
  | { type: "BUY_ITEM"; itemId: string }
  | { type: "TOGGLE_PLACE"; slot: IsleSlot; itemId: string }
  | { type: "READ_NEWS" }
  | { type: "SET_LANG"; lang: Lang }
  | { type: "SET_CURRENCY"; currency: Currency }
  | { type: "RENAME_CITY"; name: string }
  | { type: "CLAIM_DAILY"; today: string; yesterday: string }
  | { type: "CLAIM_QUEST"; id: string }
  | { type: "EXAM_RESULT"; district: DistrictId; passed: boolean }
  | { type: "UPGRADE_YACHT" }
  | { type: "SET_WORLD"; patch: Partial<WorldPrefs> }
  | { type: "SET_ACCOUNT"; account: AccountInfo | null }
  | { type: "ACCEPT_PRIVACY" }
  | { type: "HYDRATE"; state: State }
  | { type: "LOG_EVENT"; k: string; p?: Record<string, string | number> }
  | { type: "MARK_TUTORIAL" }
  | { type: "VISIT"; view: string }
  | { type: "START_VOYAGE" }
  | { type: "PUSH_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "RESET_ALL" };

const TRADE_XP = 18;
const NETWORTH_XP = 8;
const GOAL_BONUS_XP = 120;
const CUSTOM_ACH_XP = 50;

function pushLog(log: LogEntry[], entry: Omit<LogEntry, "id" | "ts">): LogEntry[] {
  return [{ id: uid(), ts: Date.now(), ...entry }, ...log].slice(0, 60);
}

function withToast(toasts: Toast[], t: Omit<Toast, "id">): Toast[] {
  return [...toasts, { id: uid(), ...t }].slice(-4);
}

/**
 * Cộng XP. Cấp 1 được trao ngay; từ cấp 2 chỉ mở ra lời mời khảo thí chứ không
 * tự thăng cấp — người chơi phải trả lời đúng 4/5 câu mới được công nhận.
 */
function gainXp(state: State, district: DistrictId, amount: number): State {
  const t = makeT(state.lang);
  const xp = { ...state.xp, [district]: Math.max(0, state.xp[district] + amount) };
  let certified = state.certified;
  let log = state.log;
  let toasts = state.toasts;

  const eligible = levelFor(xp[district]);
  if (eligible >= EXAM_FREE_LEVEL && certified[district] < EXAM_FREE_LEVEL) {
    certified = { ...certified, [district]: EXAM_FREE_LEVEL };
    const b = dBuilding(t, district);
    log = pushLog(log, { k: "log.lvl", pk: { b: dBuildingKey(district) }, p: { n: EXAM_FREE_LEVEL }, kind: "level" });
    toasts = withToast(toasts, { title: t("toast.lvl", { b, n: EXAM_FREE_LEVEL }), sub: t("toast.lvlSub"), kind: "gold" });
  } else if (eligible > certified[district] && levelFor(state.xp[district]) <= certified[district]) {
    /* Vừa vượt ngưỡng XP: mời vào phòng khảo thí thay vì thăng cấp thẳng. */
    const b = dBuilding(t, district);
    const next = certified[district] + 1;
    log = pushLog(log, { k: "log.examReady", pk: { b: dBuildingKey(district) }, p: { n: next }, kind: "exam" });
    toasts = withToast(toasts, { title: t("toast.examReady", { b }), sub: t("toast.examReadySub", { n: next }), kind: "gold" });
  }
  return { ...state, xp, certified, log, toasts };
}

/* ============================== Seeds ============================== */

function emptyXp(): Record<DistrictId, number> {
  return { crypto: 0, stocks: 0, vault: 0, academy: 0 };
}

function emptyIsleDecor(): Record<DistrictId, string[]> {
  return { crypto: [], stocks: [], vault: [], academy: [] };
}

function emptyShop(): ShopState {
  return { owned: [...FREE_ITEMS], placed: { main: [], crypto: [], stocks: [], vault: [], academy: [] } };
}

/** Số lượng còn trong giỏ của một loài. */
export function basketCount(state: State, fishId: string): number {
  return state.basket.reduce((sum, entry) => (entry.id === fishId ? sum + 1 : sum), 0);
}

/** Tổng giá trị giỏ cá — con số hiện trên nút "Bán tất cả". */
export function basketValue(state: State): number {
  return state.basket.reduce((sum, entry) => sum + entry.v, 0);
}

export function ownsItem(state: State, itemId: string): boolean {
  return state.shop.owned.includes(itemId);
}

export function isPlaced(state: State, slot: IsleSlot, itemId: string): boolean {
  return state.shop.placed[slot].includes(itemId);
}

function defaultIsleThemes(): Record<DistrictId, IslandTheme> {
  return { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" };
}

function defaultWorld(): WorldPrefs {
  return { mode: "auto", season: "spring", weather: "clear", quality: "auto", effects: true };
}

export function freshState(): State {
  const today = dayKey(Date.now());
  return {
    city: "",
    focus: "crypto",
    onboarded: false,
    lang: "vi",
    currency: "VND",
    xp: emptyXp(),
    certified: emptyXp(),
    examAttempts: emptyXp(),
    examsPassed: 0,
    goals: [],
    tasks: [],
    notes: [],
    customAch: [],
    snapshots: [],
    log: [],
    streak: 0,
    lastVisit: "",
    lastClaim: "",
    claims: 0,
    checkinDay: 0,
    quests: emptyQuests(today),
    events: 0,
    totalTasksDone: 0,
    visits: [],
    watchlist: [...DEFAULT_WATCH],
    isleDecor: emptyIsleDecor(),
    isleTheme: defaultIsleThemes(),
    coins: 0,
    fish: {},
    basket: [],
    fishCaught: 0,
    fishEarned: 0,
    shop: emptyShop(),
    yachtTier: 1,
    world: defaultWorld(),
    account: null,
    privacyAccepted: false,
    tutorialSeen: false,
    toasts: [],
  };
}

function seedOnboarded(state: State, name: string, focus: DistrictId): State {
  const t = makeT(state.lang);
  const now = Date.now();
  const city = name.trim() || (state.lang === "vi" ? "Đảo Thịnh Vượng" : "Prosperity Isle");
  const first = state.lang === "vi" ? "Đặt nền móng đầu tiên" : "Lay the first foundation";
  let s: State = {
    ...state,
    city,
    focus,
    onboarded: true,
    lastVisit: dayKey(now),
    streak: 1,
    totalTasksDone: 1,
    visits: [focus],
    tasks: [{ id: uid(), district: focus, title: first, xp: 60, done: true, ts: now }],
    log: pushLog([], { k: "log.founded", p: { c: city }, pk: { d: dLabelKey(focus) }, kind: "system" }),
    toasts: withToast([], { title: t("toast.welcome"), sub: t("toast.welcomeSub"), kind: "info" }),
  };
  s = gainXp(s, focus, 60);
  return s;
}

function demoState(lang: Lang): State {
  const t = makeT(lang);
  const now = Date.now();
  const D = 86400000;
  const vi = lang === "vi";
  const xp = { crypto: 9500, stocks: 5000, vault: 3500, academy: 2300 };
  let s: State = {
    ...freshState(),
    lang,
    city: vi ? "Tân Vượng Đảo" : "New Prosperity Isle",
    focus: "crypto",
    onboarded: true,
    lastVisit: dayKey(now),
    lastClaim: dayKey(now),
    claims: 6,
    checkinDay: 5,
    events: 5,
    streak: 6,
    totalTasksDone: 9,
    visits: ["crypto", "stocks", "vault"],
    xp,
    /* Bản demo đã qua khảo thí đầy đủ nên hiện ngay kiến trúc bậc cao. */
    certified: { crypto: levelFor(xp.crypto), stocks: levelFor(xp.stocks), vault: levelFor(xp.vault), academy: levelFor(xp.academy) },
    examsPassed: 12,
    yachtTier: 3,
    coins: 1850,
    fishCaught: 27,
    fishEarned: 3120,
    fish: {
      sardine: { n: 8, best: 0.33, first: now - 9 * D },
      mullet: { n: 5, best: 1.42, first: now - 8 * D },
      seabass: { n: 4, best: 4.1, first: now - 6 * D },
      squid: { n: 3, best: 1.6, first: now - 5 * D },
      mackerel: { n: 4, best: 2.4, first: now - 4 * D },
      barracuda: { n: 2, best: 9.8, first: now - 2 * D },
      swordfish: { n: 1, best: 63.5, first: now - D },
    },
    basket: [
      { id: "seabass", w: 3.2, v: 46, ts: now - 5400e3 },
      { id: "mackerel", w: 1.9, v: 24, ts: now - 3600e3 },
      { id: "barracuda", w: 8.4, v: 132, ts: now - 1800e3 },
    ],
    shop: {
      owned: [...FREE_ITEMS, "pl_palm6", "li_lanternjade", "bd_cottage", "st_fountain", "se_pier", "gr_jade"],
      placed: {
        main: ["pl_palm6", "li_lanternjade", "bd_cottage", "st_fountain"],
        crypto: ["gr_jade", "se_pier"],
        stocks: [],
        vault: [],
        academy: [],
      },
    },
    isleDecor: {
      crypto: ["palms", "neon", "dock"],
      stocks: ["flags", "torch", "dock"],
      vault: ["palms", "torch"],
      academy: ["palms", "flags", "neon"],
    },
    tutorialSeen: true,
    notes: [
      {
        id: uid(),
        title: vi ? "Kế hoạch DCA 2026" : "DCA plan 2026",
        body: vi
          ? "2tr/tuần BTC · 1tr/tuần ETH. Review lại mỗi chủ nhật."
          : "2M VND/week BTC · 1M VND/week ETH. Review every Sunday.",
        ts: now - 3 * D,
      },
    ],
    customAch: [
      {
        id: uid(),
        name: vi ? "Không FOMO 30 ngày" : "30 days without FOMO",
        desc: vi ? "Chỉ vào lệnh theo kế hoạch" : "Only plan-based entries",
        done: false,
        ts: now - 5 * D,
      },
    ],
    goals: [
      { id: uid(), district: "crypto", title: vi ? "Tích lũy 0,5 BTC" : "Stack 0.5 BTC", target: 0.5, current: 0.32, unit: "BTC", done: false, ts: now - 40 * D },
      { id: uid(), district: "stocks", title: vi ? "Danh mục cổ tức 200 triệu" : "200M dividend portfolio", target: 200, current: 86, unit: "tr ₫", done: false, ts: now - 60 * D },
      { id: uid(), district: "vault", title: vi ? "Sổ tiết kiệm mua nhà 500 triệu" : "500M house fund", target: 500, current: 224, unit: "tr ₫", done: false, ts: now - 90 * D },
      { id: uid(), district: "academy", title: vi ? "Khóa Phân tích kỹ thuật nâng cao" : "Advanced TA course", target: 24, current: 24, unit: vi ? "buổi" : "sessions", done: true, ts: now - 12 * D },
    ],
    tasks: [
      { id: uid(), district: "crypto", title: vi ? "Thiết lập DCA BTC 2 triệu/tuần" : "Set weekly BTC DCA", xp: 40, done: true, ts: now - 30 * D },
      { id: uid(), district: "crypto", title: vi ? "Nghiên cứu ETH staking & LRT" : "Research ETH staking & LRT", xp: 30, done: true, ts: now - 18 * D },
      { id: uid(), district: "crypto", title: vi ? "Backtest chiến lược 2021–2025" : "Backtest 2021–2025 strategy", xp: 35, done: false, ts: now - 6 * D },
      { id: uid(), district: "stocks", title: vi ? "Đọc hết 'Nhà đầu tư thông minh'" : "Finish 'The Intelligent Investor'", xp: 40, done: true, ts: now - 22 * D },
      { id: uid(), district: "stocks", title: vi ? "DCA VN30 mỗi tháng" : "Monthly VN30 DCA", xp: 30, done: false, ts: now - 2 * D },
      { id: uid(), district: "vault", title: vi ? "Tự động trích 15% lương vào tiết kiệm" : "Auto-save 15% of salary", xp: 35, done: true, ts: now - 45 * D },
      { id: uid(), district: "academy", title: vi ? "Viết nhật ký giao dịch 30 ngày" : "30-day trading journal", xp: 40, done: false, ts: now - 4 * D },
    ],
    snapshots: Array.from({ length: 16 }, (_, i) => ({
      t: now - (15 - i) * 4 * D,
      v: 388e6 + i * 9.1e6 + Math.sin(i * 1.7) * 11e6,
    })),
    log: pushLog([], { k: "log.demo", kind: "system" }),
    toasts: [{ id: uid(), title: t("toast.welcome"), sub: t("toast.welcomeSub"), kind: "info" }],
  };
  s.log = pushLog(s.log, { k: "log.isle", kind: "milestone" });
  s.log = pushLog(s.log, { k: "log.lvl", pk: { b: dBuildingKey("stocks") }, p: { n: levelFor(xp.stocks) }, kind: "level" });
  return s;
}

/* ============================== Reducer ============================== */

function reducer(state: State, action: Action): State {
  const t = makeT(state.lang);
  switch (action.type) {
    case "INIT_DAY": {
      let s = state;
      /* Bộ nhiệm vụ mới khi sang ngày mới. */
      if (s.quests.day !== action.today) s = { ...s, quests: emptyQuests(action.today) };
      if (s.lastVisit === action.today || !s.onboarded) return s;
      const cont = s.lastVisit === action.yesterday;
      const streak = cont ? s.streak + 1 : 1;
      s = { ...s, streak, lastVisit: action.today };
      s = { ...s, log: pushLog(s.log, { k: "log.streak", p: { n: streak }, kind: "system" }) };
      if (cont) {
        s = gainXp(s, s.focus, 20);
        s = { ...s, log: pushLog(s.log, { k: "log.streakXp", p: { x: 20 }, pk: { d: dLabelKey(s.focus) }, kind: "xp", xp: 20 }) };
        s = { ...s, toasts: withToast(s.toasts, { title: t("toast.streak", { n: streak }), sub: t("toast.streakSub"), kind: "jade" }) };
      }
      return s;
    }
    case "COMPLETE_ONBOARDING":
      return action.demo ? demoState(state.lang) : seedOnboarded(state, action.name, action.focus);
    case "ADD_GOAL": {
      const s = { ...state, goals: [action.goal, ...state.goals] };
      return { ...s, log: pushLog(s.log, { k: "log.goalNew", p: { t: action.goal.title }, pk: { d: dLabelKey(action.goal.district) }, kind: "system" }) };
    }
    case "ADD_TASK": {
      const s = { ...state, tasks: [action.task, ...state.tasks] };
      return { ...s, log: pushLog(s.log, { k: "log.taskNew", p: { t: action.task.title }, kind: "system" }) };
    }
    case "TOGGLE_TASK": {
      const task = state.tasks.find((x) => x.id === action.id);
      if (!task) return state;
      const nowDone = !task.done;
      const gained = task.awardedXp ?? Math.round(task.xp * xpMult(state.streak));
      const tasks = state.tasks.map((x) =>
        x.id === action.id ? { ...x, done: nowDone, awardedXp: gained, ts: Date.now() } : x
      );
      let s: State = { ...state, tasks, totalTasksDone: Math.max(0, state.totalTasksDone + (nowDone ? 1 : -1)) };
      if (nowDone) {
        s = gainXp(s, task.district, gained);
        s = { ...s, log: pushLog(s.log, { k: "log.taskDone", p: { t: task.title, x: gained }, kind: "xp", xp: gained }) };
        s = { ...s, quests: bumpQuests(s.quests, "task") };
      } else {
        s = gainXp(s, task.district, -gained);
      }
      return s;
    }
    case "SET_GOAL_PROGRESS": {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal) return state;
      const current = Math.max(0, Math.min(goal.target, action.current));
      const justDone = current >= goal.target && !goal.done;
      const goals = state.goals.map((g) => (g.id === action.id ? { ...g, current, done: current >= goal.target } : g));
      let s: State = { ...state, goals, quests: bumpQuests(state.quests, "goal") };
      if (justDone) {
        s = gainXp(s, goal.district, GOAL_BONUS_XP);
        s = { ...s, log: pushLog(s.log, { k: "log.goalDone", p: { t: goal.title, x: GOAL_BONUS_XP }, kind: "goal", xp: GOAL_BONUS_XP }) };
        s = { ...s, toasts: withToast(s.toasts, { title: t("toast.goal"), sub: t("toast.goalSub", { t: goal.title }), kind: "gold" }) };
      }
      return s;
    }
    case "LOG_TRADE": {
      const gained = Math.round(action.xp * xpMult(state.streak));
      let s = gainXp(state, action.district, gained);
      s = { ...s, log: pushLog(s.log, { k: "log.trade", pk: { a: action.labelKey }, p: { x: gained }, kind: "xp", xp: gained }) };
      s = { ...s, quests: bumpQuests(s.quests, "quick") };
      return s;
    }
    case "AWARD_ACH": {
      /* Tách khỏi LOG_TRADE: thành tựu ghi tên bằng khoá `ach.*` chứ không đi
         qua nhãn thao tác nhanh, và không tính vào nhiệm vụ ngày "quick". */
      let s = gainXp(state, action.district, action.xp);
      s = { ...s, log: pushLog(s.log, { k: "log.ach", pk: { n: `ach.${action.achId}.n` }, p: { x: action.xp }, kind: "ach", xp: action.xp }) };
      return s;
    }
    case "LOG_NETWORTH": {
      const v = Math.max(0, action.value);
      const snapshots = [...state.snapshots, { t: Date.now(), v }].slice(-120);
      let s: State = { ...state, snapshots, quests: bumpQuests(state.quests, "networth") };
      s = gainXp(s, "vault", NETWORTH_XP);
      s = { ...s, log: pushLog(s.log, { k: "log.nw", kind: "milestone" }) };
      return s;
    }
    case "ADD_NOTE":
      return {
        ...state,
        notes: [action.note, ...state.notes].slice(0, 60),
        quests: bumpQuests(state.quests, "note"),
      };
    case "DELETE_NOTE":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "ADD_CUSTOM_ACH":
      return { ...state, customAch: [action.ach, ...state.customAch].slice(0, 30) };
    case "COMPLETE_CUSTOM_ACH": {
      const ach = state.customAch.find((a) => a.id === action.id);
      if (!ach || ach.done) return state;
      const customAch = state.customAch.map((a) => (a.id === action.id ? { ...a, done: true, ts: Date.now() } : a));
      let s: State = { ...state, customAch };
      s = gainXp(s, s.focus, CUSTOM_ACH_XP);
      s = { ...s, log: pushLog(s.log, { k: "log.custom", p: { n: ach.name }, kind: "ach", xp: CUSTOM_ACH_XP }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("toast.ach", { n: ach.name }), sub: `+${CUSTOM_ACH_XP} XP`, kind: "gold" }) };
      return s;
    }
    case "ADD_WATCH":
      if (state.watchlist.includes(action.id)) return state;
      return {
        ...state,
        watchlist: [...state.watchlist, action.id].slice(0, 40),
        quests: bumpQuests(state.quests, "watch"),
      };
    case "REMOVE_WATCH":
      return { ...state, watchlist: state.watchlist.filter((w) => w !== action.id) };
    case "TOGGLE_DECOR":
      return {
        ...state,
        quests: bumpQuests(state.quests, "decor"),
        isleDecor: {
          ...state.isleDecor,
          [action.district]: state.isleDecor[action.district].includes(action.id)
            ? state.isleDecor[action.district].filter((decorId) => decorId !== action.id)
            : [...state.isleDecor[action.district], action.id],
        },
      };
    case "SET_ISLE_THEME":
      return { ...state, isleTheme: { ...state.isleTheme, [action.district]: action.theme } };
    case "CATCH_FISH": {
      const def = FISH_BY_ID.get(action.fishId);
      if (!def) return state;
      const previous = state.fish[action.fishId];
      const record: FishRecord = previous
        ? { n: previous.n + 1, best: Math.max(previous.best, action.weight), first: previous.first }
        : { n: 1, best: action.weight, first: Date.now() };
      /* Giỏ có giới hạn: đầy thì con cũ nhất bị đẩy ra, nhưng bộ sưu tập vẫn giữ. */
      const basket = [...state.basket, { id: action.fishId, w: action.weight, v: action.value, ts: Date.now() }].slice(-120);
      let s: State = {
        ...state,
        fish: { ...state.fish, [action.fishId]: record },
        basket,
        fishCaught: state.fishCaught + 1,
        quests: bumpQuests(state.quests, "fish"),
      };
      const xp = RARITY_META[def.rarity].xp;
      s = gainXp(s, s.focus, xp);
      s = {
        ...s,
        log: pushLog(s.log, {
          k: previous ? "log.fish" : "log.fishNew",
          p: { f: state.lang === "vi" ? def.vi : def.en, w: action.weight, x: xp },
          kind: "quest",
          xp,
        }),
      };
      return s;
    }
    case "SELL_FISH": {
      const sold = state.basket.filter((entry) => entry.id === action.fishId);
      if (!sold.length) return state;
      const coins = sold.reduce((sum, entry) => sum + entry.v, 0);
      const def = FISH_BY_ID.get(action.fishId);
      let s: State = {
        ...state,
        basket: state.basket.filter((entry) => entry.id !== action.fishId),
        coins: state.coins + coins,
        fishEarned: state.fishEarned + coins,
      };
      s = {
        ...s,
        log: pushLog(s.log, {
          k: "log.sell",
          p: { n: sold.length, f: def ? (state.lang === "vi" ? def.vi : def.en) : action.fishId, c: coins },
          kind: "milestone",
        }),
      };
      return s;
    }
    case "SELL_ALL": {
      if (!state.basket.length) return state;
      const coins = state.basket.reduce((sum, entry) => sum + entry.v, 0);
      let s: State = { ...state, basket: [], coins: state.coins + coins, fishEarned: state.fishEarned + coins };
      s = { ...s, log: pushLog(s.log, { k: "log.sellAll", p: { n: state.basket.length, c: coins }, kind: "milestone" }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("fs.sold"), sub: t("fs.soldSub", { c: coins }), kind: "gold" }) };
      return s;
    }
    case "BUY_ITEM": {
      const item = SHOP_BY_ID.get(action.itemId);
      if (!item || state.shop.owned.includes(action.itemId) || state.coins < item.price) return state;
      let s: State = {
        ...state,
        coins: state.coins - item.price,
        shop: { ...state.shop, owned: [...state.shop.owned, action.itemId] },
        quests: bumpQuests(state.quests, "shop"),
      };
      s = { ...s, log: pushLog(s.log, { k: "log.buy", p: { n: state.lang === "vi" ? item.vi : item.en, c: item.price }, kind: "milestone" }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("sp.bought"), sub: state.lang === "vi" ? item.vi : item.en, kind: "jade" }) };
      return s;
    }
    case "TOGGLE_PLACE": {
      const item = SHOP_BY_ID.get(action.itemId);
      if (!item || !state.shop.owned.includes(action.itemId)) return state;
      const current = state.shop.placed[action.slot];
      let next: string[];
      if (current.includes(action.itemId)) {
        next = current.filter((id) => id !== action.itemId);
      } else {
        /* Nền đảo là loại "một chọn một": đặt nền mới thì nền cũ tự nhường chỗ. */
        const cleaned = item.cat === "ground" ? current.filter((id) => SHOP_BY_ID.get(id)?.cat !== "ground") : current;
        if (cleaned.length >= PLACE_LIMIT) return state;
        next = [...cleaned, action.itemId];
      }
      return {
        ...state,
        quests: bumpQuests(state.quests, "decor"),
        shop: { ...state.shop, placed: { ...state.shop.placed, [action.slot]: next } },
      };
    }
    case "READ_NEWS":
      return { ...state, quests: bumpQuests(state.quests, "news") };
    case "SET_LANG":
      return { ...state, lang: action.lang };
    case "SET_CURRENCY":
      return { ...state, currency: action.currency };
    case "RENAME_CITY":
      return { ...state, city: action.name.trim() || state.city };
    case "CLAIM_DAILY": {
      if (state.lastClaim === action.today) return state;
      /* Điểm danh liên tục thì tiến trong chu kỳ; đứt một ngày là quay về mốc đầu. */
      const continued = state.lastClaim === action.yesterday;
      const checkinDay = continued ? (state.checkinDay + 1) % CHECKIN_CYCLE : 0;
      /* `checkinIndex` phải dự đoán ra đúng con số này, nếu không HUD hứa một
         phần thưởng còn reducer trao một phần thưởng khác. */
      const reward = Math.round(checkinReward(checkinDay) * xpMult(state.streak));
      let s: State = { ...state, lastClaim: action.today, claims: state.claims + 1, checkinDay };
      s = gainXp(s, s.focus, reward);
      s = { ...s, log: pushLog(s.log, { k: "log.daily", p: { x: reward }, pk: { d: dLabelKey(s.focus) }, kind: "xp", xp: reward }) };
      s = {
        ...s,
        toasts: withToast(s.toasts, {
          title: t("toast.daily", { n: checkinDay + 1 }),
          sub: t("toast.dailySub", { x: reward, d: dLabel(t, s.focus) }),
          kind: "jade",
        }),
      };
      return s;
    }
    case "CLAIM_QUEST": {
      const def = QUEST_BY_ID.get(action.id);
      if (!def || !questClaimable(state, action.id)) return state;
      const reward = Math.round(def.xp * xpMult(state.streak));
      let s: State = { ...state, quests: { ...state.quests, claimed: [...state.quests.claimed, action.id] } };
      s = gainXp(s, s.focus, reward);
      s = { ...s, log: pushLog(s.log, { k: "log.quest", pk: { q: `quest.${def.id}.n` }, p: { x: reward }, kind: "quest", xp: reward }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("toast.quest"), sub: `${t(`quest.${def.id}.n`)} · +${reward} XP`, kind: "jade" }) };
      return s;
    }
    case "EXAM_RESULT": {
      const attempts = { ...state.examAttempts, [action.district]: state.examAttempts[action.district] + 1 };
      if (!action.passed) return { ...state, examAttempts: attempts };
      const target = pendingExamLevel(state, action.district);
      if (target === null) return { ...state, examAttempts: attempts };
      const certified = { ...state.certified, [action.district]: target };
      const b = dBuilding(t, action.district);
      let s: State = {
        ...state,
        certified,
        examAttempts: attempts,
        examsPassed: state.examsPassed + 1,
        quests: bumpQuests(state.quests, "exam"),
      };
      s = { ...s, log: pushLog(s.log, { k: "log.lvl", pk: { b: dBuildingKey(action.district) }, p: { n: target }, kind: "level" }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("toast.lvl", { b, n: target }), sub: t("toast.lvlSub"), kind: "gold" }) };
      if (action.district === "crypto" && target >= ISLE_UNLOCK_LV && state.certified.crypto < ISLE_UNLOCK_LV) {
        s = { ...s, log: pushLog(s.log, { k: "log.isle", kind: "milestone" }) };
        s = { ...s, toasts: withToast(s.toasts, { title: t("toast.isle"), sub: t("toast.isleSub"), kind: "gold" }) };
      }
      return s;
    }
    case "UPGRADE_YACHT": {
      const available = availableYachtTier(state);
      if (available <= state.yachtTier || state.yachtTier >= MAX_YACHT_TIER) return state;
      const yachtTier = (state.yachtTier + 1) as YachtTier;
      let s: State = { ...state, yachtTier };
      s = { ...s, log: pushLog(s.log, { k: "log.yacht", pk: { n: `yacht.tier${yachtTier}` }, kind: "milestone" }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("toast.yacht"), sub: t(`yacht.tier${yachtTier}`), kind: "gold" }) };
      return s;
    }
    case "SET_WORLD":
      return { ...state, world: { ...state.world, ...action.patch } };
    case "SET_ACCOUNT":
      return { ...state, account: action.account };
    case "ACCEPT_PRIVACY":
      return { ...state, privacyAccepted: true };
    case "HYDRATE":
      return { ...action.state, toasts: state.toasts };
    case "LOG_EVENT": {
      let s: State = { ...state, events: state.events + 1 };
      s = { ...s, log: pushLog(s.log, { k: action.k, p: action.p, kind: "event" }) };
      return s;
    }
    case "MARK_TUTORIAL":
      return { ...state, tutorialSeen: true };
    case "VISIT": {
      const quests = DISTRICT_IDS.includes(action.view as DistrictId) && !state.visits.includes(action.view)
        ? bumpQuests(state.quests, "visit")
        : state.quests;
      if (state.visits.includes(action.view)) return { ...state, quests };
      return { ...state, visits: [...state.visits, action.view], quests };
    }
    case "START_VOYAGE":
      return { ...state, quests: bumpQuests(state.quests, "voyage") };
    case "PUSH_TOAST":
      return { ...state, toasts: withToast(state.toasts, action.toast) };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((x) => x.id !== action.id) };
    case "RESET_ALL":
      return { ...freshState(), lang: state.lang, currency: state.currency, world: state.world };
    default:
      return state;
  }
}

/* ============================== Context ============================== */

export interface StoreApi {
  completeOnboarding(name: string, focus: DistrictId, demo: boolean): void;
  addGoal(g: { title: string; district: DistrictId; target: number; unit: string }): void;
  addTask(district: DistrictId, title: string, xp: number): void;
  toggleTask(id: string): void;
  setGoalProgress(id: string, current: number): void;
  logTrade(district: DistrictId, labelKey: string, xp?: number): void;
  awardAch(district: DistrictId, achId: string, xp: number): void;
  logNetWorth(v: number): void;
  addNote(title: string, body: string): void;
  deleteNote(id: string): void;
  addCustomAch(name: string, desc: string): void;
  completeCustomAch(id: string): void;
  addWatch(id: string): void;
  removeWatch(id: string): void;
  toggleDecor(district: DistrictId, id: string): void;
  setIsleTheme(district: DistrictId, theme: IslandTheme): void;
  catchFish(fishId: string, weight: number, value: number): void;
  sellFish(fishId: string): void;
  sellAll(): void;
  buyItem(itemId: string): void;
  togglePlace(slot: IsleSlot, itemId: string): void;
  readNews(): void;
  setLang(lang: Lang): void;
  setCurrency(c: Currency): void;
  renameCity(name: string): void;
  claimDaily(): void;
  claimQuest(id: string): void;
  submitExam(district: DistrictId, passed: boolean): void;
  upgradeYacht(): void;
  setWorld(patch: Partial<WorldPrefs>): void;
  setAccount(account: AccountInfo | null): void;
  acceptPrivacy(): void;
  hydrate(state: State): void;
  logEvent(k: string, p?: Record<string, string | number>): void;
  markTutorial(): void;
  visit(view: string): void;
  startVoyage(): void;
  pushToast(t: Omit<Toast, "id">): void;
  dismissToast(id: string): void;
  resetAll(): void;
}

const StoreCtx = createContext<{ state: State; api: StoreApi } | null>(null);

const STORAGE_KEY = "vuong-state-v3";
const LEGACY_KEY = "vuong-state-v2";

function pickRecord<T>(source: unknown, fallback: Record<DistrictId, T>, guard: (value: unknown) => value is T): Record<DistrictId, T> {
  const table = source && typeof source === "object" && !Array.isArray(source) ? (source as Partial<Record<DistrictId, unknown>>) : {};
  return Object.fromEntries(
    DISTRICT_IDS.map((district) => {
      const candidate = table[district];
      return [district, guard(candidate) ? candidate : fallback[district]];
    })
  ) as Record<DistrictId, T>;
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Nạp bản lưu và chuẩn hoá về hình dạng hiện hành. Bản v2 cũ được ân xá:
 * mọi cấp đã đạt trước khi có cơ chế khảo thí đều được công nhận luôn.
 */
export function normalizeSave(raw: unknown, legacy: boolean): State | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<State> & Record<string, unknown>;
  if (!parsed.xp) return null;
  const fresh = freshState();

  const xp = pickRecord(parsed.xp, fresh.xp, isNumber);
  const certified = legacy
    ? (Object.fromEntries(DISTRICT_IDS.map((d) => [d, levelFor(xp[d])])) as Record<DistrictId, number>)
    : pickRecord(parsed.certified, fresh.certified, isNumber);
  for (const district of DISTRICT_IDS) {
    certified[district] = Math.max(0, Math.min(levelFor(xp[district]), Math.round(certified[district])));
  }

  const legacyDecor = parsed.isleDecor as unknown;
  const decorSource = legacyDecor && typeof legacyDecor === "object" && !Array.isArray(legacyDecor)
    ? (legacyDecor as Partial<Record<DistrictId, unknown>>)
    : {};
  const isleDecor = Object.fromEntries(
    DISTRICT_IDS.map((district) => {
      const candidate = Array.isArray(legacyDecor) && district === "crypto" ? legacyDecor : decorSource[district];
      return [district, Array.isArray(candidate) ? candidate.filter((id): id is string => typeof id === "string") : []];
    })
  ) as Record<DistrictId, string[]>;

  const validThemes: IslandTheme[] = ["emerald", "sunset", "lagoon", "violet"];
  const isleTheme = pickRecord(parsed.isleTheme, fresh.isleTheme, (value): value is IslandTheme =>
    validThemes.includes(value as IslandTheme)
  );

  const today = dayKey(Date.now());
  const savedQuests = parsed.quests as DailyQuestState | undefined;
  const quests: DailyQuestState =
    savedQuests && savedQuests.day === today && Array.isArray(savedQuests.ids)
      ? {
          day: today,
          ids: savedQuests.ids.filter((id) => QUEST_BY_ID.has(id)),
          progress: savedQuests.progress ?? {},
          claimed: Array.isArray(savedQuests.claimed) ? savedQuests.claimed : [],
        }
      : emptyQuests(today);

  /* --- câu cá: bản lưu cũ không có ba trường này, và loài đã bị gỡ khỏi danh
     mục thì bỏ luôn thay vì để bộ sưu tập hiện ô trống không tên. --- */
  const savedFish = parsed.fish && typeof parsed.fish === "object" ? (parsed.fish as Record<string, unknown>) : {};
  const fish: Record<string, FishRecord> = {};
  for (const [id, value] of Object.entries(savedFish)) {
    if (!FISH_BY_ID.has(id) || !value || typeof value !== "object") continue;
    const row = value as Partial<FishRecord>;
    fish[id] = {
      n: isNumber(row.n) ? Math.max(0, Math.round(row.n)) : 0,
      best: isNumber(row.best) ? Math.max(0, row.best) : 0,
      first: isNumber(row.first) ? row.first : Date.now(),
    };
  }
  const basket = Array.isArray(parsed.basket)
    ? (parsed.basket as CatchEntry[])
        .filter((entry) => entry && FISH_BY_ID.has(entry.id) && isNumber(entry.w) && isNumber(entry.v))
        .slice(-120)
    : [];

  const savedShop = parsed.shop && typeof parsed.shop === "object" ? (parsed.shop as Partial<ShopState>) : {};
  const owned = Array.isArray(savedShop.owned)
    ? savedShop.owned.filter((id): id is string => typeof id === "string" && SHOP_BY_ID.has(id))
    : [];
  const placedSource = savedShop.placed && typeof savedShop.placed === "object" ? savedShop.placed : {};
  const placed = Object.fromEntries(
    ISLE_SLOTS.map((slot) => {
      const list = (placedSource as Partial<Record<IsleSlot, unknown>>)[slot];
      const clean = Array.isArray(list)
        ? list.filter((id): id is string => typeof id === "string" && SHOP_BY_ID.has(id) && owned.includes(id))
        : [];
      return [slot, clean.slice(0, PLACE_LIMIT)];
    })
  ) as Record<IsleSlot, string[]>;
  const shop: ShopState = { owned: [...new Set([...FREE_ITEMS, ...owned])], placed };

  const world: WorldPrefs = { ...fresh.world, ...(parsed.world as Partial<WorldPrefs> | undefined) };
  const rawTier = Math.round(Number(parsed.yachtTier ?? 1));
  const yachtTier = (Number.isFinite(rawTier) ? Math.max(1, Math.min(MAX_YACHT_TIER, rawTier)) : 1) as YachtTier;

  return {
    ...fresh,
    ...parsed,
    xp,
    certified,
    examAttempts: pickRecord(parsed.examAttempts, fresh.examAttempts, isNumber),
    examsPassed: isNumber(parsed.examsPassed) ? parsed.examsPassed : 0,
    checkinDay: isNumber(parsed.checkinDay) ? Math.max(0, Math.min(CHECKIN_CYCLE - 1, parsed.checkinDay)) : 0,
    quests,
    isleDecor,
    isleTheme,
    coins: isNumber(parsed.coins) ? Math.max(0, Math.round(parsed.coins)) : 0,
    fish,
    basket,
    fishCaught: isNumber(parsed.fishCaught) ? Math.max(0, Math.round(parsed.fishCaught)) : 0,
    fishEarned: isNumber(parsed.fishEarned) ? Math.max(0, Math.round(parsed.fishEarned)) : 0,
    shop,
    yachtTier,
    world,
    account: (parsed.account as AccountInfo | null | undefined) ?? null,
    privacyAccepted: parsed.privacyAccepted === true,
    toasts: [],
  };
}

function loadInitial(): State {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const restored = normalizeSave(JSON.parse(current), false);
      if (restored) return restored;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = normalizeSave(JSON.parse(legacy), true);
      if (migrated) return migrated;
    }
  } catch {
    /* Bản lưu hỏng thì bắt đầu lại chứ không để màn hình trắng. */
  }
  return freshState();
}

/** Payload đồng bộ lên đám mây — bỏ toast vì đó là trạng thái tức thời. */
export function serializeSave(state: State): Omit<State, "toasts"> {
  const { toasts: _toasts, ...rest } = state;
  return rest;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSave(state)));
    } catch {
      /* Hết dung lượng hoặc chế độ riêng tư: bỏ qua, phiên vẫn chạy bình thường. */
    }
  }, [state]);

  useEffect(() => {
    const roll = () => {
      const now = Date.now();
      dispatch({ type: "INIT_DAY", today: dayKey(now), yesterday: dayKey(now - 86400000) });
    };
    roll();
    /* Kiểm tra mỗi phút để phiên mở qua nửa đêm vẫn nhận nhiệm vụ ngày mới. */
    const timer = window.setInterval(roll, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      completeOnboarding: (name, focus, demo) => dispatch({ type: "COMPLETE_ONBOARDING", name, focus, demo }),
      addGoal: (g) =>
        dispatch({
          type: "ADD_GOAL",
          goal: { id: uid(), district: g.district, title: g.title, target: g.target, current: 0, unit: g.unit, done: false, ts: Date.now() },
        }),
      addTask: (district, title, xp) =>
        dispatch({ type: "ADD_TASK", task: { id: uid(), district, title, xp: Math.max(5, Math.min(100, xp)), done: false, ts: Date.now() } }),
      toggleTask: (id) => dispatch({ type: "TOGGLE_TASK", id }),
      setGoalProgress: (id, current) => dispatch({ type: "SET_GOAL_PROGRESS", id, current }),
      logTrade: (district, labelKey, xp = TRADE_XP) => dispatch({ type: "LOG_TRADE", district, labelKey, xp }),
      awardAch: (district, achId, xp) => dispatch({ type: "AWARD_ACH", district, achId, xp }),
      logNetWorth: (v) => dispatch({ type: "LOG_NETWORTH", value: v }),
      addNote: (title, body) => dispatch({ type: "ADD_NOTE", note: { id: uid(), title, body, ts: Date.now() } }),
      deleteNote: (id) => dispatch({ type: "DELETE_NOTE", id }),
      addCustomAch: (name, desc) => dispatch({ type: "ADD_CUSTOM_ACH", ach: { id: uid(), name, desc, done: false, ts: Date.now() } }),
      completeCustomAch: (id) => dispatch({ type: "COMPLETE_CUSTOM_ACH", id }),
      addWatch: (id) => dispatch({ type: "ADD_WATCH", id }),
      removeWatch: (id) => dispatch({ type: "REMOVE_WATCH", id }),
      toggleDecor: (district, id) => dispatch({ type: "TOGGLE_DECOR", district, id }),
      setIsleTheme: (district, theme) => dispatch({ type: "SET_ISLE_THEME", district, theme }),
      catchFish: (fishId, weight, value) => dispatch({ type: "CATCH_FISH", fishId, weight, value }),
      sellFish: (fishId) => dispatch({ type: "SELL_FISH", fishId }),
      sellAll: () => dispatch({ type: "SELL_ALL" }),
      buyItem: (itemId) => dispatch({ type: "BUY_ITEM", itemId }),
      togglePlace: (slot, itemId) => dispatch({ type: "TOGGLE_PLACE", slot, itemId }),
      readNews: () => dispatch({ type: "READ_NEWS" }),
      setLang: (lang) => dispatch({ type: "SET_LANG", lang }),
      setCurrency: (currency) => dispatch({ type: "SET_CURRENCY", currency }),
      renameCity: (name) => dispatch({ type: "RENAME_CITY", name }),
      claimDaily: () => {
        const now = Date.now();
        dispatch({ type: "CLAIM_DAILY", today: dayKey(now), yesterday: dayKey(now - 86400000) });
      },
      claimQuest: (id) => dispatch({ type: "CLAIM_QUEST", id }),
      submitExam: (district, passed) => dispatch({ type: "EXAM_RESULT", district, passed }),
      upgradeYacht: () => dispatch({ type: "UPGRADE_YACHT" }),
      setWorld: (patch) => dispatch({ type: "SET_WORLD", patch }),
      setAccount: (account) => dispatch({ type: "SET_ACCOUNT", account }),
      acceptPrivacy: () => dispatch({ type: "ACCEPT_PRIVACY" }),
      hydrate: (next) => dispatch({ type: "HYDRATE", state: next }),
      logEvent: (k, p) => dispatch({ type: "LOG_EVENT", k, p }),
      markTutorial: () => dispatch({ type: "MARK_TUTORIAL" }),
      visit: (view) => dispatch({ type: "VISIT", view }),
      startVoyage: () => dispatch({ type: "START_VOYAGE" }),
      pushToast: (toast) => dispatch({ type: "PUSH_TOAST", toast: { ...toast, id: uid() } }),
      dismissToast: (id) => dispatch({ type: "DISMISS_TOAST", id }),
      resetAll: () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_KEY);
        dispatch({ type: "RESET_ALL" });
      },
    }),
    []
  );

  return <StoreCtx.Provider value={{ state, api }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/** Cấp có hiệu lực của từng lĩnh vực — đã tính cả cơ chế khảo thí. */
export function districtLevels(state: State): Record<DistrictId, number> {
  const out = {} as Record<DistrictId, number>;
  for (const d of DISTRICT_IDS) out[d] = state.certified[d];
  return out;
}

export function cityLevel(state: State): number {
  const total = DISTRICT_IDS.reduce((s, d) => s + state.xp[d], 0);
  return Math.max(1, Math.floor(total / 400) + 1);
}

export function netWorth(state: State): number | null {
  return state.snapshots.length ? state.snapshots[state.snapshots.length - 1].v : null;
}
