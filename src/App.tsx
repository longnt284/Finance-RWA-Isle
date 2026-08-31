import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StoreProvider, useStore, districtLevels, ACH_DEFS, ISLE_UNLOCK_LEVELS, DISTRICT_IDS,
} from "./state/store";
import type { DistrictId, ViewId } from "./state/store";
import { useCloudSync } from "./state/sync";
import type { WorldHandle } from "./world/WorldScene";
import HUD from "./components/HUD";
import type { DrawerId } from "./components/HUD";
import { Hero, OnboardingModal, TutorialOverlay, GoldenHourCard } from "./components/Modals";
import { makeT } from "./lib/i18n";
import { sound } from "./lib/audio";
import { useMarketEvents } from "./lib/events";
import { dayKey } from "./lib/format";
import type { GoldenKind } from "./lib/season";
import type { ShotId } from "./world/camera";
import type { FishingZone } from "./components/Fishing";

const Workspace = lazy(() => import("./components/Workspace"));
const WorldScene = lazy(() => import("./world/WorldScene"));
const ExamModal = lazy(() => import("./components/Exam"));
const AccountPanel = lazy(() => import("./components/Account"));
const MarketDrawer = lazy(() => import("./components/Drawers").then((module) => ({ default: module.MarketDrawer })));
const ToolsDrawer = lazy(() => import("./components/Drawers").then((module) => ({ default: module.ToolsDrawer })));
const NotesDrawer = lazy(() => import("./components/Drawers").then((module) => ({ default: module.NotesDrawer })));
const QuestsPanel = lazy(() => import("./components/Panels").then((module) => ({ default: module.QuestsPanel })));
const WorldPanel = lazy(() => import("./components/Panels").then((module) => ({ default: module.WorldPanel })));
const NewsPanel = lazy(() => import("./components/News"));
const ShopPanel = lazy(() => import("./components/Shop"));
const FishingPanel = lazy(() => import("./components/Fishing"));
const PhotoMode = lazy(() => import("./components/Photo"));

/**
 * Lời mời ngắm hoàng hôn chỉ được cất tiếng một lần cho mỗi buổi.
 *
 * Ghi vào `localStorage` chứ không vào state: nó là chuyện của cái máy này
 * hôm nay, không phải chuyện đáng đồng bộ lên đám mây hay khôi phục lại khi
 * người chơi mở bản lưu trên máy khác.
 */
const GOLDEN_KEY = "vuong-golden";

function goldenAlreadyShown(kind: GoldenKind): boolean {
  try {
    return window.localStorage.getItem(GOLDEN_KEY) === `${dayKey(Date.now())}|${kind}`;
  } catch {
    return false;
  }
}

function markGoldenShown(kind: GoldenKind) {
  try {
    window.localStorage.setItem(GOLDEN_KEY, `${dayKey(Date.now())}|${kind}`);
  } catch {
    /* Trình duyệt chặn lưu trữ thì cùng lắm là lời mời hiện lại — không sao. */
  }
}

/** Trang bìa chỉ chào người quay lại một lần cho mỗi phiên, không phải mỗi lần tải lại thẻ. */
const RETURN_KEY = "vuong-greeted";

