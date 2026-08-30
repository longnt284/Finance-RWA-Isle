import { useEffect, useMemo, useRef, useState } from "react";
import { StoreProvider, useStore, districtLevels, levelFor, ACH_DEFS, ISLE_UNLOCK_LV } from "./state/store";
import type { ViewId } from "./state/store";
import WorldScene from "./world/WorldScene";
import type { WorldHandle } from "./world/WorldScene";
import HUD from "./components/HUD";
import type { DrawerId } from "./components/HUD";
import Workspace from "./components/Workspace";
import { MarketDrawer, ToolsDrawer, NotesDrawer } from "./components/Drawers";
import { Hero, OnboardingModal, TutorialOverlay } from "./components/Modals";
import { makeT } from "./lib/i18n";
import { market } from "./lib/market";
import { sound } from "./lib/audio";

function Shell() {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [selected, setSelected] = useState<ViewId>("overview");
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted());
  const worldRef = useRef<WorldHandle | null>(null);

  const levels = useMemo(() => districtLevels(state), [state.xp]);
  const isleUnlocked = levels.crypto >= ISLE_UNLOCK_LV;

  /* ---------- achievement scanner ---------- */
  const rewarded = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!state.onboarded) {
      rewarded.current = null;
      return;
    }
    if (rewarded.current === null) {
      rewarded.current = new Set(ACH_DEFS.filter((a) => a.done(state)).map((a) => a.id));
      return;
    }
    for (const a of ACH_DEFS) {
      if (rewarded.current.has(a.id)) continue;
      if (a.done(state)) {
        rewarded.current.add(a.id);
        const name = t(`ach.${a.id}.n`);
        api.logTrade(state.focus, t("log.ach", { n: name, x: a.reward }), a.reward);
        api.pushToast({ title: t("toast.ach", { n: name }), sub: `+${a.reward} XP`, kind: "gold" });
        worldRef.current?.fireBurst("center", "gold");
        sound.levelUp();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* ---------- market events ---------- */
  useEffect(() => {
    market.onEvent = (e) => {
      const tr = makeT(state.lang);
      let text = "";
      if (e.id === "whale" && e.sym) text = tr("evt.whale", { n: e.n ?? "1", s: e.sym });
      else if (e.id === "pump" && e.sym) text = tr("evt.pump", { s: e.sym, p: e.p ?? "1" });
      else if (e.id === "dump" && e.sym) text = tr("evt.dump", { s: e.sym, p: e.p ?? "1" });
      else if (e.id === "vni") text = tr("evt.vni", { d: e.d === "giảm" ? (state.lang === "vi" ? "giảm" : "down") : state.lang === "vi" ? "tăng" : "up", p: e.p ?? "1" });
      else if (e.id === "fed") text = tr("evt.fed");
      if (text) api.logEvent(text);
    };
    return () => {
      market.onEvent = null;
    };
  }, [state.lang, api]);

  /* ---------- flow control ---------- */
  const prevOnboarded = useRef(state.onboarded);
  useEffect(() => {
    if (!state.onboarded) {
      setSelected("overview");
      setDrawer(null);
    } else if (!prevOnboarded.current && state.onboarded) {
      setSelected(state.focus);
      if (!state.tutorialSeen) {
        const timer = setTimeout(() => setDrawer("tutorial"), 900);
        return () => clearTimeout(timer);
      }
    }
    prevOnboarded.current = state.onboarded;
  }, [state.onboarded, state.focus, state.tutorialSeen]);

  function handleSelect(view: ViewId) {
    if (view === "isle" && !isleUnlocked) {
      api.pushToast({
        title: t("toast.needLvl", { b: t("d.crypto.building"), n: ISLE_UNLOCK_LV }),
        sub: t("il.lockedSub", { n: ISLE_UNLOCK_LV }),
        kind: "info",
      });
      setSelected("crypto");
      sound.tick();
      return;
    }
    setSelected(view);
    if (view !== "overview") api.visit(view);
  }

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-ink-900">
      <WorldScene
        levels={levels}
        selected={selected}
        onSelect={handleSelect}
        handleRef={worldRef}
        lang={state.lang}
        decor={state.isleDecor}
        isleUnlocked={isleUnlocked}
        isleLevel={levels.crypto}
      />

      {state.onboarded ? (
        <>
          <HUD
            selected={selected}
            onSelect={handleSelect}
            drawer={drawer}
            onDrawer={setDrawer}
            muted={muted}
            onToggleMute={() => setMuted(sound.toggleMute())}
          />
          {selected !== "overview" && (
            <Workspace view={selected} onClose={() => setSelected("overview")} onSelect={handleSelect} />
          )}
          {drawer === "market" && <MarketDrawer onClose={() => setDrawer(null)} />}
          {drawer === "tools" && <ToolsDrawer onClose={() => setDrawer(null)} />}
          {drawer === "notes" && <NotesDrawer onClose={() => setDrawer(null)} />}
          <TutorialOverlay open={drawer === "tutorial"} onClose={() => setDrawer(null)} />
        </>
      ) : (
        <>
          <Hero onBegin={() => setShowOnboard(true)} />
          <OnboardingModal open={showOnboard} onClose={() => setShowOnboard(false)} />
        </>
      )}
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
