import { useEffect, useState } from "react";
import { useStore, DISTRICT_IDS } from "../state/store";
import type { DistrictId } from "../state/store";
import { makeT } from "../lib/i18n";
import { useMarket, market, ASSET_BY_ID } from "../lib/market";
import { fmtPrice } from "../lib/format";
import { sound } from "../lib/audio";
import {
  IconBitcoin, IconChart, IconVault, IconBook, IconArrowR, IconClose,
  IconTrendUp, IconTrendDown, IconIsland, IconCompass,
} from "./icons";

const FOCUS_ICONS: Record<DistrictId, (p: { className?: string }) => React.ReactElement> = {
  crypto: IconBitcoin,
  stocks: IconChart,
  vault: IconVault,
  academy: IconBook,
};

function useEscape(open: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onEscape]);
}

/* ================================ HERO ================================ */

function HeroTicker() {
  const { state } = useStore();
  useMarket();
  const items = state.watchlist.map((id) => ({ a: ASSET_BY_ID.get(id), q: market.quotes[id] })).filter((x) => x.a && x.q);
  const row = (k: string) => (
    <div className="flex items-center">
      {items.map(({ a, q }, i) => {
        const up = q.ch >= 0;
        return (
          <span key={`${k}-${a!.id}-${i}`} className="mx-5 flex items-center gap-2 whitespace-nowrap font-mono text-[11px]">
            <span className="font-semibold tracking-wider text-mist-400">{a!.sym}</span>
            <span className="text-mist-100">{fmtPrice(q.p, a!.cur, state.currency)}</span>
            <span className={`flex items-center gap-0.5 ${up ? "text-jade-400" : "text-coral-400"}`}>
              {up ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
              {up ? "+" : ""}{q.ch.toFixed(2)}%
            </span>
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 border-t hairline-gold bg-ink-950/70 py-2.5 backdrop-blur-sm">
      <div className="flex items-center overflow-hidden">
        <span className="z-10 ml-4 mr-3 flex shrink-0 items-center gap-1.5 font-display text-[9px] tracking-[0.22em] text-gold-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jade-400" />
          LIVE MARKET
        </span>
        <div className="marquee-track">{row("a")}{row("b")}</div>
      </div>
    </div>
  );
}

export function Hero({ onBegin }: { onBegin: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  return (
    <div className="absolute inset-0 z-40 overflow-hidden">
      {/* veils */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/70 to-ink-950/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-ink-950/60" />
      <div className="scanline pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-gold-500/6 to-transparent" />
      {/* drifting motes */}
      {[12, 28, 44, 61, 73, 86].map((x, i) => (
        <span
          key={x}
          className={`absolute h-1 w-1 rotate-45 bg-gold-400/50 ${i % 2 ? "drift-a" : "drift-b"}`}
          style={{ left: `${x}%`, top: `${18 + ((i * 23) % 55)}%`, animationDelay: `${i * 0.8}s` }}
        />
      ))}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <IconIsland className="h-6 w-6 text-gold-400" />
          <div>
            <div className="font-display text-[9px] uppercase tracking-[0.34em] text-gold-400/90">{t("brand.top")}</div>
            <div className="font-display text-sm font-bold tracking-wide text-mist-100">{t("brand.main")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
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
          <div className="chip hidden items-center rounded-lg p-0.5 sm:flex">
            {(["VND", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => api.setCurrency(c)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold transition-all ${
                  state.currency === c ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* vertical side tag */}
      <div className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 rotate-90 lg:block">
        <span className="font-mono text-[10px] uppercase tracking-[0.5em] text-mist-500/70">{t("tag.live")} · 3D</span>
      </div>

      {/* main content — anchored left */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full px-6 sm:px-12 lg:px-[7vw]">
          <div className="anim-fade-up max-w-3xl" style={{ animationDelay: "0.1s" }}>
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-10 bg-gold-500" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold-400">{t("hero.kicker")}</span>
            </div>
          </div>
          <h1 className="anim-fade-up font-display leading-[0.95]" style={{ animationDelay: "0.25s" }}>
            <span className="block text-[13vw] font-bold tracking-tight text-mist-100 sm:text-[7.5vw] lg:text-[6.2rem]">{t("hero.t1")}</span>
            <span className="text-outline block text-[13vw] font-bold tracking-tight sm:text-[7.5vw] lg:text-[6.2rem]">{t("hero.t2")}</span>
          </h1>
          <p className="anim-fade-up mt-6 max-w-xl text-[14px] leading-relaxed text-mist-300 sm:text-[15px]" style={{ animationDelay: "0.4s" }}>
            {t("hero.sub")}
          </p>
          <div className="anim-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.55s" }}>
            <button
              onClick={() => {
                sound.chime();
                onBegin();
              }}
              className="btn-gold flex items-center gap-2.5 rounded-xl px-6 py-3.5 font-display text-[12px] tracking-[0.14em]"
            >
              <IconCompass className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              {t("hero.begin")}
              <IconArrowR className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                sound.coin();
                api.completeOnboarding("", "crypto", true);
              }}
              className="btn-ghost rounded-xl px-6 py-3.5 font-display text-[12px] tracking-[0.14em]"
            >
              {t("hero.demo")}
            </button>
          </div>
          {/* inline stats */}
          <div className="anim-fade-up mt-10 flex items-center gap-6" style={{ animationDelay: "0.7s" }}>
            {([
              [t("hero.s1v"), t("hero.s1k")],
              [t("hero.s2v"), t("hero.s2k")],
              [t("hero.s3v"), t("hero.s3k")],
            ] as [string, string][]).map(([v, k], i) => (
              <div key={k} className="flex items-center gap-6">
                {i > 0 && <span className="h-8 w-px rotate-12 bg-gold-500/40" />}
                <div>
                  <div className="font-display text-xl font-bold text-gold-300">{v}</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-mist-500">{k}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* quote + hint */}
      <div className="absolute bottom-14 left-6 z-10 hidden sm:left-12 lg:block lg:left-[7vw]">
        <p className="anim-floaty max-w-xs text-[11.5px] italic leading-relaxed text-mist-500">{t("hero.quote")}</p>
      </div>
      <div className="absolute bottom-14 left-1/2 z-10 hidden -translate-x-1/2 md:block">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-mist-500/80">{t("hero.hint")}</span>
      </div>

      <HeroTicker />
    </div>
  );
}

/* ============================ ONBOARDING ============================ */

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<DistrictId>("crypto");
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={t("ob.title")} className="absolute inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm">
      <div className="anim-pop panel w-full max-w-[560px] rounded-2xl p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold-500" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400">{t("ob.kicker")}</span>
            </div>
            <h2 className="mt-2 font-display text-xl font-bold text-mist-100 sm:text-2xl">{t("ob.title")}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <input
          className="field mt-6 w-full rounded-xl px-4 py-3 text-[15px] text-mist-100"
          placeholder={t("ob.namePh")}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />

        <div className="mt-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{t("ob.focus")}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {DISTRICT_IDS.map((d) => {
              const Icon = FOCUS_ICONS[d];
              const on = focus === d;
              return (
                <button
                  key={d}
                  onClick={() => {
                    setFocus(d);
                    sound.tick();
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                    on ? "border-gold-500/60 bg-gold-500/10 shadow-[0_0_24px_rgba(224,170,80,0.12)]" : "hairline-gold bg-ink-850/60 hover:border-gold-500/30"
                  }`}
                >
                  <span className={`mt-0.5 ${on ? "text-gold-300" : "text-mist-500"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className={`block text-[13px] font-semibold ${on ? "text-gold-300" : "text-mist-100"}`}>{t(`d.${d}.name`)}</span>
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-mist-500">{t(`d.${d}.tagline`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          <button onClick={onClose} className="btn-ghost rounded-xl px-5 py-3 font-display text-[11px] tracking-wider">
            {t("ob.back")}
          </button>
          <button
            onClick={() => {
              sound.levelUp();
              api.completeOnboarding(name, focus, false);
              onClose();
            }}
            className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 font-display text-[11px] tracking-[0.14em]"
          >
            {t("ob.begin")}
            <IconArrowR className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ TUTORIAL ============================ */

const STEPS = 8;

export function TutorialOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [step, setStep] = useState(0);
  const finish = () => {
    api.markTutorial();
    setStep(0);
    onClose();
  };
  useEscape(open, finish);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={t("tu.title")} className="absolute inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm">
      <div className="anim-pop panel w-full max-w-[500px] rounded-2xl p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gold-500" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400">
              {t("tu.title")} · {step + 1}/{STEPS}
            </span>
          </div>
          <button onClick={finish} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-4 font-display text-lg font-bold text-mist-100">{t(`tu.${step}.t`)}</h3>
        <p className="mt-2 min-h-[72px] text-[13px] leading-relaxed text-mist-300">{t(`tu.${step}.b`)}</p>
        <div className="mt-3 flex items-center gap-1.5">
          {Array.from({ length: STEPS }).map((_, i) => (
            <button key={i} onClick={() => setStep(i)} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-gold-400" : "w-2 bg-mist-500/30 hover:bg-mist-500/60"}`} />
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button onClick={finish} className="text-[11px] text-mist-500 underline-offset-4 transition-colors hover:text-mist-300 hover:underline">
            {t("tu.skip")}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="btn-ghost rounded-lg px-4 py-2.5 font-display text-[10px] tracking-wider">
                {t("tu.prev")}
              </button>
            )}
            {step < STEPS - 1 ? (
              <button
                onClick={() => {
                  setStep(step + 1);
                  sound.tick();
                }}
                className="btn-gold flex items-center gap-2 rounded-lg px-5 py-2.5 font-display text-[10px] tracking-wider"
              >
                {t("tu.next")} <IconArrowR className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => { sound.chime(); finish(); }} className="btn-gold rounded-lg px-5 py-2.5 font-display text-[10px] tracking-wider">
                {t("tu.done")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