function Shell() {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  useCloudSync();
  const [selected, setSelected] = useState<ViewId>("overview");
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted());
  const [activeIsle, setActiveIsle] = useState<DistrictId>("crypto");
  const [voyage, setVoyage] = useState(false);
  const [examDistrict, setExamDistrict] = useState<DistrictId | null>(null);
  const [helmInput, setHelmInput] = useState({ throttle: 0, turn: 0 });
  /* Chế độ ảnh và chế độ "chỉ thế giới" là hai mức của cùng một ý: bớt giao
     diện đi. Chế độ ảnh bao gồm chế độ kia, cộng thêm quyền chỉnh giờ. */
  const [photoMode, setPhotoMode] = useState(false);
  const [cleanMode, setCleanMode] = useState(false);
  const [timeOverride, setTimeOverride] = useState<number | null>(null);
  const [golden, setGolden] = useState<GoldenKind | null>(null);
  /* `null` = không câu; ngược lại là vùng nước đang thả cần. */
  const [fishingZone, setFishingZone] = useState<FishingZone | null>(null);
  const worldRef = useRef<WorldHandle | null>(null);

  /* Người chơi cũ được chào lại bằng chính trang bìa. Bản lưu có thể vừa được
     kéo từ đám mây xuống ở lần dựng đầu tiên, nên cờ này bật lên khi `onboarded`
     chuyển thành `true` chứ không chỉ ở lần chạy đầu. */
  const [greeting, setGreeting] = useState(false);
  const greetChecked = useRef(false);
  useEffect(() => {
    if (greetChecked.current || !state.onboarded) return;
    greetChecked.current = true;
    let greeted = false;
    try {
      greeted = window.sessionStorage.getItem(RETURN_KEY) === "1";
      window.sessionStorage.setItem(RETURN_KEY, "1");
    } catch {
      greeted = false;
    }
    if (!greeted) setGreeting(true);
  }, [state.onboarded]);

  const levels = useMemo(() => districtLevels(state), [state.certified]);
  const islands = useMemo(
    () =>
      Object.fromEntries(
        DISTRICT_IDS.map((district) => [
          district,
          {
            unlocked: levels[district] >= ISLE_UNLOCK_LEVELS[district],
            level: levels[district],
            decor: state.isleDecor[district],
            theme: state.isleTheme[district],
          },
        ])
      ) as Record<DistrictId, { unlocked: boolean; level: number; decor: string[]; theme: (typeof state.isleTheme)[DistrictId] }>,
    [levels, state.isleDecor, state.isleTheme]
  );
  const canVoyage = DISTRICT_IDS.some((district) => islands[district].unlocked);

  /* ---------- market events ----------
     Nguồn duy nhất làm `state.events` nhích lên, tức là thứ khiến thành tựu
     "Săn cá voi" có thể đạt được. */
  useMarketEvents(state.watchlist, (event) => api.logEvent(event.k, event.p));

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
        api.awardAch(state.focus, a.id, a.reward);
        api.pushToast({ title: t("toast.ach", { n: name }), sub: `+${a.reward} XP`, kind: "gold" });
        worldRef.current?.fireBurst("center", "gold");
        sound.levelUp();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* ---------- flow control ---------- */
  const prevOnboarded = useRef(state.onboarded);
  useEffect(() => {
    if (!state.onboarded) {
      setSelected("overview");
      setDrawer(null);
      setExamDistrict(null);
    } else if (!prevOnboarded.current && state.onboarded) {
      setSelected(state.focus);
      if (!state.tutorialSeen) {
        const timer = setTimeout(() => setDrawer("tutorial"), 900);
        return () => clearTimeout(timer);
      }
    }
    prevOnboarded.current = state.onboarded;
  }, [state.onboarded, state.focus, state.tutorialSeen]);

  const openExam = useCallback((district: DistrictId) => {
    setDrawer(null);
    setExamDistrict(district);
  }, []);

  const onExamPassed = useCallback((district: DistrictId) => {
    worldRef.current?.fireBurst(district, district === "crypto" ? "jade" : "gold");
  }, []);

  /* Mở bảng câu cá: đóng mọi bảng khác để khung minigame không bị che. */
  const openFishing = useCallback((zone: FishingZone) => {
    setDrawer(null);
    setExamDistrict(null);
    setFishingZone(zone);
  }, []);

  /* ---------- khoảnh khắc vàng ---------- */
  const onGolden = useCallback((kind: GoldenKind) => {
    /* Đang chụp ảnh, đang lái tàu hay đang câu cá thì người chơi đã ở trong
       một khoảnh khắc rồi — chen ngang là phá, không phải mời. */
    if (goldenAlreadyShown(kind)) return;
    markGoldenShown(kind);
    setGolden((current) => current ?? kind);
    sound.chime();
  }, []);

  useEffect(() => {
    if (golden && (photoMode || fishingZone)) setGolden(null);
  }, [golden, photoMode, fishingZone]);

  /* ---------- chế độ ảnh và chế độ chỉ-thế-giới ---------- */
  const enterPhoto = useCallback(() => {
    setDrawer(null);
    setExamDistrict(null);
    setFishingZone(null);
    setGolden(null);
    setPhotoMode(true);
  }, []);

  const exitPhoto = useCallback(() => {
    setPhotoMode(false);
    setTimeOverride(null);
  }, []);

  /* `H` giấu giao diện, `P` mở chế độ ảnh. Bỏ qua khi con trỏ đang nằm trong
     một ô nhập liệu — nếu không thì gõ chữ "h" vào ghi chú sẽ làm biến mất cả
     bảng đang gõ dở. */
  useEffect(() => {
    if (!state.onboarded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.code === "KeyH") {
        event.preventDefault();
        if (photoMode) exitPhoto();
        else setCleanMode((current) => !current);
      } else if (event.code === "KeyP") {
        event.preventDefault();
        if (photoMode) exitPhoto();
        else enterPhoto();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.onboarded, photoMode, enterPhoto, exitPhoto]);

  /* Du thuyền chạm xoáy nước — thế giới 3D gọi ngược lên đây. */
  const onVortex = useCallback(() => {
    setFishingZone((current) => current ?? "vortex");
    api.pushToast({ title: t("fs.vortexHit"), sub: t("fs.vortexSub"), kind: "jade" });
    sound.chime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lang]);

  function handleSelect(view: ViewId, island?: DistrictId) {
    const requestedIsle = island ?? activeIsle;
    if (view === "isle" && !islands[requestedIsle].unlocked) {
      api.pushToast({
        title: t("toast.needLvl", { b: t(`d.${requestedIsle}.building`), n: ISLE_UNLOCK_LEVELS[requestedIsle] }),
        sub: t("il.lockedSub", { n: ISLE_UNLOCK_LEVELS[requestedIsle] }),
        kind: "info",
      });
      setSelected(requestedIsle);
      sound.tick();
      return;
    }
    if (view === "isle") setActiveIsle(requestedIsle);
    if (voyage) setVoyage(false);
    if (view !== "overview") setFishingZone(null);
    setSelected(view);
    if (view !== "overview") api.visit(view);
  }

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-ink-900">
      <Suspense fallback={<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#173f3a_0%,#071816_72%)]" aria-hidden="true" />}>
        <WorldScene
          levels={levels}
          selected={selected}
          onSelect={handleSelect}
          handleRef={worldRef}
          lang={state.lang}
          islands={islands}
          activeIsle={activeIsle}
          voyage={voyage}
          helmInput={helmInput}
          yachtTier={state.yachtTier}
          world={state.world}
          decor={state.shop.placed}
          onFish={openFishing}
          onVortex={onVortex}
          timeOverride={photoMode ? timeOverride : null}
          showLabels={!photoMode && !cleanMode}
          onGolden={onGolden}
        />
      </Suspense>

      {greeting && state.onboarded ? (
        <Hero returning onBegin={() => setGreeting(false)} />
      ) : state.onboarded ? (
        <>
          {!photoMode && !cleanMode && (
          <HUD
            selected={selected}
            onSelect={handleSelect}
            drawer={drawer}
            onDrawer={(next) => {
              /* Bảng bên phải chỉ có một chỗ: mở bảng khác thì cần câu thu lại. */
              if (next) setFishingZone(null);
              setDrawer(next);
            }}
            muted={muted}
            onToggleMute={() => setMuted(sound.toggleMute())}
            voyage={voyage}
            canVoyage={canVoyage}
            onVoyage={() => {
              setDrawer(null);
              setHelmInput({ throttle: 0, turn: 0 });
              const next = !voyage;
              if (next) {
                setSelected("overview");
                api.startVoyage();
              }
              setVoyage(next);
            }}
            onHelmInput={setHelmInput}
            onExam={openExam}
            onFish={() => openFishing(voyage ? "vortex" : "shore")}
            onPhoto={enterPhoto}
            onClean={() => setCleanMode(true)}
            onShot={(id: ShotId) => worldRef.current?.flyToShot(id)}
          />
          )}
          <Suspense fallback={photoMode || cleanMode ? null : <div className="panel absolute right-4 top-24 z-40 h-24 w-72 animate-pulse rounded-xl" />}>
            {photoMode && (
              <PhotoMode
                onExit={exitPhoto}
                onCapture={() => worldRef.current?.capture() ?? null}
                onShot={(id) => worldRef.current?.flyToShot(id)}
                time={timeOverride}
                onTime={setTimeOverride}
              />
            )}
            {!photoMode && !cleanMode && selected !== "overview" && (
              <Workspace
                view={selected}
                onClose={() => setSelected("overview")}
                onSelect={handleSelect}
                activeIsle={activeIsle}
                onIslandSelect={(district) => handleSelect("isle", district)}
                onExam={openExam}
              />
            )}
            {!photoMode && !cleanMode && (
              <>
                {drawer === "market" && <MarketDrawer onClose={() => setDrawer(null)} />}
                {drawer === "tools" && <ToolsDrawer onClose={() => setDrawer(null)} />}
                {drawer === "notes" && <NotesDrawer onClose={() => setDrawer(null)} />}
                {drawer === "quests" && <QuestsPanel onClose={() => setDrawer(null)} />}
                {drawer === "world" && <WorldPanel onClose={() => setDrawer(null)} />}
                {drawer === "account" && <AccountPanel onClose={() => setDrawer(null)} />}
                {drawer === "news" && <NewsPanel onClose={() => setDrawer(null)} />}
                {drawer === "shop" && (
                  <ShopPanel onClose={() => setDrawer(null)} activeIsle={selected === "isle" ? activeIsle : "main"} />
                )}
                {fishingZone && <FishingPanel zone={fishingZone} onClose={() => setFishingZone(null)} />}
                {examDistrict && (
                  <ExamModal district={examDistrict} onClose={() => setExamDistrict(null)} onPassed={onExamPassed} />
                )}
              </>
            )}
          </Suspense>
          {!photoMode && !cleanMode && <TutorialOverlay open={drawer === "tutorial"} onClose={() => setDrawer(null)} />}
          {golden && !photoMode && (
            <GoldenHourCard kind={golden} onPhoto={enterPhoto} onDismiss={() => setGolden(null)} />
          )}
          {/* Lối ra duy nhất của chế độ chỉ-thế-giới: một dòng chữ nhỏ ở góc,
              đủ để không ai bị kẹt ngoài giao diện của chính mình. */}
          {cleanMode && !photoMode && (
            <button
              onClick={() => setCleanMode(false)}
              className="chip anim-fade-in absolute bottom-4 right-4 z-40 rounded-full px-3.5 py-2 font-mono text-[10px] tracking-wide text-mist-400 transition-colors hover:text-mist-100"
            >
              {t("hud.cleanExit")}
            </button>
          )}
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
