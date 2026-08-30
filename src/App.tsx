import { useEffect, useMemo, useRef, useState } from "react";
import { StoreProvider, useStore, districtLevels } from "./state/store";
import type { DistrictId, ViewId } from "./state/store";
import WorldScene from "./world/WorldScene";
import type { WorldHandle } from "./world/WorldScene";
import { TopBar, SideNav, BottomHud, Toasts } from "./components/HUD";
import Workspace from "./components/Workspace";
import Onboarding from "./components/Modals";
import { sound } from "./lib/audio";

const DISTRICT_IDS: DistrictId[] = ["crypto", "stocks", "vault", "academy"];

function Shell() {
  const { state } = useStore();
  const [selected, setSelected] = useState<ViewId>("overview");
  const [intro, setIntro] = useState(true);
  const handleRef = useRef<WorldHandle | null>(null);

  const levels = useMemo(() => districtLevels(state), [state]);

  /* intro splash */
  useEffect(() => {
    const id = window.setTimeout(() => setIntro(false), 3200);
    return () => window.clearTimeout(id);
  }, []);

  /* keep view in sync when civilization is reset; focus after onboarding */
  const prevOnboarded = useRef(state.onboarded);
  useEffect(() => {
    if (!state.onboarded) {
      setSelected("overview");
    } else if (!prevOnboarded.current && state.onboarded) {
      setSelected(state.focus);
    }
    prevOnboarded.current = state.onboarded;
  }, [state.onboarded, state.focus]);

  /* celebrate level-ups */
  const prevLevels = useRef<Record<DistrictId, number> | null>(null);
  useEffect(() => {
    const prev = prevLevels.current;
    if (prev) {
      for (const d of DISTRICT_IDS) {
        if (levels[d] > prev[d]) {
          handleRef.current?.fireBurst(d, "gold");
          sound.levelUp();
        }
      }
    }
    prevLevels.current = { ...levels };
  }, [levels]);

  /* celebrate goal completions */
  const doneGoals = useRef<Set<string>>(new Set());
  useEffect(() => {
    const nowDone = state.goals.filter((g) => g.done);
    for (const g of nowDone) {
      if (!doneGoals.current.has(g.id)) {
        if (doneGoals.current.size > 0 || prevLevels.current) {
          handleRef.current?.fireBurst(g.district, "jade");
          sound.chime();
        }
      }
    }
    doneGoals.current = new Set(nowDone.map((g) => g.id));
  }, [state.goals]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-900">
      <WorldScene levels={levels} selected={selected} onSelect={setSelected} handleRef={handleRef} />

      <TopBar />
      <SideNav selected={selected} onSelect={setSelected} />
      <BottomHud selected={selected} />
      <Toasts />
      <Workspace view={selected} onClose={() => setSelected("overview")} />

      {/* intro splash */}
      {intro && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="anim-fade-in text-center" style={{ animation: "fadeIn 0.8s ease both, fadeUp 3.2s ease both" }}>
            <div className="font-display text-5xl font-bold tracking-[0.18em] text-gold-300 sm:text-7xl" style={{ textShadow: "0 0 60px rgba(240,194,104,0.4)" }}>
              VƯỢNG
            </div>
            <div className="mt-3 font-display text-[10px] tracking-[0.42em] text-mist-400">WEALTH CIVILIZATION</div>
          </div>
        </div>
      )}

      {!state.onboarded && <Onboarding />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
