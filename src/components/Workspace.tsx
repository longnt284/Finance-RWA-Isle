import { useMemo, useState } from "react";
import {
  useStore, DISTRICTS, xpIntoLevel, cityLevel, netWorth, achievements, levelFor,
} from "../state/store";
import type { DistrictId, Goal, Task, ViewId } from "../state/store";
import { compactVND, fmt, fmtSmart, pct, timeAgo } from "../lib/format";
import { sound } from "../lib/audio";
import { IconCheck, IconClose, IconPlus, IconTarget, IconMedal, IconReset } from "./icons";

/* ------------------------------ sparkline ------------------------------ */

function Sparkline({ values }: { values: number[] }) {
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
    return <div className="flex h-[72px] items-center justify-center text-[11px] text-mist-500">Cần ít nhất 2 lần ghi nhận để vẽ đường xu hướng</div>;
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

function LevelHeader({ district }: { district: DistrictId }) {
  const { state } = useStore();
  const xp = state.xp[district];
  const lv = levelFor(xp);
  const prog = xpIntoLevel(xp);
  const meta = DISTRICTS[district];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{meta.label}</div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-2 w-2 rotate-45 ${i < lv ? "" : "opacity-25"}`} style={{ background: meta.accent }} />
          ))}
        </div>
      </div>
      <div className="mt-1 font-display text-lg font-semibold text-mist-100">{meta.building}</div>
      <div className="text-[11px] text-mist-500">{meta.tagline}</div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-mono text-mist-500">
          <span>CẤP {lv}{lv >= 5 ? " · TỐI ĐA" : ""}</span>
          <span>{lv >= 5 ? `${fmt(xp)} XP` : `${prog.have}/${prog.need} XP`}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="xp-bar h-full rounded-full transition-all duration-700" style={{ width: `${prog.pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ goals ------------------------------ */

function GoalCard({ goal }: { goal: Goal }) {
  const { api } = useStore();
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
              ✓ Xong
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddGoal({ district }: { district: DistrictId }) {
  const { api } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("100");
  const [unit, setUnit] = useState("tr ₫");
  return (
    <div>
      {open ? (
        <div className="anim-fade-up rounded-lg border border-gold-500/25 bg-ink-850 p-3">
          <input
            className="field w-full rounded-md px-2.5 py-2 text-[13px] text-mist-100"
            placeholder="Tên mục tiêu — vd: Tích lũy 1 BTC"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && title.trim() && (api.addGoal({ title: title.trim(), district, target: Math.max(1, parseFloat(target) || 1), unit }), setTitle(""), setOpen(false), sound.chime())}
          />
          <div className="mt-2 flex gap-2">
            <input
              className="field w-24 rounded-md px-2.5 py-1.5 font-mono text-[12px] text-mist-100"
              value={target}
              inputMode="decimal"
              onChange={(e) => setTarget(e.target.value)}
            />
            <select className="field rounded-md px-2 py-1.5 text-[12px] text-mist-100" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {["tr ₫", "BTC", "ETH", "giờ", "buổi", "%"].map((u) => <option key={u} value={u} className="bg-ink-850">{u}</option>)}
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
              TẠO
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-ghost flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[12px]">
          <IconPlus className="h-3.5 w-3.5" /> Thêm mục tiêu
        </button>
      )}
    </div>
  );
}

/* ------------------------------ tasks ------------------------------ */

function TaskRow({ task }: { task: Task }) {
  const { api } = useStore();
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
      <span className="shrink-0 font-mono text-[10px] text-gold-400/80">+{task.xp} XP</span>
    </div>
  );
}

function AddTask({ district }: { district: DistrictId }) {
  const { api } = useStore();
  const [title, setTitle] = useState("");
  const [xp, setXp] = useState(25);
  return (
    <div className="flex items-center gap-2 border-t border-mist-500/10 pt-2.5">
      <input
        className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-[12px] text-mist-100"
        placeholder="Nhiệm vụ mới…"
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

/* ------------------------------ district panel ------------------------------ */

function QuickActions({ district }: { district: DistrictId }) {
  const { api } = useStore();
  const actions: Record<DistrictId, string[]> = {
    crypto: ["Mua DCA hôm nay", "Review danh mục on-chain", "Chốt lời một phần"],
    stocks: ["DCA quỹ chỉ số", "Đọc báo cáo tài chính", "Cơ cấu danh mục"],
    vault: ["Chuyển tiền vào tiết kiệm", "Rà soát chi tiêu tháng", "Nộp quỹ khẩn cấp"],
    academy: ["Học 1 giờ hôm nay", "Viết nhật ký giao dịch", "Ôn tập flashcard"],
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions[district].map((a) => (
        <button
          key={a}
          onClick={() => {
            api.logTrade(district, a);
            sound.coin();
          }}
          className="chip rounded-full px-2.5 py-1 text-[11px] text-mist-300 transition-all hover:border-gold-500/40 hover:text-gold-300"
        >
          {a} <span className="ml-1 font-mono text-[9px] text-gold-400">+18</span>
        </button>
      ))}
    </div>
  );
}

function VaultExtra() {
  const { state, api } = useStore();
  const nw = netWorth(state);
  const [val, setVal] = useState("");
  const values = state.snapshots.map((s) => s.v);
  const prev = values.length > 1 ? values[values.length - 2] : null;
  const delta = prev !== null && nw !== null ? nw - prev : null;
  return (
    <div className="rounded-lg border border-gold-500/20 bg-ink-850/70 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">Tài sản ròng</span>
        {delta !== null && (
          <span className={`font-mono text-[11px] ${delta >= 0 ? "text-jade-400" : "text-coral-400"}`}>
            {delta >= 0 ? "+" : ""}{compactVND(delta)}
          </span>
        )}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-gold-300">{nw === null ? "—" : compactVND(nw)}</div>
      <div className="mt-2"><Sparkline values={values} /></div>
      <div className="mt-2 flex gap-2">
        <input
          className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 font-mono text-[12px] text-mist-100"
          placeholder="Nhập tổng tài sản (VNĐ)…"
          value={val}
          inputMode="numeric"
          onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val) {
              api.logNetWorth(parseInt(val, 10));
              setVal("");
              sound.coin();
            }
          }}
        />
        <button
          className="btn-gold rounded-md px-3 py-1.5 font-display text-[10px] tracking-wider"
          onClick={() => {
            if (!val) return;
            api.logNetWorth(parseInt(val, 10));
            setVal("");
            sound.coin();
          }}
        >
          GHI NHẬN
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-mist-500">{state.snapshots.length} lần ghi nhận · mỗi lần +8 XP cho Kim Khố</div>
    </div>
  );
}

