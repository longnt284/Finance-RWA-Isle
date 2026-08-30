import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { dayKey, uid } from "../lib/format";
import type { Currency } from "../lib/format";
import { makeT } from "../lib/i18n";
import type { Lang, TFn } from "../lib/i18n";
import { DEFAULT_WATCH } from "../lib/market";

/* ============================== Types ============================== */

export type DistrictId = "crypto" | "stocks" | "vault" | "academy";
export type ViewId = DistrictId | "center" | "overview" | "isle";

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

export type LogKind = "xp" | "level" | "goal" | "milestone" | "system" | "event" | "ach";

export interface LogEntry {
  id: string;
  ts: number;
  text: string;
  kind: LogKind;
  xp?: number;
}

export interface Toast {
  id: string;
  title: string;
  sub?: string;
  kind: "gold" | "jade" | "info";
}

export interface State {
  city: string;
  focus: DistrictId;
  onboarded: boolean;
  lang: Lang;
  currency: Currency;
  xp: Record<DistrictId, number>;
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
  events: number;
  totalTasksDone: number;
  visits: string[];
  watchlist: string[];
  isleDecor: Record<DistrictId, string[]>;
  isleTheme: Record<DistrictId, IslandTheme>;
  tutorialSeen: boolean;
  toasts: Toast[];
}

/* ============================== Meta ============================== */

export const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

export const DISTRICTS: Record<DistrictId, { accent: string }> = {
  crypto: { accent: "#5ce8c4" },
  stocks: { accent: "#f0c268" },
  vault: { accent: "#ffd88a" },
  academy: { accent: "#9fd0ff" },
};

export function dLabel(t: TFn, d: DistrictId): string {
  return t(`d.${d}.name`);
}
export function dBuilding(t: TFn, d: DistrictId): string {
  return t(`d.${d}.building`);
}

/* Cấp 0 → 10. Kiến trúc hiển thị tối đa bậc 5, cấp số vẫn tăng tiếp. */
export const LEVEL_XP = [0, 60, 200, 450, 850, 1450, 2300, 3500, 5000, 7000, 9500];
export const MAX_LEVEL = 10;
export const VISUAL_MAX = 5;
export const ISLE_UNLOCK_LV = 8;
export const ISLE_UNLOCK_LEVELS: Record<DistrictId, number> = {
  crypto: ISLE_UNLOCK_LV,
  stocks: 7,
  vault: 6,
  academy: 5,
};
export const DAILY_XP = 30;
export type IslandTheme = "emerald" | "sunset" | "lagoon" | "violet";

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
  { id: "a7", tier: "mid", reward: 70, done: (s) => DISTRICT_IDS.filter((d) => levelFor(s.xp[d]) >= 3).length >= 2 },
  { id: "a8", tier: "hard", reward: 150, done: (s) => levelFor(s.xp.crypto) >= 5 },
  { id: "a9", tier: "hard", reward: 150, done: (s) => (s.snapshots.length ? s.snapshots[s.snapshots.length - 1].v >= 5e8 : false) },
  { id: "a10", tier: "hard", reward: 120, done: (s) => s.streak >= 7 },
  { id: "a11", tier: "hard", reward: 250, done: (s) => levelFor(s.xp.crypto) >= ISLE_UNLOCK_LV },
  { id: "a12", tier: "hard", reward: 150, done: (s) => levelFor(s.xp.academy) >= 5 },
  { id: "a13", tier: "hard", reward: 200, done: (s) => DISTRICT_IDS.reduce((sum, d) => sum + s.xp[d], 0) >= 3000 },
  { id: "a14", tier: "mid", reward: 50, done: (s) => s.events >= 5 },
];

/* ============================== Actions ============================== */

