import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore, basketValue } from "../state/store";
import { makeT } from "../lib/i18n";
import { fmt } from "../lib/format";
import { sound } from "../lib/audio";
import { seasonForDate, phaseForHour } from "../lib/season";
import {
  FISH, FISH_BY_ID, FISH_COUNT, RARITY_META, RARITY_ORDER,
  biteDelay, fishName, fishValue, fishingConfig, nextFishTarget, rodProgress, rollFish, rollWeight,
} from "../lib/fishing";
import type { FishDef } from "../lib/fishing";
import { IconClose, IconFish, IconCoinPurse, IconCheck } from "./icons";

export type FishingZone = "shore" | "vortex";
type Phase = "idle" | "casting" | "hooked" | "caught" | "escaped";
type Tab = "game" | "basket" | "book";

/** Xoáy nước ngoài khơi mới là nơi cá hiếm sống — đó là lý do phải ra khơi. */
const ZONE_LUCK: Record<FishingZone, number> = { shore: 0.12, vortex: 0.8 };

/**
 * Vật lý của khung giữ cá: nhấn để nâng, thả ra thì rơi.
 *
 * Vận tốc tới hạn mới là con số quyết định trò này có chơi được không, chứ
 * không phải ba hằng số rời rạc: lên `(LIFT - GRAVITY) / DAMPING` = 1,3 đơn vị
 * mỗi giây, xuống `GRAVITY / DAMPING` = 1,4. Cả hai đều nhanh hơn con cá nhanh
 * nhất (1,09), nên người chơi luôn đuổi kịp nếu bấm đúng nhịp. Bản đầu tiên đặt
 * lực nâng quá nhẹ — khung leo 0,33/s trong khi cá bơi 0,35–1,5/s, tức là không
 * ván nào thắng được.
 */
const LIFT = 8.1;
const GRAVITY = 4.2;
const DAMPING = 3.0;

function rarityChip(rarity: FishDef["rarity"], label: string) {
  const color = RARITY_META[rarity].color;
  return (
    <span
      className="shrink-0 rounded border px-1.5 py-px font-mono text-[8.5px] uppercase tracking-wider"
      style={{ borderColor: `${color}66`, color }}
    >
      {label}
    </span>
  );
}

/* ================================================================== */
/*  Minigame                                                          */
/* ================================================================== */

