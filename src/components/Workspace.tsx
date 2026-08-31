import { useMemo, useState } from "react";
import {
  useStore, DISTRICTS, xpIntoLevel, cityLevel, netWorth, levelFor, xpMult,
  ACH_DEFS, DISTRICT_IDS, ISLE_UNLOCK_LEVELS, LEVEL_XP, MAX_LEVEL, pendingExamLevel, renderLog,
} from "../state/store";
import type { DistrictId, Goal, Task, ViewId, AchTier, IslandTheme } from "../state/store";
import { makeT } from "../lib/i18n";
import { compactVND, fmt, fmtMoney, fmtSmart, pct, timeAgo, USD_RATE } from "../lib/format";
import { sound } from "../lib/audio";
import {
  IconCheck, IconClose, IconPlus, IconTarget, IconMedal, IconReset,
  IconIsland, IconLock, IconSpark, IconBrain,
} from "./icons";
import { DECOR_IDS } from "../lib/decor";

/* ------------------------------ sparkline ------------------------------ */

function Sparkline({ values }: { values: number[] }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const W = 320, H = 72, P = 4;
  const path = useMemo(() => {
    if (values.length < 2) return { line: "", area: "" };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const pts = values.map((v, i) => {
      const x = P + (i / (values.length - 1)) * (W - P * 2);
      const y = H - P - ((v - min) / span) * (H - P * 2);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - P} L${pts[0][0].toFixed(1)},${H - P} Z`;
    return { line, area };
  }, [values]);

  if (values.length < 2) {
    return <div className="flex h-[72px] items-center justify-center text-[11px] text-mist-500">{t("ws.sparkNeed")}</div>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full">
      <defs>
        <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0aa50" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e0aa50" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#nw-fill)" />
      <path d={path.line} fill="none" stroke="#f0c268" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ level header ------------------------------ */

/** Thanh 15 đoạn — đọc được cấp hiện tại và quãng đường còn lại chỉ bằng một liếc mắt. */
function LevelLadder({ district, level, pending }: { district: DistrictId; level: number; pending: number | null }) {
  return (
    <div className="flex items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: MAX_LEVEL }).map((_, i) => {
        const reached = i < level;
        const isPending = pending !== null && i === pending - 1;
        return (
          <span
            key={i}
            className={`h-2.5 w-[3px] rounded-sm transition-all duration-300 ${isPending ? "anim-breathe" : ""}`}
            style={{
              background: reached ? DISTRICTS[district].accent : isPending ? `${DISTRICTS[district].accent}66` : "rgba(139,164,167,0.18)",
            }}
          />
        );
      })}
    </div>
  );
}

function LevelHeader({ district, onExam }: { district: DistrictId; onExam?: (district: DistrictId) => void }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const xp = state.xp[district];
  const lv = state.certified[district];
  const eligible = levelFor(xp);
  const pending = pendingExamLevel(state, district);
  const prog = xpIntoLevel(xp);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{t(`d.${district}.name`)}</div>
        <LevelLadder district={district} level={lv} pending={pending} />
      </div>
      <div className="mt-1 font-display text-lg font-semibold text-mist-100">{t(`d.${district}.building`)}</div>
      <div className="text-[11px] text-mist-500">{t(`d.${district}.tagline`)}</div>
      <div className="mt-3">
        <div className="flex items-center justify-between font-mono text-[10px] text-mist-500">
          <span>{t("ws.lvl", { n: lv })}{lv >= MAX_LEVEL ? ` · ${t("ws.max")}` : ""}</span>
          <span>{eligible >= MAX_LEVEL ? `${fmt(xp)} XP` : `${fmt(prog.have)}/${fmt(prog.need)} XP`}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="xp-bar h-full rounded-full transition-all duration-700" style={{ width: `${prog.pct}%` }} />
        </div>
      </div>
      {pending !== null && onExam ? (
        <button
          onClick={() => {
            onExam(district);
            sound.whoosh();
          }}
          className="btn-gold glow-pulse mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2 font-display text-[10px] tracking-[0.14em]"
        >
          <IconBrain className="h-3.5 w-3.5" />
          {t("exam.ready", { n: pending })}
        </button>
      ) : (
        <div className="mt-1.5 font-mono text-[9px] text-mist-500">
          {lv >= MAX_LEVEL ? t("exam.maxed", { n: MAX_LEVEL }) : t("hud.mult", { x: xpMult(state.streak).toFixed(2) })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ goals ------------------------------ */

function units(lang: string) {
  return lang === "vi" ? ["tr ₫", "BTC", "ETH", "giờ", "buổi", "%"] : ["M ₫", "BTC", "ETH", "hours", "sessions", "%"];
}

function GoalCard({ goal }: { goal: Goal }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const p = pct(goal.current, goal.target);
  return (
    <div className={`rounded-lg border p-3 transition-colors ${goal.done ? "border-jade-500/40 bg-jade-500/5" : "hairline-gold bg-ink-850/60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <IconTarget className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${goal.done ? "text-jade-400" : "text-gold-400"}`} />
          <div className={`text-[13px] font-medium ${goal.done ? "text-jade-300 line-through decoration-jade-500/50" : "text-mist-100"}`}>{goal.title}</div>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-gold-300">{p}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300 transition-all duration-500" style={{ width: `${p}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-mist-500">
          {fmtSmart(goal.current)} / {fmtSmart(goal.target)} {goal.unit}
        </span>
        {!goal.done && (
          <div className="flex gap-1">
            {[10, 25].map((inc) => (
              <button
                key={inc}
                onClick={() => {
                  sound.coin();
                  api.setGoalProgress(goal.id, goal.current + (goal.target * inc) / 100);
                }}
                className="btn-ghost rounded px-1.5 py-0.5 font-mono text-[10px]"
              >
                +{inc}%
              </button>
            ))}
            <button
              onClick={() => {
                sound.levelUp();
                api.setGoalProgress(goal.id, goal.target);
              }}
              className="rounded border border-jade-500/40 px-1.5 py-0.5 font-mono text-[10px] text-jade-400 transition-colors hover:bg-jade-500/10"
            >
              {t("ws.done")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddGoal({ district }: { district: DistrictId }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("100");
  const [unit, setUnit] = useState(units(state.lang)[0]);
  return (
    <div>
      {open ? (
        <div className="anim-fade-up rounded-lg border border-gold-500/25 bg-ink-850 p-3">
          <input
            className="field w-full rounded-md px-2.5 py-2 text-[13px] text-mist-100"
            placeholder={t("ws.goalPh")}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                api.addGoal({ title: title.trim(), district, target: Math.max(1, parseFloat(target) || 1), unit });
                setTitle("");
                setOpen(false);
                sound.chime();
              }
            }}
          />
          <div className="mt-2 flex gap-2">
            <input
              className="field w-24 rounded-md px-2.5 py-1.5 font-mono text-[12px] text-mist-100"
              value={target}
              inputMode="decimal"
              onChange={(e) => setTarget(e.target.value)}
            />
            <select className="field rounded-md px-2 py-1.5 text-[12px] text-mist-100" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units(state.lang).map((u) => <option key={u} value={u} className="bg-ink-850">{u}</option>)}
            </select>
            <button
              className="btn-gold ml-auto rounded-md px-3 py-1.5 font-display text-[10px] tracking-wider"
              onClick={() => {
                if (!title.trim()) return;
                api.addGoal({ title: title.trim(), district, target: Math.max(1, parseFloat(target) || 1), unit });
                setTitle("");
                setOpen(false);
                sound.chime();
              }}
            >
              {t("ws.create")}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-ghost flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[12px]">
          <IconPlus className="h-3.5 w-3.5" /> {t("ws.addGoal")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------ tasks ------------------------------ */

function TaskRow({ task }: { task: Task }) {
  const { state, api } = useStore();
  const gained = Math.round(task.xp * xpMult(state.streak));
  return (
    <div className="group flex items-center gap-2.5 py-1.5">
      <button
        onClick={() => {
          if (!task.done) sound.chime();
          api.toggleTask(task.id);
        }}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-all ${
          task.done ? "border-jade-500 bg-jade-500 text-ink-950" : "border-mist-500/50 hover:border-gold-400"
        }`}
      >
        {task.done && <IconCheck className="h-3 w-3" />}
      </button>
      <span className={`min-w-0 flex-1 truncate text-[13px] ${task.done ? "text-mist-500 line-through" : "text-mist-300"}`}>{task.title}</span>
      <span className="shrink-0 font-mono text-[10px] text-gold-400/80">+{gained} XP</span>
    </div>
  );
}

function AddTask({ district }: { district: DistrictId }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [title, setTitle] = useState("");
  const [xp, setXp] = useState(25);
  return (
    <div className="flex items-center gap-2 border-t border-mist-500/10 pt-2.5">
      <input
        className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-[12px] text-mist-100"
        placeholder={t("ws.taskPh")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            api.addTask(district, title.trim(), xp);
            setTitle("");
            sound.tick();
          }
        }}
      />
      <select className="field rounded-md px-1.5 py-1.5 font-mono text-[11px] text-mist-100" value={xp} onChange={(e) => setXp(parseInt(e.target.value, 10))}>
        {[10, 15, 25, 40, 60].map((v) => <option key={v} value={v} className="bg-ink-850">+{v}</option>)}
      </select>
      <button
        className="btn-ghost rounded-md p-1.5"
        onClick={() => {
          if (!title.trim()) return;
          api.addTask(district, title.trim(), xp);
          setTitle("");
          sound.tick();
        }}
      >
        <IconPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function QuickActions({ district }: { district: DistrictId }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  return (
    <div className="flex flex-wrap gap-1.5">
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          onClick={() => {
            api.logTrade(district, `qa.${district}.${i}`);
            sound.coin();
          }}
          className="chip rounded-full px-2.5 py-1 text-[11px] text-mist-300 transition-all hover:border-gold-500/40 hover:text-gold-300"
        >
          {t(`qa.${district}.${i}`)} <span className="ml-1 font-mono text-[9px] text-gold-400">+{Math.round(18 * xpMult(state.streak))}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ vault ------------------------------ */

function VaultExtra() {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const nw = netWorth(state);
  const [val, setVal] = useState("");
  const values = state.snapshots.map((s) => s.v);
  const prev = values.length > 1 ? values[values.length - 2] : null;
  const delta = prev !== null && nw !== null ? nw - prev : null;
  /* Ô nhập theo đúng đơn vị đang hiển thị: gõ "12000" khi đang xem USD nghĩa là
     12.000 đô, không phải 12.000 đồng. Kho vẫn lưu gốc VND. */
  function submit() {
    const amount = parseFloat(val);
    if (!Number.isFinite(amount) || amount <= 0) return;
    api.logNetWorth(Math.round(state.currency === "USD" ? amount * USD_RATE : amount));
    setVal("");
    sound.coin();
  }
  return (
    <div className="rounded-lg border border-gold-500/20 bg-ink-850/70 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{t("ws.networth")}</span>
        {delta !== null && (
          <span className={`font-mono text-[11px] ${delta >= 0 ? "text-jade-400" : "text-coral-400"}`}>
            {delta >= 0 ? "+" : ""}{fmtMoney(delta, state.currency)}
          </span>
        )}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-gold-300">{nw === null ? "—" : fmtMoney(nw, state.currency)}</div>
      {nw !== null && state.currency === "USD" && <div className="font-mono text-[10px] text-mist-500">{compactVND(nw)}</div>}
      <div className="mt-2"><Sparkline values={values} /></div>
      <div className="mt-2 flex gap-2">
        <input
          className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 font-mono text-[12px] text-mist-100"
          placeholder={t(state.currency === "USD" ? "ws.nwPhUsd" : "ws.nwPh")}
          value={val}
          inputMode="decimal"
          onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val) {
              submit();
            }
          }}
        />
        <button className="btn-gold rounded-md px-3 py-1.5 font-display text-[10px] tracking-wider" onClick={submit}>
          {t("ws.record")}
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-mist-500">{t("ws.snapshots", { n: state.snapshots.length })}</div>
    </div>
  );
}

/* ------------------------------ district panel ------------------------------ */

function DistrictPanel({ district, onClose, onExam }: { district: DistrictId; onClose: () => void; onExam: (district: DistrictId) => void }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  const goals = state.goals.filter((g) => g.district === district);
  const tasks = state.tasks.filter((tk) => tk.district === district);
  const done = tasks.filter((tk) => tk.done).length;
  return (
    <div className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l">
      <div className="flex items-start justify-between border-b border-mist-500/10 p-5 pb-4">
        <LevelHeader district={district} onExam={onExam} />
        <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {district === "vault" && <VaultExtra />}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ws.goals")}</h3>
            <span className="font-mono text-[10px] text-mist-500">{goals.filter((g) => g.done).length}/{goals.length}</span>
          </div>
          <div className="space-y-2">
            {goals.length === 0 && (
              <p className="rounded-lg border border-dashed border-mist-500/20 p-3 text-center text-[11px] text-mist-500">{t("ws.noGoals")}</p>
            )}
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
            <AddGoal district={district} />
          </div>
        </section>

        <section>
          <h3 className="mb-1 font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ws.quick")}</h3>
          <QuickActions district={district} />
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ws.tasks")}</h3>
            <span className="font-mono text-[10px] text-mist-500">{done}/{tasks.length}</span>
          </div>
          <div className="divide-y divide-mist-500/8">
            {tasks.length === 0 && <p className="py-2 text-center text-[11px] text-mist-500">{t("ws.noTasks")}</p>}
            {tasks.map((tk) => <TaskRow key={tk.id} task={tk} />)}
          </div>
          <div className="mt-2"><AddTask district={district} /></div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ isle panel ------------------------------ */

function IslePanel({
  onClose, activeIsle, onIslandSelect, onExam,
}: {
  onClose: () => void;
  activeIsle: DistrictId;
  onIslandSelect: (district: DistrictId) => void;
  onExam: (district: DistrictId) => void;
}) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const lv = state.certified[activeIsle];
  const unlockLevel = ISLE_UNLOCK_LEVELS[activeIsle];
  const unlocked = lv >= unlockLevel;
  const prog = xpIntoLevel(state.xp[activeIsle]);

  if (!unlocked) {
    return (
      <div className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l">
        <div className="flex items-start justify-between border-b border-mist-500/10 p-5 pb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{t(`ct.isle.${activeIsle}`)}</div>
            <div className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-mist-100">
              <IconLock className="h-4 w-4 text-gold-400" /> {t("il.locked")}
            </div>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-[12.5px] leading-relaxed text-mist-400">{t("il.lockedSub", { n: unlockLevel })}</p>
          <div className="rounded-xl border border-gold-500/20 bg-ink-850/60 p-4">
            <div className="flex justify-between font-mono text-[10px] text-mist-500">
              <span>{t(`d.${activeIsle}.building`)}</span>
              <span>{t("ws.lvl", { n: lv })} → {t("misc.levelShort", { n: unlockLevel })}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
              <div className="xp-bar h-full rounded-full transition-all duration-700" style={{ width: `${(Math.min(lv, unlockLevel) / unlockLevel) * 100}%` }} />
            </div>
            <div className="mt-2 font-mono text-[10px] text-mist-500">
              {lv >= MAX_LEVEL ? t("il.max", { n: MAX_LEVEL }) : t("il.progress", { have: fmt(prog.have), need: fmt(prog.need) })} · {fmt(LEVEL_XP[unlockLevel])} XP
            </div>
            {pendingExamLevel(state, activeIsle) !== null && (
              <button
                onClick={() => {
                  onExam(activeIsle);
                  sound.whoosh();
                }}
                className="btn-gold glow-pulse mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-display text-[10px] tracking-[0.14em]"
              >
                <IconBrain className="h-3.5 w-3.5" />
                {t("exam.ready", { n: pendingExamLevel(state, activeIsle) ?? lv + 1 })}
              </button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-mist-500">{t("il.lvHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l">
      <div className="flex items-start justify-between border-b border-mist-500/10 p-5 pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-jade-400/80">{t(`ct.isle.${activeIsle}`)}</div>
          <div className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-mist-100">
            <IconIsland className="h-5 w-5 text-jade-400" /> {t(`ct.isle.${activeIsle}`)}
          </div>
          <div className="text-[11px] text-mist-500">{t(`d.${activeIsle}.tagline`)}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="chip rounded-full px-2.5 py-1 font-mono text-[10px] text-jade-300">{t("ws.lvl", { n: lv })}</span>
            {lv < MAX_LEVEL && (
              <span className="font-mono text-[10px] text-mist-500">{t("il.progress", { have: fmt(prog.have), need: fmt(prog.need) })}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <div className="mb-2 font-display text-[9px] tracking-[0.22em] text-mist-500">{t("il.choose")}</div>
          <div className="grid grid-cols-2 gap-2">
            {DISTRICT_IDS.map((district) => {
              const districtLv = state.certified[district];
              const districtUnlocked = districtLv >= ISLE_UNLOCK_LEVELS[district];
              return (
                <button
                  key={district}
                  onClick={() => onIslandSelect(district)}
                  className={`rounded-lg border px-3 py-2 text-left transition-all ${activeIsle === district ? "border-jade-500/55 bg-jade-500/10 text-jade-300" : districtUnlocked ? "hairline-gold bg-ink-850/60 text-mist-300 hover:border-gold-500/40" : "border-mist-500/12 text-mist-500"}`}
                >
                  <span className="block text-[10.5px] font-medium">{t(`ct.isle.${district}`)}</span>
                  <span className="font-mono text-[8.5px]">{districtUnlocked ? t("ct.isle.unlockedShort") : `${t("misc.levelShort", { n: districtLv })}/${ISLE_UNLOCK_LEVELS[district]}`}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border hairline-gold bg-ink-850/60 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ws.goals")} · {t(`d.${activeIsle}.name`)}</h3>
            <span className="font-mono text-[10px] text-mist-500">{state.goals.filter((g) => g.district === activeIsle && g.done).length}/{state.goals.filter((g) => g.district === activeIsle).length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {state.goals.filter((g) => g.district === activeIsle).map((g) => <GoalCard key={g.id} goal={g} />)}
            <AddGoal district={activeIsle} />
          </div>
          <div className="mt-3">
            <QuickActions district={activeIsle} />
          </div>
        </div>

        <section>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">{t("il.decor")}</h3>
            <IconSpark className="h-3.5 w-3.5 text-gold-400" />
          </div>
          <p className="mb-2 text-[10.5px] text-mist-500">{t("il.decorHint")}</p>
          <div className="grid grid-cols-2 gap-2">
            {DECOR_IDS.map((id) => {
              const on = state.isleDecor[activeIsle].includes(id);
              return (
                <button
                  key={id}
                  onClick={() => {
                    api.toggleDecor(activeIsle, id);
                    sound.coin();
                  }}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-[12px] transition-all ${
                    on
                      ? "border-jade-500/50 bg-jade-500/8 text-jade-300"
                      : "hairline-gold bg-ink-850/60 text-mist-400 hover:border-gold-500/35 hover:text-mist-100"
                  }`}
                >
                  {t(`decor.${id}`)}
                  <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${on ? "justify-end bg-jade-500/70" : "justify-start bg-ink-700"}`}>
                    <span className="h-3 w-3 rounded-full bg-mist-100" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-display text-[10px] tracking-[0.22em] text-mist-400">{t("il.theme")}</h3>
          <div className="grid grid-cols-4 gap-2">
            {(["emerald", "sunset", "lagoon", "violet"] as IslandTheme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => api.setIsleTheme(activeIsle, theme)}
                className={`isle-theme isle-theme-${theme} ${state.isleTheme[activeIsle] === theme ? "is-active" : ""}`}
                title={t(`theme.${theme}`)}
                aria-label={t(`theme.${theme}`)}
              />
            ))}
          </div>
        </section>

        <p className="text-[10.5px] leading-relaxed text-mist-500">{t("il.lvHint")}</p>
      </div>
    </div>
  );
}

/* ------------------------------ center panel ------------------------------ */

const TIER_STYLE: Record<AchTier, string> = {
  easy: "border-jade-500/40 text-jade-400",
  mid: "border-gold-500/40 text-gold-400",
  hard: "border-coral-500/40 text-coral-400",
};

function CenterPanel({ onClose, onIslandSelect }: { onClose: () => void; onIslandSelect: (district: DistrictId) => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const cl = cityLevel(state);
  const totalXp = DISTRICT_IDS.reduce((s, d) => s + state.xp[d], 0);
  const [name, setName] = useState(state.city);
  const [achName, setAchName] = useState("");
  const [achDesc, setAchDesc] = useState("");

  return (
    <div className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l">
      <div className="flex items-start justify-between border-b border-mist-500/10 p-5 pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{t("ct.heart")}</div>
          <div className="mt-1 font-display text-lg font-semibold text-gold-300">{t("ct.title")}</div>
          <div className="text-[11px] text-mist-500">{t("ct.sub")}</div>
        </div>
        <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: t("ct.islandLvl"), v: String(cl) },
            { k: t("ct.totalXp"), v: fmt(totalXp) },
            { k: t("ct.streak"), v: String(state.streak) },
          ].map((s) => (
            <div key={s.k} className="chip rounded-lg px-3 py-2.5 text-center">
              <div className="font-mono text-lg font-semibold text-gold-300">{s.v}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-mist-500">{s.k}</div>
            </div>
          ))}
        </div>

        {/* archipelago */}
        <section>
          <h3 className="mb-2 font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ct.isles")}</h3>
          <div className="space-y-1.5">
            {(["crypto", "stocks", "vault", "academy"] as DistrictId[]).map((d) => {
              const districtLv = state.certified[d];
              const unlockLevel = ISLE_UNLOCK_LEVELS[d];
              const unlocked = districtLv >= unlockLevel;
              return (
                <button onClick={() => onIslandSelect(d)} key={d} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${unlocked ? "border-jade-500/35 bg-jade-500/5 hover:border-jade-500/60" : "hairline-gold bg-ink-850/40 hover:border-gold-500/30"}`}>
                  <IconIsland className={`h-4 w-4 shrink-0 ${unlocked ? "text-jade-400" : "text-mist-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12px] font-medium ${unlocked ? "text-jade-300" : "text-mist-300"}`}>{t(`ct.isle.${d}`)}</div>
                    <div className="font-mono text-[9px] text-mist-500">
                      {unlocked ? t("ct.isle.unlocked") : t("ct.isle.unlockAt", { n: unlockLevel })}
                    </div>
                  </div>
                  {!unlocked && <span className="font-mono text-[10px] text-gold-400">{t("misc.levelShort", { n: districtLv })}/{unlockLevel}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* districts */}
        <section>
          <h3 className="mb-2 font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ct.districts")}</h3>
          <div className="space-y-2">
            {DISTRICT_IDS.map((d) => {
              const lv = state.certified[d];
              return (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-[12px] text-mist-300">{t(`d.${d}.building`)}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(lv / MAX_LEVEL) * 100}%`, background: DISTRICTS[d].accent }} />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-[11px]" style={{ color: DISTRICTS[d].accent }}>{t("misc.levelShort", { n: lv })}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* system achievements */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-display text-[10px] tracking-[0.22em] text-mist-400">
            <IconMedal className="h-3.5 w-3.5 text-gold-400" /> {t("ct.sysAch")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {ACH_DEFS.map((a) => {
              const done = a.done(state);
              return (
                <div key={a.id} className={`rounded-lg border p-2.5 transition-all ${done ? "border-gold-500/45 bg-gold-500/8" : "border-mist-500/15 opacity-55"}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-display text-[10px] tracking-wide ${done ? "text-gold-300" : "text-mist-300"}`}>{t(`ach.${a.id}.n`)}</span>
                    <span className={`chip rounded border px-1 py-px font-mono text-[7.5px] ${TIER_STYLE[a.tier]}`}>{t(`tier.${a.tier}`)}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-mist-500">{t(`ach.${a.id}.d`)}</div>
                  <div className={`mt-1 font-mono text-[9px] ${done ? "text-jade-400" : "text-mist-500"}`}>
                    {done ? `✓ +${a.reward} XP` : `+${a.reward} XP`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* custom achievements */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-display text-[10px] tracking-[0.22em] text-mist-400">
            <IconSpark className="h-3.5 w-3.5 text-jade-400" /> {t("ct.customAch")}
          </h3>
          <div className="space-y-1.5">
            {state.customAch.length === 0 && (
              <p className="rounded-lg border border-dashed border-mist-500/20 p-3 text-center text-[10.5px] text-mist-500">{t("ct.noCustom")}</p>
            )}
            {state.customAch.map((a) => (
              <div key={a.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${a.done ? "border-jade-500/40 bg-jade-500/5" : "hairline-gold bg-ink-850/50"}`}>
                <div className="min-w-0 flex-1">
                  <div className={`text-[12.5px] font-medium ${a.done ? "text-jade-300 line-through decoration-jade-500/50" : "text-mist-100"}`}>{a.name}</div>
                  {a.desc && <div className="text-[10px] text-mist-500">{a.desc}</div>}
                </div>
                {a.done ? (
                  <span className="shrink-0 font-mono text-[9px] text-jade-400">{t("ct.completed")} · +50 XP</span>
                ) : (
                  <button
                    onClick={() => {
                      api.completeCustomAch(a.id);
                      sound.levelUp();
                    }}
                    className="btn-ghost shrink-0 rounded px-2 py-1 font-mono text-[9px]"
                  >
                    {t("ct.complete")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-[12px] text-mist-100"
              placeholder={t("ct.addAch")}
              value={achName}
              onChange={(e) => setAchName(e.target.value)}
            />
            <button
              className="btn-gold rounded-md px-2.5 py-1.5"
              onClick={() => {
                if (!achName.trim()) return;
                api.addCustomAch(achName.trim(), achDesc.trim());
                setAchName("");
                setAchDesc("");
                sound.chime();
              }}
            >
              <IconPlus className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            className="field mt-1.5 w-full rounded-md px-2.5 py-1.5 text-[11px] text-mist-300"
            placeholder={t("ct.achDesc")}
            value={achDesc}
            onChange={(e) => setAchDesc(e.target.value)}
          />
        </section>

        {/* chronicle */}
        <section>
          <h3 className="mb-2 font-display text-[10px] tracking-[0.22em] text-mist-400">{t("ct.log")}</h3>
          <div className="space-y-1.5">
            {state.log.slice(0, 10).map((l) => (
              <div key={l.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-mist-400">{renderLog(t, l)}</span>
                <span className="shrink-0 font-mono text-[9px] text-mist-500">{timeAgo(l.ts, state.lang)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 border-t border-mist-500/10 pt-4">
          <div className="flex gap-2">
            <input className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-[12px] text-mist-100" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-ghost rounded-md px-3 py-1.5 font-display text-[10px]" onClick={() => { api.renameCity(name); sound.tick(); }}>
              {t("ct.rename")}
            </button>
          </div>
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-coral-500/30 py-2 text-[11px] text-coral-400 transition-colors hover:bg-coral-500/10"
            onClick={() => {
              if (window.confirm(t("ct.resetQ"))) api.resetAll();
            }}
          >
            <IconReset className="h-3.5 w-3.5" /> {t("ct.reset")}
          </button>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ root ------------------------------ */

export default function Workspace({
  view, onClose, activeIsle, onIslandSelect, onExam,
}: {
  view: ViewId;
  onClose: () => void;
  onSelect: (v: ViewId, island?: DistrictId) => void;
  activeIsle: DistrictId;
  onIslandSelect: (district: DistrictId) => void;
  onExam: (district: DistrictId) => void;
}) {
  if (view === "overview") return null;
  if (view === "center") return <CenterPanel onClose={onClose} onIslandSelect={onIslandSelect} />;
  if (view === "isle") return <IslePanel onClose={onClose} activeIsle={activeIsle} onIslandSelect={onIslandSelect} onExam={onExam} />;
  return <DistrictPanel district={view} onClose={onClose} onExam={onExam} />;
}
