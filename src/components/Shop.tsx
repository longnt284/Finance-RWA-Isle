import { useEffect, useMemo, useState } from "react";
import { useStore, ISLE_SLOTS, ISLE_UNLOCK_LEVELS, PLACE_LIMIT } from "../state/store";
import type { IsleSlot } from "../state/store";
import { makeT } from "../lib/i18n";
import { fmt } from "../lib/format";
import { sound } from "../lib/audio";
import { SHOP_ITEMS, SHOP_CATS, FREE_ITEMS, shopName } from "../lib/shop";
import type { ShopCat, ShopItem } from "../lib/shop";
import { IconClose, IconStore, IconCoinPurse, IconCheck, IconSearch, IconLock, IconSpark } from "./icons";

const CAT_ACCENT: Record<ShopCat, string> = {
  ground: "#d3bc7d",
  plant: "#4cd99a",
  light: "#ffd88a",
  build: "#9fd0ff",
  statue: "#f0c268",
  sea: "#7bdcf5",
  fx: "#c6a8ff",
};

function swatch(item: ShopItem) {
  const base = `#${item.color.toString(16).padStart(6, "0")}`;
  const accent = item.accent ? `#${item.accent.toString(16).padStart(6, "0")}` : base;
  return `linear-gradient(135deg, ${base}, ${accent})`;
}

