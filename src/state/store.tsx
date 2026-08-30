import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { dayKey, uid } from "../lib/format";

/* ============================== Types ============================== */

export type DistrictId = "crypto" | "stocks" | "vault" | "academy";
export type ViewId = DistrictId | "center" | "overview";

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
}

export interface Snapshot {
  t: number;
  v: number;
}

export interface LogEntry {
  id: string;
  ts: number;
  text: string;
  kind: "xp" | "level" | "goal" | "milestone" | "system";
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
  xp: Record<DistrictId, number>;
  goals: Goal[];
  tasks: Task[];
  snapshots: Snapshot[];
  log: LogEntry[];
  streak: number;
  lastVisit: string;
  totalTasksDone: number;
  toasts: Toast[];
}

/* ============================== Meta ============================== */

export const DISTRICTS: Record<
  DistrictId,
  { label: string; building: string; tagline: string; accent: string }
> = {
  crypto: {
    label: "Quận Crypto",
    building: "Tháp Genesis",
    tagline: "BTC · ETH · DeFi · on-chain",
    accent: "#5ce8c4",
  },
  stocks: {
    label: "Quận Chứng khoán",
    building: "Sàn Hưng Thịnh",
    tagline: "Cổ phiếu · VNIndex · cổ tức",
    accent: "#f0c268",
  },
  vault: {
    label: "Kim Khố",
    building: "Kim Khố Trung Tâm",
    tagline: "Tiết kiệm · quỹ khẩn cấp",
    accent: "#ffd88a",
  },
  academy: {
    label: "Học Viện",
    building: "Học Viện Khai Sáng",
    tagline: "Học tập · nghiên cứu · journal",
    accent: "#9fd0ff",
  },
};

export const LEVEL_XP = [0, 60, 200, 450, 850, 1450];
export const MAX_LEVEL = 5;

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

/* ============================== Actions ============================== */