function Rod({ zone, onLanded }: { zone: FishingZone; onLanded: (fish: FishDef, weight: number, value: number) => void }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hooked, setHooked] = useState<FishDef | null>(null);
  const [result, setResult] = useState<{ fish: FishDef; weight: number; value: number; fresh: boolean } | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fishRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const holding = useRef(false);

  const rod = rodProgress(state.fishCaught);

  /* Một ván chỉ đọc state lúc bắt đầu; sau đó chạy hoàn toàn bằng ref để vòng
     lặp 60fps không kéo theo một lần render React nào. */
  const run = useRef({
    barY: 0.36,
    barVel: 0,
    barH: 0.24,
    fishY: 0.5,
    fishTarget: 0.5,
    fishTimer: 0,
    progress: 0.32,
    fillRate: 0.5,
    drainRate: 0.3,
    fishSpeed: 0.8,
    motion: "smooth" as FishDef["motion"],
    active: false,
  });

  const paint = useCallback(() => {
    const s = run.current;
    if (barRef.current) {
      barRef.current.style.height = `${s.barH * 100}%`;
      barRef.current.style.bottom = `${s.barY * 100}%`;
    }
    if (fishRef.current) fishRef.current.style.bottom = `calc(${s.fishY * 100}% - 11px)`;
    if (gaugeRef.current) gaugeRef.current.style.height = `${Math.max(0, Math.min(1, s.progress)) * 100}%`;
  }, []);

  /* ---------------------- thả cần và chờ cắn câu ---------------------- */
  const cast = useCallback(() => {
    setResult(null);
    setHooked(null);
    setPhase("casting");
    sound.tick();
    const delay = biteDelay();
    const timer = window.setTimeout(() => {
      const now = new Date();
      const night = phaseForHour(now.getHours() + now.getMinutes() / 60) === "night";
      const fish = rollFish(zone, seasonForDate(now), night, ZONE_LUCK[zone]);
      const config = fishingConfig(fish, rod.level);
      run.current = {
        barY: 0.4,
        barVel: 0,
        barH: config.barHeight,
        fishY: 0.5,
        fishTarget: 0.5,
        fishTimer: 0.4,
        progress: 0.32,
        fillRate: config.fillRate,
        drainRate: config.drainRate,
        fishSpeed: config.fishSpeed,
        motion: fish.motion,
        active: true,
      };
      paint();
      setHooked(fish);
      setPhase("hooked");
      sound.chime();
    }, delay * 1000);
    return () => window.clearTimeout(timer);
  }, [zone, rod.level, paint]);

  /* Ván đầu tự thả cần để người chơi không phải bấm hai lần mới thấy gì. */
  useEffect(() => {
    const cancel = cast();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone]);

  /* ---------------------------- vòng lặp ---------------------------- */
  useEffect(() => {
    if (phase !== "hooked" || !hooked) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = run.current;
      if (!s.active) return;

      /* khung giữ cá */
      s.barVel += (holding.current ? LIFT : 0) * dt - GRAVITY * dt;
      s.barVel -= s.barVel * DAMPING * dt;
      s.barY += s.barVel * dt;
      const ceiling = 1 - s.barH;
      if (s.barY < 0) {
        s.barY = 0;
        s.barVel = Math.max(0, s.barVel);
      } else if (s.barY > ceiling) {
        s.barY = ceiling;
        s.barVel = Math.min(0, s.barVel);
      }

      /* con cá */
      s.fishTimer -= dt;
      if (s.fishTimer <= 0) {
        s.fishTarget = nextFishTarget(s.motion, s.fishY);
        s.fishTimer = 0.35 + Math.random() * 1.0;
      }
      const delta = s.fishTarget - s.fishY;
      s.fishY += Math.sign(delta) * Math.min(Math.abs(delta), s.fishSpeed * dt);
      s.fishY = Math.max(0, Math.min(1, s.fishY));

      /* tiến trình */
      const inside = s.fishY >= s.barY && s.fishY <= s.barY + s.barH;
      s.progress += (inside ? s.fillRate : -s.drainRate) * dt;
      paint();

      if (s.progress >= 1) {
        s.active = false;
        const weight = rollWeight(hooked);
        const value = fishValue(hooked, weight);
        const fresh = !state.fish[hooked.id];
        setResult({ fish: hooked, weight, value, fresh });
        setPhase("caught");
        sound.levelUp();
        onLanded(hooked, weight, value);
      } else if (s.progress <= 0) {
        s.active = false;
        setPhase("escaped");
        sound.whoosh();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hooked, paint, onLanded]);

  /* Phím cách điều khiển khung — chuột không phải lựa chọn duy nhất. */
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (phase === "hooked") holding.current = true;
      else if (phase !== "casting") cast();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") holding.current = false;
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, cast]);

  const hold = (value: boolean) => () => {
    holding.current = value;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
          {zone === "vortex" ? t("fs.vortex") : t("fs.shore")}
        </span>
        <span className="font-mono text-[10px] text-gold-300">{t("fs.rod", { n: rod.level })}</span>
      </div>

      {/* ---------------- khung câu ---------------- */}
      <div className="flex gap-2.5 rounded-xl border hairline-gold bg-ink-850/70 p-3">
        <div
          ref={trackRef}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            hold(true)();
          }}
          onPointerUp={hold(false)}
          onPointerCancel={hold(false)}
          onPointerLeave={hold(false)}
          className="relative h-[260px] w-20 shrink-0 cursor-pointer touch-none overflow-hidden rounded-lg border border-jade-500/25"
          style={{ background: "linear-gradient(180deg, rgba(12,52,62,0.9), rgba(4,20,27,0.95))" }}
          aria-label={t("fs.hold")}
        >
          {/* vạch chia cho mắt bám được độ cao */}
          {[0.25, 0.5, 0.75].map((y) => (
            <span key={y} className="absolute left-0 right-0 h-px bg-mist-500/12" style={{ bottom: `${y * 100}%` }} />
          ))}
          {/* `data-rod-*` là móc cho bài kiểm tra tự chơi minigame: vị trí khung
              và cá chỉ tồn tại trong ref, không có cách nào đọc từ ngoài. */}
          <div
            ref={barRef}
            data-rod-bar=""
            className="absolute inset-x-1 rounded-md border border-jade-400/60 bg-jade-500/25"
            style={{ height: "24%", bottom: "36%", boxShadow: "0 0 14px rgba(76,217,154,0.25) inset" }}
          />
          {/* Cá tô đúng màu độ hiếm: nhìn một cái là biết đang vật lộn với con gì. */}
          <div
            ref={fishRef}
            data-rod-fish=""
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: "50%", color: hooked ? RARITY_META[hooked.rarity].color : "#8ba4a7" }}
          >
            <IconFish className="h-[22px] w-[22px]" />
          </div>
          {/* Cột chỉ rộng 80px nên chữ nhét vào đây sẽ vỡ dòng; trạng thái đã có
              chỗ đọc tử tế ở cột bên phải, đây chỉ cần một dấu hiệu thị giác. */}
          {phase !== "hooked" && (
            <div className="absolute inset-0 grid place-items-center bg-ink-950/62">
              <span
                className={`h-2.5 w-2.5 rotate-45 ${
                  phase === "casting" ? "anim-breathe bg-gold-400" : phase === "caught" ? "bg-jade-400" : phase === "escaped" ? "bg-coral-400" : "bg-mist-500"
                }`}
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        {/* thanh tiến trình */}
        <div className="flex w-5 shrink-0 flex-col items-center">
          <div className="relative h-[260px] w-2.5 overflow-hidden rounded-full bg-ink-700">
            <div ref={gaugeRef} className="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-gold-600 to-gold-300" style={{ height: "32%" }} />
          </div>
        </div>

        {/* thông tin ván đang chơi */}
        <div className="min-w-0 flex-1">
          {hooked && phase === "hooked" ? (
            <div className="anim-fade-up">
              <div className="font-display text-[11px] tracking-[0.16em] text-gold-300">{t("fs.bite")}</div>
              <div className="mt-1 text-[14px] font-semibold text-mist-100">{fishName(hooked, state.lang)}</div>
              <div className="mt-1.5">{rarityChip(hooked.rarity, t(`fs.rarity.${hooked.rarity}`))}</div>
              <p className="mt-2.5 text-[10.5px] leading-relaxed text-mist-400">{t("fs.hold")}</p>
            </div>
          ) : result && phase === "caught" ? (
            <div className="anim-pop">
              {result.fresh && <div className="font-display text-[9px] tracking-[0.2em] text-jade-300">{t("fs.newSpecies")}</div>}
              <div className="mt-0.5 text-[14px] font-semibold text-mist-100">{fishName(result.fish, state.lang)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {rarityChip(result.fish.rarity, t(`fs.rarity.${result.fish.rarity}`))}
                <span className="font-mono text-[10px] text-mist-400">{t("fs.weight", { w: result.weight })}</span>
              </div>
              <div className="mt-1.5 font-mono text-[12px] text-gold-300">+{t("fs.coins", { c: result.value })}</div>
              <button onClick={() => cast()} className="btn-gold mt-3 w-full rounded-lg py-2 font-display text-[10px] tracking-[0.14em]">
                {t("fs.recast")}
              </button>
            </div>
          ) : phase === "escaped" ? (
            <div className="anim-fade-up">
              <div className="text-[13px] font-semibold text-coral-400">{t("fs.escaped")}</div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-mist-500">{t("fs.tip")}</p>
              <button onClick={() => cast()} className="btn-gold mt-3 w-full rounded-lg py-2 font-display text-[10px] tracking-[0.14em]">
                {t("fs.recast")}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[11px] leading-relaxed text-mist-400">{phase === "casting" ? t("fs.waiting") : t("fs.tip")}</p>
              {phase !== "casting" && (
                <button onClick={() => cast()} className="btn-gold mt-3 w-full rounded-lg py-2 font-display text-[10px] tracking-[0.14em]">
                  {t("fs.cast")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* tiến độ cần câu */}
      <div>
        <div className="flex items-center justify-between font-mono text-[9.5px] text-mist-500">
          <span>{t("fs.rod", { n: rod.level })}</span>
          <span>{rod.need <= 1 && rod.level >= 5 ? t("fs.rodMax") : t("fs.rodNext", { n: rod.need - rod.have })}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="xp-bar h-full rounded-full transition-all duration-500" style={{ width: `${(rod.have / Math.max(1, rod.need)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Giỏ cá và bộ sưu tập                                              */
/* ================================================================== */

function Basket() {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const grouped = useMemo(() => {
    const map = new Map<string, { n: number; value: number }>();
    for (const entry of state.basket) {
      const row = map.get(entry.id) ?? { n: 0, value: 0 };
      row.n += 1;
      row.value += entry.v;
      map.set(entry.id, row);
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [state.basket]);
  const total = basketValue(state);

  if (!grouped.length) {
    return <p className="rounded-lg border border-dashed border-mist-500/20 p-4 text-center text-[11px] leading-relaxed text-mist-500">{t("fs.basketEmpty")}</p>;
  }

  return (
    <div className="space-y-2">
      {grouped.map(([id, row]) => {
        const fish = FISH_BY_ID.get(id);
        if (!fish) return null;
        return (
          <div key={id} className="flex items-center gap-2.5 rounded-lg border hairline-gold bg-ink-850/55 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12.5px] font-medium text-mist-100">{fishName(fish, state.lang)}</span>
                <span className="shrink-0 font-mono text-[10px] text-mist-500">{t("fs.times", { n: row.n })}</span>
              </div>
              <div className="mt-0.5">{rarityChip(fish.rarity, t(`fs.rarity.${fish.rarity}`))}</div>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-gold-300">{t("fs.coins", { c: row.value })}</span>
            <button
              onClick={() => {
                api.sellFish(id);
                sound.coin();
              }}
              className="btn-ghost shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px]"
            >
              {t("fs.sell")}
            </button>
          </div>
        );
      })}
      <button
        onClick={() => {
          api.sellAll();
          sound.coin();
        }}
        className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-display text-[10.5px] tracking-[0.14em]"
      >
        <IconCoinPurse className="h-4 w-4" />
        {t("fs.sellAll", { c: total })}
      </button>
      <p className="text-center font-mono text-[9.5px] text-mist-500">{t("fs.earned", { c: fmt(state.fishEarned) })}</p>
    </div>
  );
}

function Collection() {
  const { state } = useStore();
  const t = makeT(state.lang);
  const found = Object.keys(state.fish).length;
  const ordered = useMemo(
    () => [...FISH].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.id.localeCompare(b.id)),
    []
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] tracking-[0.2em] text-mist-400">{t("fs.collection")}</span>
        <span className="font-mono text-[10px] text-gold-300">{t("fs.collected", { a: found, b: FISH_COUNT })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full bg-jade-400 transition-all duration-500" style={{ width: `${(found / FISH_COUNT) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ordered.map((fish) => {
          const record = state.fish[fish.id];
          const color = RARITY_META[fish.rarity].color;
          return (
            <div
              key={fish.id}
              className={`rounded-lg border p-2.5 transition-all ${record ? "bg-ink-850/70" : "border-mist-500/12 bg-ink-850/30 opacity-55"}`}
              style={record ? { borderColor: `${color}55` } : undefined}
            >
              <div className="flex items-start justify-between gap-1.5">
                <span className={`text-[11.5px] font-medium ${record ? "text-mist-100" : "text-mist-500"}`}>
                  {record ? fishName(fish, state.lang) : "???"}
                </span>
                {record && <IconCheck className="mt-0.5 h-3 w-3 shrink-0 text-jade-400" />}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {rarityChip(fish.rarity, t(`fs.rarity.${fish.rarity}`))}
                <span className="font-mono text-[8.5px] text-mist-500">
                  {fish.zone === "vortex" ? t("fs.zoneVortex") : fish.zone === "shore" ? t("fs.zoneShore") : t("fs.zoneBoth")}
                </span>
              </div>
              <div className="mt-1 font-mono text-[9px] text-mist-500">
                {record ? `${t("fs.best", { w: record.best })} · ${t("fs.times", { n: record.n })}` : t("fs.never")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Bảng câu cá                                                       */
/* ================================================================== */

export default function FishingPanel({ zone, onClose }: { zone: FishingZone; onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [tab, setTab] = useState<Tab>("game");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const onLanded = useCallback(
    (fish: FishDef, weight: number, value: number) => api.catchFish(fish.id, weight, value),
    [api]
  );

  const basketSize = state.basket.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("fs.title")}
      className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l"
    >
      <div className="flex items-center justify-between border-b border-mist-500/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gold-400"><IconFish className="h-[18px] w-[18px]" /></span>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">{t("fs.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] text-gold-300">
            <IconCoinPurse className="h-3.5 w-3.5" />
            {fmt(state.coins)}
          </span>
          <button onClick={onClose} aria-label={t("misc.close")} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-mist-500/10 px-5 py-2.5">
        <div className="chip flex items-center rounded-lg p-0.5">
          {([
            ["game", t("fs.tabGame")],
            ["basket", `${t("fs.tabBasket")}${basketSize ? ` · ${basketSize}` : ""}`],
            ["book", t("fs.tabBook")],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                sound.tick();
              }}
              className={`flex-1 rounded-md px-2 py-1.5 font-display text-[9.5px] tracking-wider transition-all ${
                tab === id ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "game" && <Rod zone={zone} onLanded={onLanded} />}
        {tab === "basket" && <Basket />}
        {tab === "book" && <Collection />}
      </div>

      <div className="border-t border-mist-500/10 px-5 py-2.5 text-[9.5px] leading-relaxed text-mist-500">
        {zone === "vortex" ? t("fs.vortexSub") : t("fs.vortexHint")}
      </div>
    </div>
  );
}
