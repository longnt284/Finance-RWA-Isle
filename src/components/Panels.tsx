import { useEffect, useState } from "react";
import {
  useStore, CHECKIN_REWARDS, CHECKIN_CYCLE, checkinIndex, checkinReward, QUEST_BY_ID, QUESTS_PER_DAY,
  questDone, questClaimable, xpMult, totalLevels, availableYachtTier,
  YACHT_TIERS, YACHT_REQUIREMENT, MAX_YACHT_TIER,
} from "../state/store";
import type { QualityMode, YachtTier } from "../state/store";
import { makeT } from "../lib/i18n";
import { dayKey } from "../lib/format";
import { sound } from "../lib/audio";
import { SEASONS, WEATHERS, seasonForDate, phaseForHour, autoWeather } from "../lib/season";
import type { Season, WeatherId } from "../lib/season";
import {
  IconClose, IconCalendar, IconFlag, IconCheck, IconGift, IconYacht,
  IconSun, IconMoon, IconSliders, IconLock, IconCloud,
} from "./icons";

function PanelShell({
  title, icon, onClose, children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { state } = useStore();
  const t = makeT(state.lang);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l"
    >
      <div className="flex items-center justify-between border-b border-mist-500/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gold-400">{icon}</span>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">{title}</h2>
        </div>
        <button onClick={onClose} aria-label={t("misc.close")} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

/* ================================================================== */
/*  Điểm danh + nhiệm vụ hằng ngày                                     */
/* ================================================================== */

export function QuestsPanel({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const claimedToday = state.lastClaim === dayKey(Date.now());
  /* Ô đang sáng là mốc sắp nhận; đã điểm danh rồi thì đó là mốc vừa nhận. */
  const activeIndex = checkinIndex(state);
  const multiplier = xpMult(state.streak);
  const doneCount = state.quests.ids.filter((id) => questDone(state, id)).length;

  return (
    <PanelShell title={t("ci.title")} icon={<IconCalendar className="h-[18px] w-[18px]" />} onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {/* ------------------------------ điểm danh ------------------------------ */}
        <section>
          <p className="text-[11.5px] leading-relaxed text-mist-400">{t("ci.sub")}</p>

          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {CHECKIN_REWARDS.map((reward, index) => {
              const passed = claimedToday ? index <= state.checkinDay : index < activeIndex;
              const isActive = index === activeIndex;
              const isFinal = index === CHECKIN_CYCLE - 1;
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-all duration-200 ${
                    isActive && !claimedToday
                      ? "border-gold-400/70 bg-gold-500/12 anim-breathe"
                      : passed
                        ? "border-jade-500/45 bg-jade-500/8"
                        : isFinal
                          ? "border-gold-500/25 bg-ink-850/60"
                          : "border-mist-500/15 bg-ink-850/45"
                  }`}
                >
                  <span className={`font-mono text-[8.5px] ${passed ? "text-jade-400" : isActive ? "text-gold-300" : "text-mist-500"}`}>
                    {index + 1}
                  </span>
                  {passed ? (
                    <IconCheck className="h-3.5 w-3.5 text-jade-400" />
                  ) : (
                    <IconGift className={`h-3.5 w-3.5 ${isActive ? "text-gold-300" : isFinal ? "text-gold-500/70" : "text-mist-500/70"}`} />
                  )}
                  <span className={`font-mono text-[8px] ${isFinal ? "text-gold-300" : "text-mist-500"}`}>{reward}</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              api.claimDaily();
              sound.chime();
            }}
            disabled={claimedToday}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-[11px] tracking-[0.14em] transition-all ${
              claimedToday
                ? "cursor-not-allowed border border-jade-500/35 bg-jade-500/8 text-jade-300"
                : "btn-gold glow-pulse"
            }`}
          >
            {claimedToday ? (
              <>
                <IconCheck className="h-4 w-4" /> {t("ci.claimed")}
              </>
            ) : (
              <>
                <IconGift className="h-4 w-4" />
                {t("ci.claim")} · {t("ci.reward", { x: Math.round(checkinReward(activeIndex) * multiplier) })}
              </>
            )}
          </button>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-mist-500">
            <span>{claimedToday ? t("ci.next") : t("ci.broken")}</span>
            <span>{t("ci.total", { n: state.claims })}</span>
          </div>
        </section>

        {/* ------------------------------ nhiệm vụ ngày ------------------------------ */}
        <section className="border-t border-mist-500/12 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-display text-[10px] tracking-[0.22em] text-mist-400">
              <IconFlag className="h-3.5 w-3.5 text-gold-400" />
              {t("qs.title")}
            </h3>
            <span className="font-mono text-[10px] text-mist-500">{t("qs.count", { done: doneCount, total: QUESTS_PER_DAY })}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-mist-500">{t("qs.sub")}</p>

          <div className="mt-3 space-y-2">
            {state.quests.ids.map((id) => {
              const def = QUEST_BY_ID.get(id);
              if (!def) return null;
              const progress = Math.min(def.target, state.quests.progress[id] ?? 0);
              const complete = questDone(state, id);
              const claimed = state.quests.claimed.includes(id);
              const claimable = questClaimable(state, id);
              const reward = Math.round(def.xp * multiplier);
              return (
                <div
                  key={id}
                  className={`rounded-xl border p-3.5 transition-all duration-200 ${
                    claimed ? "border-jade-500/35 bg-jade-500/6" : claimable ? "border-gold-400/60 bg-gold-500/10" : "hairline-gold bg-ink-850/55"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-[13px] font-semibold ${claimed ? "text-jade-300" : "text-mist-100"}`}>{t(`quest.${id}.n`)}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-mist-500">{t(`quest.${id}.d`)}</div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-gold-300">+{reward} XP</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-jade-400" : "bg-gradient-to-r from-gold-600 to-gold-300"}`}
                        style={{ width: `${(progress / def.target) * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[9.5px] text-mist-500">{t("misc.of", { a: progress, b: def.target })}</span>
                    {claimed ? (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[9.5px] text-jade-400">
                        <IconCheck className="h-3 w-3" /> {t("qs.claimed")}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          api.claimQuest(id);
                          sound.coin();
                        }}
                        disabled={!claimable}
                        className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] transition-all ${
                          claimable ? "btn-gold" : "cursor-not-allowed border border-mist-500/25 text-mist-500"
                        }`}
                      >
                        {claimable ? t("qs.claim") : t("qs.doing")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.quests.claimed.length >= QUESTS_PER_DAY && (
            <p className="mt-3 rounded-lg border border-dashed border-jade-500/30 p-3 text-center text-[11px] text-jade-300">{t("qs.allDone")}</p>
          )}
          <p className="mt-2 text-center font-mono text-[9.5px] text-mist-500">{t("qs.resetAt")}</p>
        </section>
      </div>
    </PanelShell>
  );
}

/* ================================================================== */
/*  Khí hậu, thời gian và xưởng du thuyền                              */
/* ================================================================== */

function moonLabelKey(phase: number): string {
  if (phase < 0.06 || phase > 0.94) return "moon.new";
  if (phase < 0.44) return "moon.waxing";
  if (phase < 0.56) return "moon.full";
  return "moon.waning";
}

function moonPhaseNow(date: Date): number {
  const synodic = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNewMoon) / 86400000;
  return (((days % synodic) + synodic) % synodic) / synodic;
}

export function WorldPanel({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const liveSeason = seasonForDate(now);
  const livePhase = phaseForHour(now.getHours() + now.getMinutes() / 60);
  const isNight = livePhase === "night" || livePhase === "dusk";
  const liveWeather = autoWeather(now, liveSeason, isNight);
  const manual = state.world.mode === "manual";
  const shownSeason: Season = manual ? state.world.season : liveSeason;
  const shownWeather: WeatherId = manual ? state.world.weather : liveWeather;

  const levels = totalLevels(state);
  const available = availableYachtTier(state);

  return (
    <PanelShell title={t("wd.title")} icon={<IconSliders className="h-[18px] w-[18px]" />} onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {/* ------------------------------ hiện tại ------------------------------ */}
        <section className="rounded-xl border hairline-gold bg-ink-850/60 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist-500">{t("wd.now")}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              [<IconSun key="p" className="h-3.5 w-3.5" />, t(`phase.${livePhase}`)],
              [<IconCloud key="s" className="h-3.5 w-3.5" />, t(`season.${liveSeason}`)],
              [<IconMoon key="m" className="h-3.5 w-3.5" />, t(moonLabelKey(moonPhaseNow(now)))],
              [<IconSliders key="w" className="h-3.5 w-3.5" />, t(`weather.${shownWeather}`)],
            ] as [React.ReactNode, string][]).map(([icon, label], index) => (
              <div key={index} className="chip flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] text-mist-300">
                <span className="text-gold-400">{icon}</span>
                {label}
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[10.5px] leading-relaxed text-mist-500">{t("wd.sub")}</p>
        </section>

        {/* ------------------------------ tự động / tự chọn ------------------------------ */}
        <section>
          <div className="chip flex items-center rounded-lg p-0.5">
            {(["auto", "manual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  /* Chuyển sang tự chọn thì lấy luôn cảnh đang hiển thị làm điểm khởi đầu. */
                  api.setWorld(mode === "manual" ? { mode, season: shownSeason, weather: shownWeather } : { mode });
                  sound.tick();
                }}
                className={`flex-1 rounded-md px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                  state.world.mode === mode ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {mode === "auto" ? t("wd.auto") : t("wd.manual")}
              </button>
            ))}
          </div>

          <div className={`mt-3 space-y-3 transition-opacity duration-200 ${manual ? "" : "pointer-events-none opacity-40"}`}>
            <div>
              <div className="mb-1.5 font-display text-[9px] tracking-[0.22em] text-mist-500">{t("wd.season")}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {SEASONS.map((season) => (
                  <button
                    key={season}
                    onClick={() => {
                      api.setWorld({ season });
                      sound.tick();
                    }}
                    className={`rounded-lg border px-2 py-2 font-display text-[10px] transition-all ${
                      shownSeason === season ? "border-gold-400/65 bg-gold-500/12 text-gold-300" : "hairline-gold bg-ink-850/55 text-mist-400 hover:border-gold-500/40"
                    }`}
                  >
                    {t(`season.${season}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-display text-[9px] tracking-[0.22em] text-mist-500">{t("wd.weather")}</div>
              <div className="flex flex-wrap gap-1.5">
                {WEATHERS.map((weather) => (
                  <button
                    key={weather}
                    onClick={() => {
                      api.setWorld({ weather });
                      sound.tick();
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[11px] transition-all ${
                      shownWeather === weather ? "border-jade-500/60 bg-jade-500/12 text-jade-300" : "hairline-gold bg-ink-850/55 text-mist-400 hover:border-gold-500/40"
                    }`}
                  >
                    {t(`weather.${weather}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------ chất lượng ------------------------------ */}
        <section className="border-t border-mist-500/12 pt-4">
          <div className="mb-1.5 font-display text-[9px] tracking-[0.22em] text-mist-500">{t("wd.quality")}</div>
          <div className="chip flex items-center rounded-lg p-0.5">
            {(["auto", "high", "balanced"] as QualityMode[]).map((quality) => (
              <button
                key={quality}
                onClick={() => {
                  api.setWorld({ quality });
                  sound.tick();
                }}
                className={`flex-1 rounded-md px-2 py-2 font-mono text-[10px] transition-all ${
                  state.world.quality === quality ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {quality === "auto" ? t("wd.qualityAuto") : quality === "high" ? t("wd.qualityHigh") : t("wd.qualityBalanced")}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              api.setWorld({ effects: !state.world.effects });
              sound.tick();
            }}
            className="mt-2 flex w-full items-center justify-between rounded-lg border hairline-gold bg-ink-850/55 px-3 py-2.5 text-[12px] text-mist-300 transition-colors hover:border-gold-500/40"
          >
            {t("wd.effects")}
            <span className={`flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${state.world.effects ? "justify-end bg-jade-500/70" : "justify-start bg-ink-700"}`}>
              <span className="h-3 w-3 rounded-full bg-mist-100" />
            </span>
          </button>
        </section>

        {/* ------------------------------ xưởng du thuyền ------------------------------ */}
        <section className="border-t border-mist-500/12 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-display text-[10px] tracking-[0.22em] text-mist-400">
              <IconYacht className="h-3.5 w-3.5 text-gold-400" />
              {t("yacht.hangar")}
            </h3>
            <span className="font-mono text-[10px] text-mist-500">{t("yacht.have", { n: levels })}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-mist-500">{t("yacht.hint")}</p>

          <div className="mt-3 space-y-1.5">
            {YACHT_TIERS.map((tier: YachtTier) => {
              const owned = tier <= state.yachtTier;
              const isCurrent = tier === state.yachtTier;
              const unlocked = tier <= available;
              return (
                <div
                  key={tier}
                  className={`rounded-xl border p-3 transition-all duration-200 ${
                    isCurrent ? "border-gold-400/60 bg-gold-500/10" : owned ? "border-jade-500/30 bg-jade-500/5" : unlocked ? "hairline-gold bg-ink-850/60" : "border-mist-500/15 bg-ink-850/35 opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {!unlocked && <IconLock className="h-3.5 w-3.5 shrink-0 text-mist-500" />}
                      <span className={`truncate text-[12.5px] font-semibold ${isCurrent ? "text-gold-300" : owned ? "text-jade-300" : "text-mist-300"}`}>
                        {t(`yacht.tier${tier}`)}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-mist-500">
                      {isCurrent ? t("yacht.current") : t("yacht.req", { n: YACHT_REQUIREMENT[tier] })}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-snug text-mist-500">{t(`yacht.tier${tier}.d`)}</p>
                </div>
              );
            })}
          </div>

          {state.yachtTier >= MAX_YACHT_TIER ? (
            <p className="mt-3 text-center font-mono text-[10.5px] text-gold-300">{t("yacht.max")}</p>
          ) : available > state.yachtTier ? (
            <button
              onClick={() => {
                api.upgradeYacht();
                sound.levelUp();
              }}
              className="btn-gold glow-pulse mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-[11px] tracking-[0.14em]"
            >
              <IconYacht className="h-4 w-4" />
              {t("yacht.upgrade", { n: t(`yacht.tier${state.yachtTier + 1}`) })}
            </button>
          ) : (
            <p className="mt-3 text-center font-mono text-[10.5px] text-mist-500">
              {t("yacht.req", { n: YACHT_REQUIREMENT[(state.yachtTier + 1) as YachtTier] })}
            </p>
          )}
        </section>
      </div>
    </PanelShell>
  );
}