type Action =
  | { type: "INIT_STREAK"; today: string; yesterday: string }
  | { type: "COMPLETE_ONBOARDING"; name: string; focus: DistrictId; demo: boolean }
  | { type: "ADD_GOAL"; goal: Goal }
  | { type: "ADD_TASK"; task: Task }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "SET_GOAL_PROGRESS"; id: string; current: number }
  | { type: "LOG_TRADE"; district: DistrictId; label: string; xp: number }
  | { type: "LOG_NETWORTH"; value: number }
  | { type: "ADD_NOTE"; note: Note }
  | { type: "DELETE_NOTE"; id: string }
  | { type: "ADD_CUSTOM_ACH"; ach: CustomAch }
  | { type: "COMPLETE_CUSTOM_ACH"; id: string }
  | { type: "ADD_WATCH"; id: string }
  | { type: "REMOVE_WATCH"; id: string }
  | { type: "TOGGLE_DECOR"; district: DistrictId; id: string }
  | { type: "SET_ISLE_THEME"; district: DistrictId; theme: IslandTheme }
  | { type: "SET_LANG"; lang: Lang }
  | { type: "SET_CURRENCY"; currency: Currency }
  | { type: "RENAME_CITY"; name: string }
  | { type: "CLAIM_DAILY"; today: string }
  | { type: "LOG_EVENT"; text: string }
  | { type: "MARK_TUTORIAL" }
  | { type: "VISIT"; view: string }
  | { type: "PUSH_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "RESET_ALL" };

const TRADE_XP = 18;
const NETWORTH_XP = 8;
const GOAL_BONUS_XP = 120;
const CUSTOM_ACH_XP = 50;

function pushLog(log: LogEntry[], entry: Omit<LogEntry, "id" | "ts">): LogEntry[] {
  return [{ id: uid(), ts: Date.now(), ...entry }, ...log].slice(0, 50);
}

function withToast(toasts: Toast[], t: Omit<Toast, "id">): Toast[] {
  return [...toasts, { id: uid(), ...t }].slice(-4);
}

function gainXp(state: State, district: DistrictId, amount: number): State {
  const t = makeT(state.lang);
  const before = levelFor(state.xp[district]);
  const xp = { ...state.xp, [district]: Math.max(0, state.xp[district] + amount) };
  const after = levelFor(xp[district]);
  let log = state.log;
  let toasts = state.toasts;
  if (after > before) {
    const b = dBuilding(t, district);
    log = pushLog(log, { text: t("log.lvl", { b, n: after }), kind: "level" });
    toasts = withToast(toasts, { title: t("toast.lvl", { b, n: after }), sub: t("toast.lvlSub"), kind: "gold" });
    if (district === "crypto" && before < ISLE_UNLOCK_LV && after >= ISLE_UNLOCK_LV) {
      log = pushLog(log, { text: t("log.isle"), kind: "milestone" });
      toasts = withToast(toasts, { title: t("toast.isle"), sub: t("toast.isleSub"), kind: "gold" });
    }
  }
  return { ...state, xp, log, toasts };
}

/* ============================== Seeds ============================== */

function emptyXp(): Record<DistrictId, number> {
  return { crypto: 0, stocks: 0, vault: 0, academy: 0 };
}

function emptyIsleDecor(): Record<DistrictId, string[]> {
  return { crypto: [], stocks: [], vault: [], academy: [] };
}

function defaultIsleThemes(): Record<DistrictId, IslandTheme> {
  return { crypto: "emerald", stocks: "sunset", vault: "lagoon", academy: "violet" };
}

export function freshState(): State {
  return {
    city: "",
    focus: "crypto",
    onboarded: false,
    lang: "vi",
    currency: "VND",
    xp: emptyXp(),
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
    events: 0,
    totalTasksDone: 0,
    visits: [],
    watchlist: [...DEFAULT_WATCH],
    isleDecor: emptyIsleDecor(),
    isleTheme: defaultIsleThemes(),
    tutorialSeen: false,
    toasts: [],
  };
}

function seedOnboarded(state: State, name: string, focus: DistrictId): State {
  const t = makeT(state.lang);
  const now = Date.now();
  const city = name.trim() || (state.lang === "vi" ? "Đảo Thịnh Vượng" : "Prosperity Isle");
  const first =
    state.lang === "vi" ? "Đặt nền móng đầu tiên" : "Lay the first foundation";
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
    log: pushLog([], { text: t("log.founded", { c: city, d: dLabel(t, focus) }), kind: "system" }),
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
  let s: State = {
    ...freshState(),
    lang,
    city: vi ? "Tân Vượng Đảo" : "New Prosperity Isle",
    focus: "crypto",
    onboarded: true,
    lastVisit: dayKey(now),
    lastClaim: dayKey(now),
    claims: 6,
    events: 5,
    streak: 6,
    totalTasksDone: 9,
    visits: ["crypto", "stocks", "vault"],
    xp: { crypto: 5650, stocks: 3500, vault: 2300, academy: 1450 },
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
    log: pushLog([], { text: t("log.demo"), kind: "system" }),
    toasts: [{ id: uid(), title: t("toast.welcome"), sub: t("toast.welcomeSub"), kind: "info" }],
  };
  s.log = pushLog(s.log, { text: t("log.isle"), kind: "milestone" });
  s.log = pushLog(s.log, { text: t("log.lvl", { b: dBuilding(t, "stocks"), n: 2 }), kind: "level" });
  return s;
}

/* ============================== Reducer ============================== */

function reducer(state: State, action: Action): State {
  const t = makeT(state.lang);
  switch (action.type) {
    case "INIT_STREAK": {
      if (state.lastVisit === action.today || !state.onboarded) return state;
      const cont = state.lastVisit === action.yesterday;
      const streak = cont ? state.streak + 1 : 1;
      let s: State = { ...state, streak, lastVisit: action.today };
      s = { ...s, log: pushLog(s.log, { text: t("log.streak", { n: streak }), kind: "system" }) };
      if (cont) {
        s = gainXp(s, state.focus, 20);
        s = { ...s, log: pushLog(s.log, { text: t("log.streakXp", { x: 20, d: dLabel(t, state.focus) }), kind: "xp", xp: 20 }) };
        s = { ...s, toasts: withToast(s.toasts, { title: t("toast.streak", { n: streak }), sub: t("toast.streakSub"), kind: "jade" }) };
      }
      return s;
    }
    case "COMPLETE_ONBOARDING":
      return action.demo ? demoState(state.lang) : seedOnboarded(state, action.name, action.focus);
    case "ADD_GOAL": {
      const s = { ...state, goals: [action.goal, ...state.goals] };
      return { ...s, log: pushLog(s.log, { text: t("log.goalNew", { t: action.goal.title, d: dLabel(t, action.goal.district) }), kind: "system" }) };
    }
    case "ADD_TASK": {
      const s = { ...state, tasks: [action.task, ...state.tasks] };
      return { ...s, log: pushLog(s.log, { text: t("log.taskNew", { t: action.task.title }), kind: "system" }) };
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
        s = { ...s, log: pushLog(s.log, { text: t("log.taskDone", { t: task.title, x: gained }), kind: "xp", xp: gained }) };
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
      let s: State = { ...state, goals };
      if (justDone) {
        s = gainXp(s, goal.district, GOAL_BONUS_XP);
        s = { ...s, log: pushLog(s.log, { text: `${t("toast.goal")} ${goal.title} (+${GOAL_BONUS_XP} XP)`, kind: "goal", xp: GOAL_BONUS_XP }) };
        s = { ...s, toasts: withToast(s.toasts, { title: t("toast.goal"), sub: t("toast.goalSub", { t: goal.title }), kind: "gold" }) };
      }
      return s;
    }
    case "LOG_TRADE": {
      const mult = xpMult(state.streak);
      const gained = Math.round(action.xp * mult);
      let s = gainXp(state, action.district, gained);
      s = { ...s, log: pushLog(s.log, { text: `${action.label} (+${gained} XP)`, kind: "xp", xp: gained }) };
      return s;
    }
    case "LOG_NETWORTH": {
      const v = Math.max(0, action.value);
      const snapshots = [...state.snapshots, { t: Date.now(), v }].slice(-120);
      let s: State = { ...state, snapshots };
      s = gainXp(s, "vault", NETWORTH_XP);
      s = { ...s, log: pushLog(s.log, { text: t("log.nw"), kind: "milestone" }) };
      return s;
    }
    case "ADD_NOTE":
      return { ...state, notes: [action.note, ...state.notes].slice(0, 60) };
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
      s = { ...s, log: pushLog(s.log, { text: t("log.custom", { n: ach.name }), kind: "ach", xp: CUSTOM_ACH_XP }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("toast.ach", { n: ach.name }), sub: `+${CUSTOM_ACH_XP} XP`, kind: "gold" }) };
      return s;
    }
    case "ADD_WATCH":
      if (state.watchlist.includes(action.id)) return state;
      return { ...state, watchlist: [...state.watchlist, action.id].slice(0, 24) };
    case "REMOVE_WATCH":
      return { ...state, watchlist: state.watchlist.filter((w) => w !== action.id) };
    case "TOGGLE_DECOR":
      return {
        ...state,
        isleDecor: {
          ...state.isleDecor,
          [action.district]: state.isleDecor[action.district].includes(action.id)
            ? state.isleDecor[action.district].filter((decorId) => decorId !== action.id)
            : [...state.isleDecor[action.district], action.id],
        },
      };
    case "SET_ISLE_THEME":
      return { ...state, isleTheme: { ...state.isleTheme, [action.district]: action.theme } };
    case "SET_LANG":
      return { ...state, lang: action.lang };
    case "SET_CURRENCY":
      return { ...state, currency: action.currency };
    case "RENAME_CITY":
      return { ...state, city: action.name.trim() || state.city };
    case "CLAIM_DAILY": {
      if (state.lastClaim === action.today) return state;
      let s: State = { ...state, lastClaim: action.today, claims: state.claims + 1 };
      s = gainXp(s, s.focus, DAILY_XP);
      s = { ...s, log: pushLog(s.log, { text: t("log.daily", { d: dLabel(t, s.focus) }), kind: "xp", xp: DAILY_XP }) };
      s = { ...s, toasts: withToast(s.toasts, { title: t("toast.daily"), sub: t("toast.dailySub", { d: dLabel(t, s.focus) }), kind: "jade" }) };
      return s;
    }
    case "LOG_EVENT": {
      let s: State = { ...state, events: state.events + 1 };
      s = { ...s, log: pushLog(s.log, { text: action.text, kind: "event" }) };
      return s;
    }
    case "MARK_TUTORIAL":
      return { ...state, tutorialSeen: true };
    case "VISIT": {
      if (state.visits.includes(action.view)) return state;
      return { ...state, visits: [...state.visits, action.view] };
    }
    case "PUSH_TOAST":
      return { ...state, toasts: withToast(state.toasts, action.toast) };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((x) => x.id !== action.id) };
    case "RESET_ALL":
      return { ...freshState(), lang: state.lang, currency: state.currency };
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
  logTrade(district: DistrictId, label: string, xp?: number): void;
  logNetWorth(v: number): void;
  addNote(title: string, body: string): void;
  deleteNote(id: string): void;
  addCustomAch(name: string, desc: string): void;
  completeCustomAch(id: string): void;
  addWatch(id: string): void;
  removeWatch(id: string): void;
  toggleDecor(district: DistrictId, id: string): void;
  setIsleTheme(district: DistrictId, theme: IslandTheme): void;
  setLang(lang: Lang): void;
  setCurrency(c: Currency): void;
  renameCity(name: string): void;
  claimDaily(): void;
  logEvent(text: string): void;
  markTutorial(): void;
  visit(view: string): void;
  pushToast(t: Omit<Toast, "id">): void;
  dismissToast(id: string): void;
  resetAll(): void;
}

