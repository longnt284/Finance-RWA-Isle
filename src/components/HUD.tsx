import { useEffect, useState } from "react";
import {
  useStore, cityLevel, netWorth, xpMult, DISTRICT_IDS, ISLE_UNLOCK_LEVELS,
  MAX_LEVEL, checkinIndex, checkinReward, questClaimable, pendingExamLevel, renderLog,
} from "../state/store";
import type { DistrictId, ViewId } from "../state/store";
import { makeT } from "../lib/i18n";
import { fmtMoney, dayKey, timeAgo, fmtPrice, compactVND } from "../lib/format";
import { useMarket, market, ASSET_BY_ID } from "../lib/market";
import {
  IconBitcoin, IconChart, IconVault, IconBook, IconHome, IconCompass, IconIsland,
  IconBolt, IconGift, IconSound, IconSoundOff, IconCoins, IconCalc, IconNote, IconHelp,
  IconClose, IconTrendUp, IconTrendDown, IconChevD, IconCalendar, IconSliders, IconUser,
  IconBrain,
} from "./icons";

export type DrawerId = "market" | "tools" | "notes" | "tutorial" | "quests" | "world" | "account" | null;

interface Props {
  selected: ViewId;
  onSelect: (v: ViewId) => void;
  drawer: DrawerId;
  onDrawer: (d: DrawerId) => void;
  muted: boolean;
  onToggleMute: () => void;
  voyage: boolean;
  canVoyage: boolean;
  onVoyage: () => void;
  onHelmInput: (input: { throttle: number; turn: number }) => void;
  onExam: (district: DistrictId) => void;
}

const NAV_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  overview: IconCompass,
  center: IconHome,
  crypto: IconBitcoin,
  stocks: IconChart,
  vault: IconVault,
  academy: IconBook,
  isle: IconIsland,
};

function NavChip({ id, onClick, active }: { id: string; onClick: () => void; active: boolean }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const isDistrict = (DISTRICT_IDS as string[]).includes(id);
  const district = isDistrict ? (id as DistrictId) : null;
  const lv = district ? state.certified[district] : null;
  /* Đủ XP nhưng chưa qua khảo thí thì chấm vàng nhấp nháy ngay trên thanh điều hướng. */
  const examReady = district ? pendingExamLevel(state, district) !== null : false;
  const isleLocked = id === "isle" && !DISTRICT_IDS.some((candidate) => state.certified[candidate] >= ISLE_UNLOCK_LEVELS[candidate]);
  const Icon = NAV_ICONS[id];
  const label =
    id === "overview" ? t("nav.overview")
    : id === "center" ? t("nav.center")
    : id === "isle" ? t("nav.isle")
    : t(`d.${id}.building`);
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
        active
          ? "border-gold-500/60 bg-gold-500/12 text-gold-300 shadow-[0_0_18px_rgba(224,170,80,0.15)]"
          : "border-mist-500/12 bg-ink-850/60 text-mist-400 hover:border-gold-500/35 hover:text-mist-100 hover:translate-x-0.5"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-gold-400" : ""}`} />
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{label}</span>
      {examReady && (
        <span className="anim-breathe shrink-0 text-gold-400" title={t("exam.readyShort")} aria-label={t("exam.readyShort")}>
          <IconBrain className="h-3.5 w-3.5" />
        </span>
      )}
      {lv !== null && (
        <span
          className={`shrink-0 rounded px-1.5 py-px font-mono text-[9.5px] tabular ${
            lv >= MAX_LEVEL ? "bg-gold-500/20 text-gold-300" : active ? "text-gold-300" : "text-mist-500"
          }`}
        >
          {t("misc.levelShort", { n: lv })}
        </span>
      )}
      {id === "isle" && isleLocked && (
        <span className="font-mono text-[9px] text-mist-500">{t("misc.levelShort", { n: Math.min(...Object.values(ISLE_UNLOCK_LEVELS)) })}+</span>
      )}
    </button>
  );
}

