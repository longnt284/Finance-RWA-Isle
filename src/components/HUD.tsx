import { useEffect, useRef, useState } from "react";
import { useStore, cityLevel, netWorth, levelFor } from "../state/store";
import type { DistrictId, ViewId } from "../state/store";
import { compactVND, fmt, timeAgo } from "../lib/format";
import { sound } from "../lib/audio";
import {
  IconCrypto, IconStocks, IconVault, IconAcademy, IconLighthouse, IconOverview,
  IconFlame, IconSound, IconMute, IconBolt, IconClose,
} from "./icons";

const NAV: { id: ViewId; name: string; icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: "overview", name: "Toàn cảnh", icon: IconOverview },
  { id: "crypto", name: "Tháp Genesis", icon: IconCrypto },
  { id: "stocks", name: "Sàn Hưng Thịnh", icon: IconStocks },
  { id: "vault", name: "Kim Khố", icon: IconVault },
  { id: "academy", name: "Học Viện", icon: IconAcademy },
  { id: "center", name: "Hải Đăng", icon: IconLighthouse },
];

const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

interface Quote {
  sym: string;
  price: number;
  isIndex?: boolean;
}

const INITIAL_QUOTES: Quote[] = [
  { sym: "BTC", price: 2.641e9 },
  { sym: "ETH", price: 9.24e7 },
  { sym: "SOL", price: 5.13e6 },
  { sym: "BNB", price: 1.72e7 },
  { sym: "VNINDEX", price: 1287.4, isIndex: true },
  { sym: "FPT", price: 134200, isIndex: true },
  { sym: "SSI", price: 27850, isIndex: true },
  { sym: "VÀNG", price: 8.42e7 },
];

function quoteStr(q: Quote): string {
  if (q.isIndex) return fmt(q.price);
  return compactVND(q.price);
}