const StoreCtx = createContext<{ state: State; api: StoreApi } | null>(null);

const STORAGE_KEY = "vuong-state-v2";

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<State> & { isleDecor?: unknown; isleTheme?: unknown };
    if (!parsed || typeof parsed !== "object" || !parsed.xp) return freshState();
    const fresh = freshState();
    const legacyDecor = parsed.isleDecor;
    const decorSource = legacyDecor && typeof legacyDecor === "object" && !Array.isArray(legacyDecor)
      ? (legacyDecor as Partial<Record<DistrictId, unknown>>)
      : {};
    const isleDecor = Object.fromEntries(
      DISTRICT_IDS.map((district) => {
        const candidate = Array.isArray(legacyDecor) && district === "crypto" ? legacyDecor : decorSource[district];
        return [district, Array.isArray(candidate) ? candidate.filter((id): id is string => typeof id === "string") : []];
      })
    ) as Record<DistrictId, string[]>;
    const themeSource = parsed.isleTheme && typeof parsed.isleTheme === "object"
      ? (parsed.isleTheme as Partial<Record<DistrictId, unknown>>)
      : {};
    const validThemes: IslandTheme[] = ["emerald", "sunset", "lagoon", "violet"];
    const isleTheme = Object.fromEntries(
      DISTRICT_IDS.map((district) => {
        const candidate = themeSource[district];
        return [district, validThemes.includes(candidate as IslandTheme) ? candidate : fresh.isleTheme[district]];
      })
    ) as Record<DistrictId, IslandTheme>;
    return { ...fresh, ...parsed, isleDecor, isleTheme, toasts: [] };
  } catch {
    return freshState();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    const { toasts: _t, ...persist } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    const now = Date.now();
    dispatch({ type: "INIT_STREAK", today: dayKey(now), yesterday: dayKey(now - 86400000) });
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
      logTrade: (district, label, xp = TRADE_XP) => dispatch({ type: "LOG_TRADE", district, label, xp }),
      logNetWorth: (v) => dispatch({ type: "LOG_NETWORTH", value: v }),
      addNote: (title, body) => dispatch({ type: "ADD_NOTE", note: { id: uid(), title, body, ts: Date.now() } }),
      deleteNote: (id) => dispatch({ type: "DELETE_NOTE", id }),
      addCustomAch: (name, desc) => dispatch({ type: "ADD_CUSTOM_ACH", ach: { id: uid(), name, desc, done: false, ts: Date.now() } }),
      completeCustomAch: (id) => dispatch({ type: "COMPLETE_CUSTOM_ACH", id }),
      addWatch: (id) => dispatch({ type: "ADD_WATCH", id }),
      removeWatch: (id) => dispatch({ type: "REMOVE_WATCH", id }),
      toggleDecor: (district, id) => dispatch({ type: "TOGGLE_DECOR", district, id }),
      setIsleTheme: (district, theme) => dispatch({ type: "SET_ISLE_THEME", district, theme }),
      setLang: (lang) => dispatch({ type: "SET_LANG", lang }),
      setCurrency: (currency) => dispatch({ type: "SET_CURRENCY", currency }),
      renameCity: (name) => dispatch({ type: "RENAME_CITY", name }),
      claimDaily: () => dispatch({ type: "CLAIM_DAILY", today: dayKey(Date.now()) }),
      logEvent: (text) => dispatch({ type: "LOG_EVENT", text }),
      markTutorial: () => dispatch({ type: "MARK_TUTORIAL" }),
      visit: (view) => dispatch({ type: "VISIT", view }),
      pushToast: (toast) => dispatch({ type: "PUSH_TOAST", toast: { ...toast, id: uid() } }),
      dismissToast: (id) => dispatch({ type: "DISMISS_TOAST", id }),
      resetAll: () => {
        localStorage.removeItem(STORAGE_KEY);
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

export function districtLevels(state: State): Record<DistrictId, number> {
  const out = {} as Record<DistrictId, number>;
  for (const d of DISTRICT_IDS) out[d] = levelFor(state.xp[d]);
  return out;
}

export function cityLevel(state: State): number {
  const total = DISTRICT_IDS.reduce((s, d) => s + state.xp[d], 0);
  return Math.max(1, Math.floor(total / 400) + 1);
}

export function netWorth(state: State): number | null {
  return state.snapshots.length ? state.snapshots[state.snapshots.length - 1].v : null;
}