function DistrictPanel({ district, onClose }: { district: DistrictId; onClose: () => void }) {
  const { state } = useStore();
  const goals = state.goals.filter((g) => g.district === district);
  const tasks = state.tasks.filter((t) => t.district === district);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="anim-slide-left panel absolute bottom-0 right-0 top-0 z-40 flex w-full flex-col sm:w-[400px]">
      <div className="flex items-start justify-between border-b border-mist-500/10 p-5 pb-4">
        <LevelHeader district={district} />
        <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {district === "vault" && <VaultExtra />}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">MỤC TIÊU</h3>
            <span className="font-mono text-[10px] text-mist-500">{goals.filter((g) => g.done).length}/{goals.length}</span>
          </div>
          <div className="space-y-2">
            {goals.length === 0 && (
              <p className="rounded-lg border border-dashed border-mist-500/20 p-3 text-center text-[11px] text-mist-500">
                Chưa có mục tiêu nào. Mỗi mục tiêu là một cột mốc dựng xây quận này.
              </p>
            )}
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
            <AddGoal district={district} />
          </div>
        </section>

        <section>
          <h3 className="mb-1 font-display text-[10px] tracking-[0.22em] text-mist-400">GHI NHANH HOẠT ĐỘNG</h3>
          <QuickActions district={district} />
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-display text-[10px] tracking-[0.22em] text-mist-400">NHIỆM VỤ</h3>
            <span className="font-mono text-[10px] text-mist-500">{done}/{tasks.length}</span>
          </div>
          <div className="divide-y divide-mist-500/8">
            {tasks.length === 0 && <p className="py-2 text-center text-[11px] text-mist-500">Thêm nhiệm vụ để tích XP nâng cấp công trình.</p>}
            {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
          <div className="mt-2"><AddTask district={district} /></div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ center panel ------------------------------ */

function CenterPanel({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const cl = cityLevel(state);
  const totalXp = (Object.keys(state.xp) as DistrictId[]).reduce((s, d) => s + state.xp[d], 0);
  const ach = achievements(state);
  const [name, setName] = useState(state.city);
  return (
    <div className="anim-slide-left panel absolute bottom-0 right-0 top-0 z-40 flex w-full flex-col sm:w-[400px]">
      <div className="flex items-start justify-between border-b border-mist-500/10 p-5 pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">Trái tim của đảo</div>
          <div className="mt-1 font-display text-lg font-semibold text-gold-300">Hải Đăng Trung Tâm</div>
          <div className="text-[11px] text-mist-500">Mọi con đường trên đảo đều dẫn về đây.</div>
        </div>
        <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: "Cấp đảo", v: String(cl) },
            { k: "Tổng XP", v: fmt(totalXp) },
            { k: "Chuỗi ngày", v: String(state.streak) },
          ].map((s) => (
            <div key={s.k} className="chip rounded-lg px-3 py-2.5 text-center">
              <div className="font-mono text-lg font-semibold text-gold-300">{s.v}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-mist-500">{s.k}</div>
            </div>
          ))}
        </div>

        <section>
          <h3 className="mb-2 font-display text-[10px] tracking-[0.22em] text-mist-400">CÁC QUẬN</h3>
          <div className="space-y-2">
            {(Object.keys(DISTRICTS) as DistrictId[]).map((d) => {
              const lv = levelFor(state.xp[d]);
              return (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[12px] text-mist-300">{DISTRICTS[d].building}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full" style={{ width: `${(lv / 5) * 100}%`, background: DISTRICTS[d].accent }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[11px]" style={{ color: DISTRICTS[d].accent }}>C{lv}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-display text-[10px] tracking-[0.22em] text-mist-400">
            <IconMedal className="h-3.5 w-3.5 text-gold-400" /> THÀNH TỰU
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {ach.map((a) => (
              <div key={a.id} className={`rounded-lg border p-2.5 ${a.done ? "border-gold-500/40 bg-gold-500/8" : "border-mist-500/15 opacity-45"}`}>
                <div className={`font-display text-[10px] tracking-wide ${a.done ? "text-gold-300" : "text-mist-400"}`}>{a.name}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-mist-500">{a.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-display text-[10px] tracking-[0.22em] text-mist-400">NHẬT KÝ ĐẢO</h3>
          <div className="space-y-1.5">
            {state.log.slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-mist-400">{l.text}</span>
                <span className="shrink-0 font-mono text-[9px] text-mist-500">{timeAgo(l.ts)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 border-t border-mist-500/10 pt-4">
          <div className="flex gap-2">
            <input className="field min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-[12px] text-mist-100" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-ghost rounded-md px-3 py-1.5 font-display text-[10px]" onClick={() => { api.renameCity(name); sound.tick(); }}>ĐỔI TÊN</button>
          </div>
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-coral-500/30 py-2 text-[11px] text-coral-400 transition-colors hover:bg-coral-500/10"
            onClick={() => {
              if (window.confirm("Xóa toàn bộ nền văn minh và bắt đầu lại?")) api.resetAll();
            }}
          >
            <IconReset className="h-3.5 w-3.5" /> Khai sinh lại nền văn minh
          </button>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ root ------------------------------ */

export default function Workspace({ view, onClose }: { view: ViewId; onClose: () => void }) {
  if (view === "overview") return null;
  if (view === "center") return <CenterPanel onClose={onClose} />;
  return <DistrictPanel district={view} onClose={onClose} />;
}