function Ticker() {
  const { state, api } = useStore();
  useMarket(state.watchlist);
  const t = makeT(state.lang);
  if (state.watchlist.length === 0) return null;
  const items = state.watchlist.map((id) => ({ asset: ASSET_BY_ID.get(id), q: market.quotes[id] })).filter((x) => x.asset && x.q);
  const row = (keyPrefix: string) => (
    <div className="flex items-center">
      {items.map(({ asset, q }, i) => {
        const up = q.ch >= 0;
        const flash = q.p > q.prev ? "flash-up" : q.p < q.prev ? "flash-down" : "";
        return (
          <button
            key={`${keyPrefix}-${asset!.id}-${i}`}
            onClick={() => api.pushToast({ title: `${asset!.sym} · ${asset!.name}`, sub: `${fmtPrice(q.p, asset!.cur, state.currency)} · ${up ? "+" : ""}${q.ch.toFixed(2)}%`, kind: "info" })}
            className="mx-4 flex items-center gap-2 whitespace-nowrap font-mono text-[11px]"
          >
            <span className="font-semibold tracking-wider text-mist-300">{asset!.sym}</span>
            <span className={`text-mist-100 ${flash}`} key={`${asset!.id}-${q.p}`}>{fmtPrice(q.p, asset!.cur, state.currency)}</span>
            <span className={`flex items-center gap-0.5 ${up ? "text-jade-400" : "text-coral-400"}`}>
              {up ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
              {up ? "+" : ""}{q.ch.toFixed(2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20 border-t hairline-gold bg-ink-900/85 py-2 backdrop-blur-md">
      <div className="flex items-center">
        <span className="z-10 flex min-w-[138px] shrink-0 items-center gap-1.5 border-r border-gold-500/15 bg-ink-900 px-3 font-display text-[9px] tracking-[0.16em] text-gold-400">
          <span className={`h-1.5 w-1.5 rounded-full ${market.connection === "live" ? "animate-pulse bg-jade-400" : market.connection === "connecting" ? "animate-pulse bg-gold-400" : "bg-coral-400"}`} />
          {market.connection === "live" ? t("hud.live") : market.connection === "partial" ? t("hud.partial") : market.connection === "connecting" ? t("hud.connecting") : t("hud.offline")}
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="marquee-track">
            {row("a")}
            {row("b")}
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveClock() {
  const { state } = useStore();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    document.documentElement.lang = state.lang;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [state.lang]);
  const locale = state.lang === "vi" ? "vi-VN" : "en-US";
  return (
    <div className="chip hidden items-center gap-2 rounded-lg px-3 py-1.5 md:flex" aria-label={now.toLocaleString(locale)}>
      <span className="h-1.5 w-1.5 rounded-full bg-jade-400 shadow-[0_0_10px_rgba(76,217,154,0.8)]" />
      <div className="text-right font-mono leading-tight">
        <div className="text-[11px] font-semibold text-mist-100">{now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
        <div className="text-[8px] uppercase tracking-[0.13em] text-mist-500">{now.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })}</div>
      </div>
    </div>
  );
}

function VoyageControls({ onInput, onExit }: { onInput: (input: { throttle: number; turn: number }) => void; onExit: () => void }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const controlProps = (throttle: number, turn: number) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      onInput({ throttle, turn });
    },
    onPointerUp: () => onInput({ throttle: 0, turn: 0 }),
    onPointerCancel: () => onInput({ throttle: 0, turn: 0 }),
    onPointerLeave: () => onInput({ throttle: 0, turn: 0 }),
  });
  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-end gap-3">
      <div className="panel rounded-2xl p-2 shadow-2xl">
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <button {...controlProps(1, 0)} className="helm-key" aria-label={t("yacht.forward")}>↑</button>
          <span />
          <button {...controlProps(0, -1)} className="helm-key" aria-label={t("yacht.left")}>←</button>
          <button {...controlProps(-1, 0)} className="helm-key" aria-label={t("yacht.reverse")}>↓</button>
          <button {...controlProps(0, 1)} className="helm-key" aria-label={t("yacht.right")}>→</button>
        </div>
        <div className="mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.18em] text-mist-500">WASD · {t("yacht.drag")}</div>
      </div>
      <button onClick={onExit} className="btn-gold mb-1 rounded-xl px-4 py-3 font-display text-[10px] tracking-wider">{t("yacht.exit")}</button>
    </div>
  );
}

export default function HUD({ selected, onSelect, drawer, onDrawer, muted, onToggleMute, voyage, canVoyage, onVoyage, onHelmInput, onExam }: Props) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [feedOpen, setFeedOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 639px)");
    const collapseOnCompact = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setFeedOpen(false);
    };
    collapseOnCompact(compact);
    compact.addEventListener("change", collapseOnCompact);
    return () => compact.removeEventListener("change", collapseOnCompact);
  }, []);
  useEffect(() => {
    const first = state.toasts[0];
    if (!first) return;
    const timer = window.setTimeout(() => api.dismissToast(first.id), 5200);
    return () => window.clearTimeout(timer);
  }, [state.toasts, api]);

  const nw = netWorth(state);
  const today = dayKey(Date.now());
  const canClaim = state.onboarded && state.lastClaim !== today;
  /* Ô sắp nhận trong chu kỳ 7 ngày — cũng là số XP hiển thị trên nút. */
  const claimAmount = Math.round(checkinReward(checkinIndex(state)) * xpMult(state.streak));
  const claimableQuests = state.quests.ids.filter((id) => questClaimable(state, id)).length;
  const pendingExams = DISTRICT_IDS.filter((district) => pendingExamLevel(state, district) !== null).length;
  const navIds: string[] = ["overview", "center", ...DISTRICT_IDS, "isle"];
  /* Mọi bảng bên phải rộng 420px; thanh trên cùng và cột phải lùi vào để không bị che. */
  const panelOpen = (drawer !== null && drawer !== "tutorial") || selected !== "overview";

  return (
    <>
      {/* ------------------------------ top bar ------------------------------ */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="panel rounded-xl px-4 py-2.5">
            <div className="font-display text-[9px] uppercase tracking-[0.3em] text-gold-400/90">{t("brand.top")}</div>
            <div className="font-display text-lg font-bold leading-tight tracking-wide text-mist-100">{t("brand.main")}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-mist-500">
              <span className="h-1 w-1 rotate-45 bg-gold-500" />
              {state.city || "—"} · {t("ct.islandLvl")} {cityLevel(state)}
            </div>
          </div>
          {canClaim && (
            <button
              onClick={() => api.claimDaily()}
              className="btn-gold glow-pulse pointer-events-auto flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 font-display text-[10px] tracking-wider"
            >
              <IconGift className="h-4 w-4" />
              <span className="hidden sm:inline">{t("hud.daily", { x: claimAmount })}</span>
              <span className="sm:hidden">+{claimAmount}</span>
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          <LiveClock />
          {/* currency + language */}
          <div className="chip flex items-center rounded-lg p-0.5">
            {(["VND", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => api.setCurrency(c)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold transition-all ${
                  state.currency === c ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {c === "VND" ? "₫" : "$"} {c}
              </button>
            ))}
          </div>
          <button
            onClick={onVoyage}
            disabled={!canVoyage}
            title={canVoyage ? t("yacht.title") : t("yacht.locked")}
            className={`chip flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] transition-all ${voyage ? "border-jade-500/60 bg-jade-500/10 text-jade-300" : "text-mist-400 hover:border-jade-500/40 hover:text-jade-300"} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <IconIsland className="h-4 w-4" />
            <span className="hidden 2xl:inline">{t("yacht.title")}</span>
          </button>
          <div className="chip flex items-center rounded-lg p-0.5">
            {(["vi", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => api.setLang(l)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase transition-all ${
                  state.lang === l ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {([
            ["quests", IconCalendar, t("ci.title"), claimableQuests + (canClaim ? 1 : 0)],
            ["market", IconCoins, t("hud.market"), 0],
            ["tools", IconCalc, t("hud.tools"), 0],
            ["notes", IconNote, t("hud.notes"), 0],
            ["world", IconSliders, t("wd.title"), 0],
            ["account", IconUser, t("ac.title"), 0],
            ["tutorial", IconHelp, t("hud.help"), 0],
          ] as const).map(([id, Icon, label, badge]) => (
            <button
              key={id}
              onClick={() => onDrawer(drawer === id ? null : id)}
              title={label}
              aria-label={label}
              className={`chip relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] transition-all ${
                drawer === id ? "border-gold-500/50 text-gold-300" : "text-mist-400 hover:text-mist-100 hover:border-gold-500/30"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden 2xl:inline">{label}</span>
              {badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-400 px-1 font-mono text-[9px] font-bold text-ink-950">
                  {badge}
                </span>
              )}
            </button>
          ))}
          <button onClick={onToggleMute} title={muted ? t("hud.muted") : t("hud.mute")} className="chip rounded-lg p-2 text-mist-400 transition-colors hover:text-mist-100">
            {muted ? <IconSoundOff className="h-4 w-4" /> : <IconSound className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ------------------------------ left nav ------------------------------ */}
      <div className="pointer-events-none absolute bottom-14 left-3 top-24 z-20 hidden w-[210px] flex-col gap-1.5 sm:flex sm:top-24">
        <div className="mb-1 font-display text-[9px] uppercase tracking-[0.28em] text-mist-500">{t("hud.nav")}</div>
        <div className="pointer-events-auto flex flex-col gap-1.5">
          {navIds.map((id) => (
            <NavChip key={id} id={id} active={selected === id} onClick={() => onSelect(id as ViewId)} />
          ))}
        </div>
        {selected !== "overview" && (
          <button onClick={() => onSelect("overview")} className="btn-ghost pointer-events-auto mt-2 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px]">
            <IconChevD className="h-3.5 w-3.5 -rotate-90" />
            {t("hud.back")}
          </button>
        )}
      </div>

      {/* ------------------------------ right: networth + feed ------------------------------ */}
      <div
        className={`pointer-events-none absolute bottom-14 top-24 z-20 flex w-[230px] flex-col items-end gap-2 transition-[right] duration-300 sm:w-[250px] ${
          panelOpen ? "right-3 hidden xl:flex xl:right-[440px]" : "right-3"
        }`}
      >
        <div className="panel pointer-events-auto w-full rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist-500">{t("hud.networth")}</span>
            <span className="chip flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] text-gold-300">
              <IconBolt className="h-3 w-3" />
              {t("hud.streak", { n: state.streak })} · ×{xpMult(state.streak).toFixed(2)}
            </span>
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tracking-tight text-gold-300">
            {nw === null ? "—" : fmtMoney(nw, state.currency)}
          </div>
          {nw !== null && state.currency === "USD" && (
            <div className="font-mono text-[10px] text-mist-500">{compactVND(nw)}</div>
          )}
        </div>

        <div className={`panel pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-xl ${feedOpen ? "flex-1" : "shrink-0"}`}>
          <button onClick={() => setFeedOpen(!feedOpen)} className="flex items-center justify-between px-4 py-2.5">
            <span className="font-display text-[9px] tracking-[0.24em] text-mist-400">{t("hud.feed")}</span>
            <IconChevD className={`h-3.5 w-3.5 text-mist-500 transition-transform ${feedOpen ? "" : "rotate-180"}`} />
          </button>
          {feedOpen && (
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-3">
              {state.log.length === 0 && <p className="text-[10px] text-mist-500">…</p>}
              {state.log.slice(0, 14).map((l) => (
                <div key={l.id} className="flex items-baseline gap-2 text-[10.5px] leading-snug">
                  <span
                    className="mt-1 h-1 w-1 shrink-0 rotate-45"
                    style={{
                      background:
                        l.kind === "level" ? "#f0c268"
                        : l.kind === "goal" ? "#ffd88a"
                        : l.kind === "xp" ? "#4cd99a"
                        : l.kind === "event" ? "#9fd0ff"
                        : l.kind === "ach" ? "#ff7f6e"
                        : "#5f7d82",
                    }}
                  />
                  <span className="min-w-0 flex-1 text-mist-400">{renderLog(t, l)}</span>
                  <span className="shrink-0 font-mono text-[8.5px] text-mist-500">{timeAgo(l.ts, state.lang)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------ hint / lời mời khảo thí ------------------------------ */}
      {selected === "overview" && !voyage && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
          {pendingExams > 0 && (
            <button
              onClick={() => {
                /* Mở thẳng phòng khảo thí — nút này nói "chờ khảo thí" nên đưa
                   người chơi vào bảng lĩnh vực rồi bắt bấm tiếp là thừa một nhịp. */
                const next = DISTRICT_IDS.find((district) => pendingExamLevel(state, district) !== null);
                if (next) onExam(next);
              }}
              className="btn-gold glow-pulse pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 font-display text-[10.5px] tracking-wider"
            >
              <IconBrain className="h-4 w-4" />
              {t("exam.readyShort")}
              {pendingExams > 1 && <span className="font-mono">×{pendingExams}</span>}
            </button>
          )}
          <span className="chip anim-fade-in rounded-full px-4 py-1.5 text-[10.5px] text-mist-400">{t("hud.clkHint")}</span>
        </div>
      )}

      {/* ------------------------------ toasts ------------------------------ */}
      <div className="pointer-events-none absolute left-1/2 top-20 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {state.toasts.map((toast) => (
          <div
            key={toast.id}
            className={`anim-toast panel pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 ${
              toast.kind === "gold" ? "border-gold-500/50" : toast.kind === "jade" ? "border-jade-500/50" : ""
            }`}
          >
            <span className={`mt-1 h-2 w-2 rotate-45 ${toast.kind === "gold" ? "bg-gold-400" : toast.kind === "jade" ? "bg-jade-400" : "bg-mist-400"}`} />
            <div>
              <div className="font-display text-[12px] font-semibold text-mist-100">{toast.title}</div>
              {toast.sub && <div className="mt-0.5 text-[11px] text-mist-400">{toast.sub}</div>}
            </div>
            <button onClick={() => api.dismissToast(toast.id)} className="ml-2 text-mist-500 transition-colors hover:text-mist-100">
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Ticker />
      {voyage && <VoyageControls onInput={onHelmInput} onExit={onVoyage} />}
    </>
  );
}
