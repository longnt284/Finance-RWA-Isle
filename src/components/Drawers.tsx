import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { makeT } from "../lib/i18n";
import { fmtPrice, fmtMoney, fmt, USD_RATE, timeAgo } from "../lib/format";
import { useMarket, market, ASSETS, ASSET_BY_ID } from "../lib/market";
import type { Asset, MarketVenue, StockSector } from "../lib/market";
import { sound } from "../lib/audio";
import { IconClose, IconSearch, IconPlus, IconCheck, IconSwap, IconTrash, IconTrendUp, IconTrendDown, IconCoins, IconCalc, IconNote } from "./icons";

function DrawerShell({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l">
      <div className="flex items-center justify-between border-b border-mist-500/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gold-400">{icon}</span>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">{title}</h2>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

/* =============================== MARKET =============================== */

function AssetRow({ a }: { a: Asset }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const q = market.quotes[a.id];
  const inWatch = state.watchlist.includes(a.id);
  const up = q.ch >= 0;
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-ink-700/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-bold tracking-wide text-mist-100">{a.sym}</span>
          <span className="truncate text-[10.5px] text-mist-500">{a.name}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-1.5 font-mono text-[12px] text-mist-100" key={q.p} title={`${q.source} · ${q.status}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${q.status === "live" ? "bg-jade-400" : q.status === "delayed" ? "bg-gold-400" : q.status === "stale" ? "bg-coral-400" : "bg-mist-500"}`} />
          {fmtPrice(q.p, a.cur, state.currency)}
        </div>
        <div className={`flex items-center justify-end gap-1 font-mono text-[10px] ${up ? "text-jade-400" : "text-coral-400"}`}>
          {up ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
          {up ? "+" : ""}{q.ch.toFixed(2)}%
        </div>
      </div>
      <button
        onClick={() => {
          if (inWatch) api.removeWatch(a.id);
          else {
            api.addWatch(a.id);
            api.pushToast({ title: t("mk.added", { s: a.sym }), kind: "info" });
          }
          sound.coin();
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-all ${
          inWatch
            ? "border-jade-500/50 bg-jade-500/10 text-jade-400"
            : "border-mist-500/25 text-mist-500 hover:border-gold-500/50 hover:text-gold-300"
        }`}
        title={inWatch ? t("mk.remove") : t("mk.add")}
      >
        {inWatch ? <IconCheck className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/** Số mã hiển thị ban đầu; nhấn "xem thêm" mới nạp tiếp và mới lấy giá thật. */
const PAGE_SIZE = 40;

export function MarketDrawer({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [tab, setTab] = useState<MarketVenue>("crypto");
  const [sector, setSector] = useState<StockSector | "all">("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  /* Đổi tab hoặc gõ tìm kiếm thì cuộn lại từ đầu danh sách. */
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [tab, sector, query]);

  const sectors = useMemo(() => {
    if (tab === "crypto") return [] as StockSector[];
    const found = new Set<StockSector>();
    for (const asset of ASSETS) if (asset.venue === tab && asset.sector) found.add(asset.sector);
    return [...found];
  }, [tab]);

  const list = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return ASSETS.filter(
      (a) =>
        a.venue === tab &&
        (tab === "crypto" || sector === "all" || a.sector === sector) &&
        (!ql || a.sym.toLowerCase().includes(ql) || a.name.toLowerCase().includes(ql))
    );
  }, [tab, sector, query]);

  const visible = useMemo(() => list.slice(0, limit), [list, limit]);
  /* Chỉ theo dõi giá của phần đang hiển thị + watchlist — 250 mã cùng lúc là
     vô nghĩa vì người dùng không nhìn thấy hết. */
  const trackedIds = useMemo(
    () => [...state.watchlist, ...visible.map((asset) => asset.id)],
    [state.watchlist, visible]
  );
  useMarket(trackedIds);

  const watchAssets = state.watchlist.map((id) => ASSET_BY_ID.get(id)).filter(Boolean) as Asset[];

  return (
    <DrawerShell title={t("mk.title")} icon={<IconCoins className="h-4.5 w-4.5 h-[18px] w-[18px]" />} onClose={onClose}>
      {/* watchlist */}
      <div className="border-b border-mist-500/10 px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[9px] tracking-[0.24em] text-mist-400">{t("mk.watch")}</span>
          <span className="font-mono text-[9px] text-mist-500">
            {market.lastGlobalUpdate ? t("mk.updated", { t: timeAgo(market.lastGlobalUpdate, state.lang) }) : t("mk.connecting")}
          </span>
        </div>
        {watchAssets.length === 0 ? (
          <p className="text-[11px] text-mist-500">{t("mk.empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {watchAssets.map((a) => {
              const q = market.quotes[a.id];
              const up = q.ch >= 0;
              return (
                <span key={a.id} className="chip flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 font-mono text-[10px]">
                  <span className="font-bold text-mist-100">{a.sym}</span>
                  <span className="text-mist-400">{fmtPrice(q.p, a.cur, state.currency)}</span>
                  <span className={up ? "text-jade-400" : "text-coral-400"}>{up ? "+" : ""}{q.ch.toFixed(1)}%</span>
                  <button onClick={() => api.removeWatch(a.id)} className="rounded-full p-0.5 text-mist-500 hover:bg-coral-500/20 hover:text-coral-400">
                    <IconClose className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* tabs + search */}
      <div className="space-y-2 border-b border-mist-500/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="chip flex shrink-0 items-center rounded-lg p-0.5">
            {(["crypto", "vn", "us"] as MarketVenue[]).map((venue) => (
              <button
                key={venue}
                onClick={() => { setTab(venue); setSector("all"); sound.tick(); }}
                className={`rounded-md px-2.5 py-1.5 font-display text-[9px] tracking-wider transition-all ${
                  tab === venue ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {venue === "crypto" ? "Crypto" : venue === "vn" ? t("mk.tabs.vn") : t("mk.tabs.us")}
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("mk.search")}
              className="field w-full rounded-lg py-1.5 pl-8 pr-3 text-[12px] text-mist-100"
            />
          </div>
        </div>

        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(["all", ...sectors] as (StockSector | "all")[]).map((candidate) => (
              <button
                key={candidate}
                onClick={() => { setSector(candidate); sound.tick(); }}
                className={`rounded-full border px-2.5 py-1 text-[10px] transition-all ${
                  sector === candidate
                    ? "border-jade-500/55 bg-jade-500/10 text-jade-300"
                    : "border-mist-500/18 text-mist-400 hover:border-gold-500/40 hover:text-mist-100"
                }`}
              >
                {t(`mk.sector.${candidate}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="mb-1 flex items-center justify-between px-2.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-mist-500">
          <span>{t("mk.asset")} · {t("mk.count", { n: list.length })}</span>
          <span>{t("mk.price")} · {t("mk.24h")}</span>
        </div>
        {visible.map((a) => <AssetRow key={a.id} a={a} />)}
        {list.length === 0 && (
          <p className="px-2.5 py-6 text-center text-[11.5px] text-mist-500">{t("mk.noResult", { q: query.trim() })}</p>
        )}
        {limit < list.length && (
          <button
            onClick={() => { setLimit(limit + PAGE_SIZE); sound.tick(); }}
            className="btn-ghost mx-2.5 my-2 flex w-[calc(100%-1.25rem)] items-center justify-center rounded-lg py-2 text-[11px]"
          >
            {t("mk.more", { n: Math.min(PAGE_SIZE, list.length - limit) })}
          </button>
        )}
      </div>

      <div className="border-t border-mist-500/10 px-5 py-2.5 text-[9.5px] leading-relaxed text-mist-500">{t("mk.note")}</div>
    </DrawerShell>
  );
}

/* =============================== TOOLS =============================== */

export function ToolsDrawer({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  useMarket();
  const [vnd, setVnd] = useState("10000000");
  const [usd, setUsd] = useState(String(Math.round(10000000 / USD_RATE)));
  const [initM, setInitM] = useState(100); // triệu ₫
  const [monthM, setMonthM] = useState(5);
  const [years, setYears] = useState(10);
  const [apr, setApr] = useState(12);

  const r = apr / 100 / 12;
  const n = years * 12;
  const fvInit = initM * 1e6 * Math.pow(1 + r, n);
  const fvDca = r > 0 ? monthM * 1e6 * ((Math.pow(1 + r, n) - 1) / r) : monthM * 1e6 * n;
  const fv = fvInit + fvDca;
  const totalIn = (initM + monthM * n) * 1e6;

  return (
    <DrawerShell title={t("tl.title")} icon={<IconCalc className="h-[18px] w-[18px]" />} onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {/* display currency */}
        <section>
          <h3 className="mb-2 font-display text-[9px] tracking-[0.24em] text-mist-400">{t("tl.currency")}</h3>
          <div className="chip flex w-fit items-center rounded-lg p-0.5">
            {(["VND", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => api.setCurrency(c)}
                className={`rounded-md px-4 py-1.5 font-mono text-[11px] font-semibold transition-all ${
                  state.currency === c ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {c === "VND" ? "₫ VND" : "$ USD"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-mist-500">{t("tl.displayNote")}</p>
        </section>

        {/* converter */}
        <section className="rounded-xl border border-gold-500/18 bg-ink-850/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[9px] tracking-[0.24em] text-mist-400">{t("tl.conv")}</h3>
            <span className="font-mono text-[9px] text-mist-500">{t("tl.rate")}: {fmt(USD_RATE)} ₫/$</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-mono text-[9px] text-mist-500">VND</div>
              <input
                className="field w-full rounded-lg px-3 py-2 font-mono text-[13px] text-mist-100"
                value={vnd}
                inputMode="numeric"
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setVnd(v);
                  setUsd(String(Math.round((parseInt(v || "0", 10) / USD_RATE) * 100) / 100));
                }}
              />
            </div>
            <button
              onClick={() => {
                const sourceVnd = parseInt(vnd || "0", 10);
                setVnd(String(Math.max(0, sourceVnd)));
                setUsd(String(Math.round((sourceVnd / USD_RATE) * 100) / 100));
                sound.tick();
              }}
              className="btn-ghost mt-4 rounded-lg p-2"
              title={t("tl.swap")}
            >
              <IconSwap className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-mono text-[9px] text-mist-500">USD</div>
              <input
                className="field w-full rounded-lg px-3 py-2 font-mono text-[13px] text-mist-100"
                value={usd}
                inputMode="decimal"
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.]/g, "");
                  setUsd(v);
                  setVnd(String(Math.round(parseFloat(v || "0") * USD_RATE)));
                }}
              />
            </div>
          </div>
        </section>

        {/* calculator */}
        <section className="rounded-xl border border-gold-500/18 bg-ink-850/60 p-4">
          <h3 className="mb-3 font-display text-[9px] tracking-[0.24em] text-mist-400">{t("tl.calc")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] text-mist-500">{t("tl.initial")} (tr ₫)</span>
              <input className="field w-full rounded-lg px-3 py-2 font-mono text-[13px] text-mist-100" value={initM} inputMode="numeric"
                onChange={(e) => setInitM(Math.max(0, parseInt(e.target.value.replace(/[^\d]/g, "") || "0", 10)))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] text-mist-500">{t("tl.monthly")} (tr ₫)</span>
              <input className="field w-full rounded-lg px-3 py-2 font-mono text-[13px] text-mist-100" value={monthM} inputMode="numeric"
                onChange={(e) => setMonthM(Math.max(0, parseInt(e.target.value.replace(/[^\d]/g, "") || "0", 10)))} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 flex justify-between text-[10px] text-mist-500">
              <span>{t("tl.years")}</span><span className="font-mono text-gold-300">{years}</span>
            </span>
            <input type="range" min={1} max={40} value={years} onChange={(e) => setYears(parseInt(e.target.value, 10))} className="w-full" />
          </label>
          <label className="mt-2 block">
            <span className="mb-1 flex justify-between text-[10px] text-mist-500">
              <span>{t("tl.apr")}</span><span className="font-mono text-gold-300">{apr}%</span>
            </span>
            <input type="range" min={0} max={40} value={apr} onChange={(e) => setApr(parseInt(e.target.value, 10))} className="w-full" />
          </label>
          <div className="mt-4 rounded-lg border border-jade-500/25 bg-jade-500/6 p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist-500">{t("tl.result")}</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-jade-300">{fmtMoney(fv, state.currency)}</div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-mist-400">
              <span>{t("tl.totalIn")}: {fmtMoney(totalIn, state.currency)}</span>
              <span className="text-jade-400">+{fmtMoney(fv - totalIn, state.currency)}</span>
            </div>
          </div>
        </section>
      </div>
    </DrawerShell>
  );
}

/* =============================== NOTES =============================== */

export function NotesDrawer({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <DrawerShell title={t("nt.title")} icon={<IconNote className="h-[18px] w-[18px]" />} onClose={onClose}>
      <div className="border-b border-mist-500/10 p-5">
        <input
          className="field w-full rounded-lg px-3 py-2 text-[13px] font-medium text-mist-100"
          placeholder={t("nt.add")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="field mt-2 h-20 w-full resize-none rounded-lg px-3 py-2 text-[12px] leading-relaxed text-mist-300"
          placeholder={t("nt.body")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          className="btn-gold mt-2 w-full rounded-lg py-2 font-display text-[10px] tracking-[0.18em]"
          onClick={() => {
            if (!title.trim() && !body.trim()) return;
            api.addNote(title.trim() || "—", body.trim());
            setTitle("");
            setBody("");
            sound.chime();
          }}
        >
          {t("nt.save")}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-5">
        {state.notes.length === 0 && (
          <p className="rounded-lg border border-dashed border-mist-500/20 p-4 text-center text-[11px] leading-relaxed text-mist-500">{t("nt.empty")}</p>
        )}
        {state.notes.map((n) => (
          <div key={n.id} className="anim-fade-up group rounded-lg border hairline-gold bg-ink-850/60 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-semibold text-mist-100">{n.title}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-mist-500">{timeAgo(n.ts, state.lang)}</span>
                <button onClick={() => api.deleteNote(n.id)} className="text-mist-500 opacity-0 transition-all hover:text-coral-400 group-hover:opacity-100">
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {n.body && <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-mist-400">{n.body}</p>}
          </div>
        ))}
      </div>
    </DrawerShell>
  );
}