type Action =
  | { type: "INIT_STREAK"; today: string; yesterday: string }
  | { type: "COMPLETE_ONBOARDING"; name: string; focus: DistrictId; demo: boolean }
  | { type: "ADD_GOAL"; goal: Goal }
  | { type: "ADD_TASK"; task: Task }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "SET_GOAL_PROGRESS"; id: string; current: number }
  | { type: "LOG_TRADE"; district: DistrictId; text: string }
  | { type: "LOG_NETWORTH"; value: number }
  | { type: "RENAME_CITY"; name: string }
  | { type: "PUSH_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "RESET_ALL" };

const TRADE_XP = 18;
const NETWORTH_XP = 8;
const GOAL_BONUS_XP = 120;
const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

function pushLog(log: LogEntry[], entry: Omit<LogEntry, "id" | "ts">): LogEntry[] {
  return [{ id: uid(), ts: Date.now(), ...entry }, ...log].slice(0, 40);
}

function withToast(toasts: Toast[], t: Omit<Toast, "id">): Toast[] {
  return [...toasts, { id: uid(), ...t }].slice(-4);
}

function gainXp(state: State, district: DistrictId, amount: number): State {
  const before = levelFor(state.xp[district]);
  const xp = { ...state.xp, [district]: Math.max(0, state.xp[district] + amount) };
  const after = levelFor(xp[district]);
  let log = state.log;
  let toasts = state.toasts;
  if (after > before) {
    const meta = DISTRICTS[district];
    log = pushLog(log, {
      text: `${meta.building} thăng cấp → Cấp ${after}`,
      kind: "level",
    });
    toasts = withToast(toasts, {
      title: `${meta.building} đạt Cấp ${after}`,
      sub: "Công trình đang được nâng cấp trong thế giới",
      kind: "gold",
    });
  }
  return { ...state, xp, log, toasts };
}

/* ============================== Seeds ============================== */

function emptyXp(): Record<DistrictId, number> {
  return { crypto: 0, stocks: 0, vault: 0, academy: 0 };
}

export function freshState(): State {
  return {
    city: "Đảo Vượng",
    focus: "crypto",
    onboarded: false,
    xp: emptyXp(),
    goals: [],
    tasks: [],
    snapshots: [],
    log: [],
    streak: 0,
    lastVisit: "",
    totalTasksDone: 0,
    toasts: [],
  };
}

function seedOnboarded(state: State, name: string, focus: DistrictId): State {
  const t = Date.now();
  const meta = DISTRICTS[focus];
  let s: State = {
    ...state,
    city: name.trim() || "Đảo Vượng",
    focus,
    onboarded: true,
    lastVisit: dayKey(t),
    streak: 1,
    tasks: [
      { id: uid(), district: focus, title: "Đặt nền móng đầu tiên", xp: 60, done: true, ts: t },
    ],
    goals: [],
    log: pushLog([], { text: `${name || "Đảo Vượng"} được khai mở — tập trung vào ${meta.label}`, kind: "system" }),
    toasts: withToast([], { title: "Chào mừng đến đảo của bạn", sub: "Nhấn vào công trình để bắt đầu xây dựng", kind: "info" }),
  };
  s = { ...s, totalTasksDone: 1 };
  s = gainXp(s, focus, 60);
  return s;
}

function demoState(): State {
  const t = Date.now();
  const D = 86400000;
  let s: State = {
    ...freshState(),
    city: "Tân Vượng Đảo",
    focus: "crypto",
    onboarded: true,
    lastVisit: dayKey(t),
    streak: 6,
    totalTasksDone: 9,
    xp: { crypto: 660, stocks: 335, vault: 285, academy: 145 },
    goals: [
      { id: uid(), district: "crypto", title: "Tích lũy 0,5 BTC", target: 0.5, current: 0.32, unit: "BTC", done: false, ts: t - 40 * D },
      { id: uid(), district: "crypto", title: "Quỹ ổn định 100 triệu (stablecoin)", target: 100, current: 62, unit: "tr ₫", done: false, ts: t - 25 * D },
      { id: uid(), district: "stocks", title: "Danh mục cổ tức 200 triệu", target: 200, current: 86, unit: "tr ₫", done: false, ts: t - 60 * D },
      { id: uid(), district: "vault", title: "Sổ tiết kiệm mua nhà 500 triệu", target: 500, current: 224, unit: "tr ₫", done: false, ts: t - 90 * D },
      { id: uid(), district: "academy", title: "Khóa Phân tích kỹ thuật nâng cao", target: 24, current: 24, unit: "buổi", done: true, ts: t - 12 * D },
    ],
    tasks: [
      { id: uid(), district: "crypto", title: "Thiết lập DCA BTC 2 triệu/tuần", xp: 40, done: true, ts: t - 30 * D },
      { id: uid(), district: "crypto", title: "Nghiên cứu ETH staking & LRT", xp: 30, done: true, ts: t - 18 * D },
      { id: uid(), district: "crypto", title: "Backtest chiến lược 2021–2024", xp: 35, done: false, ts: t - 6 * D },
      { id: uid(), district: "crypto", title: "Chuyển 20% danh mục sang stablecoin", xp: 25, done: false, ts: t - 3 * D },
      { id: uid(), district: "stocks", title: "Đọc hết 'Nhà đầu tư thông minh'", xp: 40, done: true, ts: t - 22 * D },
      { id: uid(), district: "stocks", title: "DCA VN30 mỗi tháng", xp: 30, done: false, ts: t - 2 * D },
      { id: uid(), district: "stocks", title: "Rà soát báo cáo tài chính FPT, REE", xp: 30, done: false, ts: t - 1 * D },
      { id: uid(), district: "vault", title: "Tự động trích 15% lương vào tiết kiệm", xp: 35, done: true, ts: t - 45 * D },
      { id: uid(), district: "academy", title: "Viết nhật ký giao dịch 30 ngày", xp: 40, done: false, ts: t - 4 * D },
    ],
    snapshots: Array.from({ length: 16 }, (_, i) => ({
      t: t - (15 - i) * 4 * D,
      v: 388e6 + i * 9.1e6 + Math.sin(i * 1.7) * 11e6,
    })),
    log: pushLog([], { text: "Tân Vượng Đảo được khai mở từ dữ liệu mẫu", kind: "system" }),
    toasts: [{ id: uid(), title: "Chào mừng đến Tân Vượng Đảo", sub: "Nhấn vào các công trình để xem dữ liệu đằng sau", kind: "info" }],
  };
  s.log = pushLog(s.log, { text: "Sàn Hưng Thịnh thăng cấp → Cấp 2", kind: "level" });
  s.log = pushLog(s.log, { text: "Hoàn thành mục tiêu: Khóa Phân tích kỹ thuật (+120 XP)", kind: "goal", xp: 120 });
  s.log = pushLog(s.log, { text: "Ghi nhận tài sản ròng: 512 tr ₫", kind: "milestone" });
  return s;
}

/* ============================== Reducer ============================== */

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT_STREAK": {
      if (state.lastVisit === action.today || !state.onboarded) return state;
      const cont = state.lastVisit === action.yesterday;
      const streak = cont ? state.streak + 1 : 1;
      let s: State = { ...state, streak, lastVisit: action.today };
      s = { ...s, log: pushLog(s.log, { text: `Chuỗi hoạt động: ${streak} ngày liên tiếp`, kind: "system" }) };
      if (cont) {
        s = gainXp(s, state.focus, 20);
        s = { ...s, log: pushLog(s.log, { text: `Thưởng chuỗi ngày +20 XP (${DISTRICTS[state.focus].label})`, kind: "xp", xp: 20 }) };
        s = { ...s, toasts: withToast(s.toasts, { title: `Chuỗi ${streak} ngày!`, sub: "+20 XP thưởng chuyên cần", kind: "jade" }) };
      }
      return s;
    }
    case "COMPLETE_ONBOARDING":
      return action.demo ? demoState() : seedOnboarded(state, action.name, action.focus);
    case "ADD_GOAL": {
      const s = { ...state, goals: [action.goal, ...state.goals] };
      return {
        ...s,
        log: pushLog(s.log, { text: `Mục tiêu mới: ${action.goal.title} (${DISTRICTS[action.goal.district].label})`, kind: "system" }),
      };
    }
    case "ADD_TASK": {
      const s = { ...state, tasks: [action.task, ...state.tasks] };
      return { ...s, log: pushLog(s.log, { text: `Thêm nhiệm vụ: ${action.task.title}`, kind: "system" }) };
    }
    case "TOGGLE_TASK": {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      const nowDone = !task.done;
      const tasks = state.tasks.map((t) => (t.id === action.id ? { ...t, done: nowDone, ts: Date.now() } : t));
      let s: State = {
        ...state,
        tasks,
        totalTasksDone: state.totalTasksDone + (nowDone ? 1 : -1),
      };
      if (nowDone) {
        s = gainXp(s, task.district, task.xp);
        s = { ...s, log: pushLog(s.log, { text: `Hoàn thành: ${task.title} (+${task.xp} XP)`, kind: "xp", xp: task.xp }) };
      } else {
        s = gainXp(s, task.district, -task.xp);
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
        s = { ...s, log: pushLog(s.log, { text: `🏛 Hoàn thành mục tiêu: ${goal.title} (+${GOAL_BONUS_XP} XP)`, kind: "goal", xp: GOAL_BONUS_XP }) };
        s = { ...s, toasts: withToast(s.toasts, { title: "Mục tiêu hoàn thành!", sub: `${goal.title} — một cột mốc mới trên đảo`, kind: "gold" }) };
      }
      return s;
    }
    case "LOG_TRADE": {
      let s = gainXp(state, action.district, TRADE_XP);
      s = { ...s, log: pushLog(s.log, { text: `${action.text} (+${TRADE_XP} XP)`, kind: "xp", xp: TRADE_XP }) };
      return s;
    }
    case "LOG_NETWORTH": {
      const v = Math.max(0, action.value);
      const snapshots = [...state.snapshots, { t: Date.now(), v }].slice(-120);
      let s: State = { ...state, snapshots };
      s = gainXp(s, "vault", NETWORTH_XP);
      s = { ...s, log: pushLog(s.log, { text: `Ghi nhận tài sản ròng mới (+${NETWORTH_XP} XP)`, kind: "milestone" }) };
      return s;
    }
    case "RENAME_CITY":
      return { ...state, city: action.name.trim() || state.city };
    case "PUSH_TOAST":
      return { ...state, toasts: withToast(state.toasts, action.toast) };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "RESET_ALL":
      return { ...freshState() };
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
  logTrade(district: DistrictId, text: string): void;
  logNetWorth(v: number): void;
  renameCity(name: string): void;
  pushToast(t: Omit<Toast, "id">): void;
  dismissToast(id: string): void;
  resetAll(): void;
}