export function TickerTape() {
  const [quotes, setQuotes] = useState(INITIAL_QUOTES);
  const [dir, setDir] = useState<Record<string, number>>({});
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQuotes((prev) => {
        const next = prev.map((q) => {
          const drift = (Math.random() - 0.485) * 0.011;
          return { ...q, price: Math.max(0.01, q.price * (1 + drift)), _d: drift };
        }) as (Quote & { _d: number })[];
        const d: Record<string, number> = {};
        for (const q of next) d[q.sym] = q._d >= 0 ? 1 : -1;
        setDir(d);
        return next;
      });
      setFlashKey((k) => k + 1);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="chip flex items-center gap-4 overflow-hidden rounded-md px-3 py-1.5 font-mono text-[11px]">
      <span className="shrink-0 font-display text-[8px] tracking-[0.22em] text-gold-400">THỊ TRƯỜNG</span>
      <div className="flex items-center gap-4 overflow-hidden">
        {quotes.map((q) => (
          <span key={q.sym + flashKey} className={`whitespace-nowrap ${dir[q.sym] === 1 ? "flash-up" : "flash-down"}`}>
            <span className="text-mist-400">{q.sym}</span>{" "}
            <span className="text-mist-100">{quoteStr(q)}</span>{" "}
            <span className={dir[q.sym] === 1 ? "text-jade-400" : "text-coral-400"}>{dir[q.sym] === 1 ? "▲" : "▼"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function TopBar() {
  const { state } = useStore();
  const nw = netWorth(state);
  const cl = cityLevel(state);
  const [muted, setMuted] = useState(sound.isMuted());

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-4 sm:p-5">
      {/* wordmark */}
      <div className="pointer-events-auto anim-fade-up">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-xl font-bold tracking-[0.08em] text-gold-300 sm:text-2xl" style={{ textShadow: "0 0 24px rgba(240,194,104,0.35)" }}>
            VƯỢNG
          </span>
          <span className="hidden font-display text-[9px] tracking-[0.3em] text-mist-400 sm:block">WEALTH CIVILIZATION</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-mist-400">
          <span className="text-mist-300">{state.city}</span>
          <span className="chip rounded px-1.5 py-px font-mono text-[10px] text-gold-400">Cấp đảo {cl}</span>
        </div>
      </div>

      {/* stats */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="chip anim-fade-up hidden rounded-md px-3 py-1.5 text-right md:block" style={{ animationDelay: "60ms" }}>
          <div className="text-[9px] uppercase tracking-[0.18em] text-mist-500">Tài sản ròng</div>
          <div className="font-mono text-sm font-semibold text-gold-300">{nw === null ? "—" : compactVND(nw)}</div>
        </div>
        <div className="chip anim-fade-up rounded-md px-3 py-1.5 text-right" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-end gap-1 text-[9px] uppercase tracking-[0.18em] text-mist-500">
            <IconBolt className="h-3 w-3 text-gold-400" /> Tổng XP
          </div>
          <div className="font-mono text-sm font-semibold text-mist-100">{fmt(DISTRICT_IDS.reduce((s, d) => s + state.xp[d], 0))}</div>
        </div>
        <div className="chip anim-fade-up rounded-md px-3 py-1.5 text-center" style={{ animationDelay: "180ms" }}>
          <div className="flex items-center justify-center gap-1 font-mono text-sm font-semibold text-coral-400">
            <IconFlame className="h-4 w-4" /> {state.streak}
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-mist-500">ngày</div>
        </div>
        <button
          className="chip anim-fade-up rounded-md p-2.5 text-mist-300 transition-colors hover:text-gold-300"
          style={{ animationDelay: "240ms" }}
          onClick={() => {
            setMuted(sound.toggleMute());
            sound.tick();
          }}
          title={muted ? "Bật âm thanh" : "Tắt âm thanh"}
        >
          {muted ? <IconMute className="h-4 w-4" /> : <IconSound className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function SideNav({ selected, onSelect }: { selected: ViewId; onSelect: (v: ViewId) => void }) {
  const { state } = useStore();
  return (
    <div className="pointer-events-auto absolute left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-1.5 lg:flex">
      {NAV.map((n, i) => {
        const active = selected === n.id;
        const lv = n.id !== "overview" && n.id !== "center" ? levelFor(state.xp[n.id as DistrictId]) : null;
        const Icon = n.icon;
        return (
          <button
            key={n.id}
            onClick={() => {
              sound.tick();
              onSelect(n.id);
            }}
            className={`anim-fade-up group flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-all duration-200 ${
              active
                ? "border-gold-500/60 bg-gold-500/15 text-gold-300 shadow-[0_0_20px_rgba(224,170,80,0.15)]"
                : "border-transparent text-mist-400 hover:border-gold-500/25 hover:bg-ink-800/70 hover:text-mist-100"
            }`}
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap font-display text-[10px] tracking-[0.12em] opacity-0 transition-all duration-300 group-hover:max-w-[140px] group-hover:opacity-100">
              {n.name.toUpperCase()}
              {lv !== null && <span className="ml-1.5 font-mono text-[9px] text-gold-400">·{String(lv).padStart(1, "0")}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BottomHud({ selected }: { selected: ViewId }) {
  const { state } = useStore();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="pointer-events-auto hidden sm:block">
            <TickerTape />
          </div>
          <div className="hidden max-w-[380px] flex-col gap-1 md:flex">
            {state.log.slice(0, 3).map((l) => (
              <div key={l.id} className="anim-fade-up flex items-center gap-2 text-[11px] text-mist-400">
                <span
                  className="h-1 w-1 shrink-0 rotate-45"
                  style={{
                    background: l.kind === "level" ? "#ffd88a" : l.kind === "goal" ? "#4cd99a" : l.kind === "xp" ? "#5ce8c4" : "#5f7d82",
                  }}
                />
                <span className="truncate">{l.text}</span>
                <span className="shrink-0 font-mono text-[9px] text-mist-500">{timeAgo(l.ts)}</span>
              </div>
            ))}
          </div>
        </div>
        {selected === "overview" && (
          <div className="pointer-events-auto hidden shrink-0 text-right text-[10px] leading-relaxed text-mist-500 lg:block">
            <div>Kéo để xoay · cuộn để thu phóng</div>
            <div className="text-mist-400">Nhấn vào một công trình để mở quận</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Toasts() {
  const { state, api } = useStore();
  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-40 flex w-[min(92vw,360px)] -translate-x-1/2 flex-col gap-2">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} title={t.title} sub={t.sub} kind={t.kind} onDone={(id) => api.dismissToast(id)} />
      ))}
    </div>
  );
}

function ToastItem({ id, title, sub, kind, onDone }: { id: string; title: string; sub?: string; kind: "gold" | "jade" | "info"; onDone: (id: string) => void }) {
  const timer = useRef<number>(0);
  useEffect(() => {
    timer.current = window.setTimeout(() => onDone(id), 4200);
    return () => window.clearTimeout(timer.current);
  }, [id, onDone]);
  const color = kind === "gold" ? "text-gold-300" : kind === "jade" ? "text-jade-300" : "text-mist-300";
  const bar = kind === "gold" ? "#e0aa50" : kind === "jade" ? "#4cd99a" : "#5f7d82";
  return (
    <div className="anim-toast panel pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg px-4 py-3">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: bar }} />
      <div className="min-w-0 flex-1">
        <div className={`font-display text-[11px] tracking-[0.08em] ${color}`}>{title}</div>
        {sub && <div className="mt-0.5 text-[11px] text-mist-400">{sub}</div>}
      </div>
      <button className="shrink-0 text-mist-500 transition-colors hover:text-mist-100" onClick={() => onDone(id)}>
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