export default function ShopPanel({ onClose, activeIsle }: { onClose: () => void; activeIsle: IsleSlot }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [slot, setSlot] = useState<IsleSlot>(activeIsle);
  const [cat, setCat] = useState<ShopCat | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const slotUnlocked = slot === "main" || state.certified[slot] >= ISLE_UNLOCK_LEVELS[slot];
  const placed = state.shop.placed[slot];
  const ownedPaid = state.shop.owned.filter((id) => !FREE_ITEMS.includes(id)).length;
  const paidTotal = SHOP_ITEMS.length - FREE_ITEMS.length;

  const list = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return SHOP_ITEMS.filter(
      (item) =>
        (cat === "all" || item.cat === cat) &&
        (!ql || item.vi.toLowerCase().includes(ql) || item.en.toLowerCase().includes(ql))
    );
  }, [cat, query]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("sp.title")}
      className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l"
    >
      <div className="flex items-center justify-between border-b border-mist-500/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gold-400"><IconStore className="h-[18px] w-[18px]" /></span>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">{t("sp.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] text-gold-300">
            <IconCoinPurse className="h-3.5 w-3.5" />
            {fmt(state.coins)}
          </span>
          <button onClick={onClose} aria-label={t("misc.close")} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---------------- đảo đang trang trí ---------------- */}
      <div className="space-y-2.5 border-b border-mist-500/10 px-5 py-3">
        <p className="text-[11px] leading-relaxed text-mist-400">{t("sp.sub")}</p>
        <div>
          <div className="mb-1.5 font-display text-[9px] tracking-[0.22em] text-mist-500">{t("sp.island")}</div>
          <div className="flex flex-wrap gap-1.5">
            {ISLE_SLOTS.map((candidate) => {
              const unlocked = candidate === "main" || state.certified[candidate] >= ISLE_UNLOCK_LEVELS[candidate];
              const label = candidate === "main" ? t("sp.isle.main") : t(`ct.isle.${candidate}`);
              return (
                <button
                  key={candidate}
                  onClick={() => {
                    setSlot(candidate);
                    sound.tick();
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] transition-all ${
                    slot === candidate
                      ? "border-jade-500/55 bg-jade-500/10 text-jade-300"
                      : unlocked
                        ? "border-mist-500/18 text-mist-400 hover:border-gold-500/40 hover:text-mist-100"
                        : "border-mist-500/12 text-mist-500"
                  }`}
                >
                  {!unlocked && <IconLock className="h-3 w-3" />}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-mist-500">
            <span>{t("sp.placedCount", { a: placed.length, b: PLACE_LIMIT })}</span>
            <span>{t("sp.ownedCount", { a: ownedPaid, b: paidTotal })}</span>
          </div>
        </div>
        {!slotUnlocked && (
          <p className="rounded-lg border border-dashed border-gold-500/25 p-2.5 text-center text-[10.5px] text-gold-300/90">{t("sp.locked")}</p>
        )}
      </div>

      {/* ---------------- bộ lọc ---------------- */}
      <div className="space-y-2 border-b border-mist-500/10 px-5 py-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sp.search")}
            className="field w-full rounded-lg py-1.5 pl-8 pr-3 text-[12px] text-mist-100"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...SHOP_CATS] as (ShopCat | "all")[]).map((candidate) => (
            <button
              key={candidate}
              onClick={() => {
                setCat(candidate);
                sound.tick();
              }}
              className={`rounded-full border px-2.5 py-1 text-[10px] transition-all ${
                cat === candidate
                  ? "border-jade-500/55 bg-jade-500/10 text-jade-300"
                  : "border-mist-500/18 text-mist-400 hover:border-gold-500/40 hover:text-mist-100"
              }`}
            >
              {t(`sp.cat.${candidate}`)}
            </button>
          ))}
        </div>
        <div className="font-mono text-[9px] text-mist-500">{t("sp.count", { n: list.length })}</div>
      </div>

      {/* ---------------- danh sách ---------------- */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {list.length === 0 && (
          <p className="rounded-lg border border-dashed border-mist-500/20 p-4 text-center text-[11px] text-mist-500">{t("sp.empty")}</p>
        )}
        {list.map((item) => {
          const owned = state.shop.owned.includes(item.id);
          const isPlaced = placed.includes(item.id);
          const affordable = state.coins >= item.price;
          const full = placed.length >= PLACE_LIMIT && !isPlaced && item.cat !== "ground";
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                isPlaced ? "border-jade-500/45 bg-jade-500/6" : owned ? "hairline-gold bg-ink-850/60" : "border-mist-500/12 bg-ink-850/35"
              }`}
            >
              <span
                className="h-9 w-9 shrink-0 rounded-lg border border-mist-500/20"
                style={{ background: swatch(item) }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-mist-100">{shopName(item, state.lang)}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rotate-45" style={{ background: CAT_ACCENT[item.cat] }} />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-mist-500">{t(`sp.cat.${item.cat}`)}</span>
                  {item.count && item.count > 1 && <span className="font-mono text-[9px] text-mist-500">×{item.count}</span>}
                </div>
              </div>
              {owned ? (
                <button
                  onClick={() => {
                    if (!slotUnlocked || full) return;
                    api.togglePlace(slot, item.id);
                    sound.coin();
                  }}
                  disabled={!slotUnlocked || full}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 font-mono text-[10px] transition-all disabled:opacity-40 ${
                    isPlaced ? "border border-jade-500/50 bg-jade-500/10 text-jade-300" : "btn-ghost"
                  }`}
                >
                  {isPlaced ? (
                    <span className="flex items-center gap-1">
                      <IconCheck className="h-3 w-3" /> {t("sp.placed")}
                    </span>
                  ) : (
                    t("sp.place")
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!affordable) return;
                    api.buyItem(item.id);
                    sound.chime();
                  }}
                  disabled={!affordable}
                  title={affordable ? t("sp.buy") : t("sp.cant")}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 font-mono text-[10px] transition-all ${
                    affordable ? "btn-gold" : "cursor-not-allowed border border-mist-500/25 text-mist-500"
                  }`}
                >
                  {item.price === 0 ? t("sp.free") : t("sp.coins", { c: item.price })}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 border-t border-mist-500/10 px-5 py-2.5 text-[9.5px] leading-relaxed text-mist-500">
        <IconSpark className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" />
        <span>{cat === "ground" ? t("sp.groundNote") : t("sp.hint")} · {t("sp.limit", { n: PLACE_LIMIT })}</span>
      </div>
    </div>
  );
}