const StoreCtx = createContext<{ state: State; api: StoreApi } | null>(null);

const STORAGE_KEY = "vuong-state-v1";

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as State;
    if (!parsed || typeof parsed !== "object" || !parsed.xp) return freshState();
    return { ...freshState(), ...parsed, toasts: [] };
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
      /* storage full — ignore */
    }
  }, [state]);

  useEffect(() => {
    const now = Date.now();
    const y = new Date(now - 86400000);
    dispatch({ type: "INIT_STREAK", today: dayKey(now), yesterday: dayKey(y.getTime()) });
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
      logTrade: (district, text) => dispatch({ type: "LOG_TRADE", district, text }),
      logNetWorth: (v) => dispatch({ type: "LOG_NETWORTH", value: v }),
      renameCity: (name) => dispatch({ type: "RENAME_CITY", name }),
      pushToast: (t) => dispatch({ type: "PUSH_TOAST", toast: { ...t, id: uid() } }),
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
  const lv = districtLevels(state);
  return DISTRICT_IDS.reduce((s, d) => s + lv[d], 0);
}

export function netWorth(state: State): number | null {
  return state.snapshots.length ? state.snapshots[state.snapshots.length - 1].v : null;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  done: boolean;
}

export function achievements(state: State): Achievement[] {
  const nw = netWorth(state);
  const lv = districtLevels(state);
  return [
    { id: "found", name: "Khai mở", desc: "Đặt nền móng đầu tiên trên đảo", done: state.totalTasksDone >= 1 },
    { id: "builder", name: "Kiến trúc sư", desc: "Hoàn thành 10 nhiệm vụ", done: state.totalTasksDone >= 10 },
    { id: "spire3", name: "Tháp chạm mây", desc: "Tháp Genesis đạt Cấp 3", done: lv.crypto >= 3 },
    { id: "whale", name: "Cự phú", desc: "Tài sản ròng vượt 500 triệu ₫", done: nw !== null && nw >= 5e8 },
    { id: "streak3", name: "Bền bỉ", desc: "Chuỗi hoạt động 3 ngày", done: state.streak >= 3 },
    { id: "tycoon", name: "Văn minh hưng thịnh", desc: "Cấp đảo đạt 8", done: cityLevel(state) >= 8 },
  ];
}
