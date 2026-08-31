import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useStore } from "../state/store";
import { makeT } from "../lib/i18n";
import { SEASONS, WEATHERS } from "../lib/season";
import type { Season, WeatherId } from "../lib/season";
import { sound } from "../lib/audio";
import { SHOT_IDS } from "../world/camera";
import type { ShotId } from "../world/camera";
import { IconCamera, IconClose, IconSun, IconSliders, IconCompass, IconCheck } from "./icons";

/* ------------------------------------------------------------------ */
/*  Chế độ ảnh                                                         */
/*                                                                     */
/*  Hạ tầng đã có sẵn hết: mùa và thời tiết chỉnh tay từ Bảng thế giới, */
/*  sáu góc máy đã ngắm trong `world/camera.ts`, và bộ dựng hình biết   */
/*  vẽ lại một khung ở độ phân giải gấp đôi. Việc còn lại là ghép       */
/*  chúng vào một chỗ, giấu toàn bộ giao diện đi, và cho người chơi     */
/*  cầm được tấm ảnh về.                                               */
/* ------------------------------------------------------------------ */

export type FramingId = "free" | "wide" | "classic" | "square" | "tall";

/** Tỉ lệ khung; `null` là dùng trọn cửa sổ. */
const FRAMING: Record<FramingId, number | null> = {
  free: null,
  wide: 16 / 9,
  classic: 3 / 2,
  square: 1,
  tall: 9 / 16,
};

const FRAMING_IDS: FramingId[] = ["free", "wide", "classic", "square", "tall"];

/**
 * Tên tệp từ tên hòn đảo.
 *
 * "Đảo Kiểm Thử" phải ra `dao-kiem-thu`, không phải `-o-ki-m-th-`. Tách dấu
 * bằng NFD rồi bỏ các dấu tổ hợp; riêng chữ đ/Đ không phải là chữ d cộng dấu
 * nên phải thay tay.
 */
function slug(name: string): string {
  const base = (name || "island")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "island";
}

/** Vùng ảnh thật bên trong một khung hình có tỉ lệ cho trước. */
function cropRect(width: number, height: number, aspect: number | null) {
  if (!aspect) return { x: 0, y: 0, w: width, h: height };
  const current = width / height;
  if (current > aspect) {
    const w = Math.round(height * aspect);
    return { x: Math.round((width - w) / 2), y: 0, w, h: height };
  }
  const h = Math.round(width / aspect);
  return { x: 0, y: Math.round((height - h) / 2), w: width, h };
}

interface Props {
  onExit: () => void;
  /** Vẽ lại khung hình hiện tại ở độ phân giải cao, trả về data URL PNG. */
  onCapture: () => string | null;
  onShot: (id: ShotId) => void;
  time: number | null;
  onTime: (hour: number | null) => void;
}

export default function PhotoMode({ onExit, onCapture, onShot, time, onTime }: Props) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const [framing, setFraming] = useState<FramingId>("wide");
  const [stamp, setStamp] = useState(true);
  const [panel, setPanel] = useState(true);
  const [shot, setShot] = useState<ShotId | null>(null);
  const [busy, setBusy] = useState(false);
  const flashRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const manual = state.world.mode === "manual";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  /* Thanh điều khiển trượt lên từ mép dưới. Một hàng nút xuất hiện đột ngột
     giữa khung hình đang ngắm là thứ phá hỏng đúng cái cảm giác mà chế độ này
     muốn tạo ra. */
  useEffect(() => {
    const el = barRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(el, { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: "all" });
    };
  }, []);

  /* --------------------------- chụp và tải về --------------------------- */
  const shoot = useCallback(() => {
    if (busy) return;
    setBusy(true);
    sound.chime();
    const raw = onCapture();
    if (!raw) {
      setBusy(false);
      api.pushToast({ title: t("pm.failed"), kind: "info" });
      return;
    }

    const image = new Image();
    image.onload = () => {
      const rect = cropRect(image.width, image.height, FRAMING[framing]);
      const canvas = document.createElement("canvas");
      canvas.width = rect.w;
      canvas.height = rect.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setBusy(false);
        return;
      }
      ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

      if (stamp) {
        /* Dấu đóng dưới góc trái: tên đảo, cấp, ngày. Nó là lý do một tấm ảnh
           chia sẻ ra ngoài vẫn nói được nó đến từ đâu. */
        const scale = rect.w / 1600;
        const pad = Math.round(38 * scale);
        const size = Math.max(11, Math.round(26 * scale));
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = Math.round(14 * scale);
        ctx.fillStyle = "#f0c268";
        ctx.fillRect(pad, rect.h - pad - Math.round(size * 2.1), Math.round(3 * scale), Math.round(size * 2.1));
        ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(state.city || t("brand.main"), pad + Math.round(16 * scale), rect.h - pad - Math.round(size * 0.9));
        ctx.font = `500 ${Math.round(size * 0.68)}px ui-monospace, monospace`;
        ctx.fillStyle = "rgba(233,243,240,0.72)";
        ctx.fillText(
          new Date().toLocaleDateString(state.lang === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }),
          pad + Math.round(16 * scale),
          rect.h - pad + Math.round(size * 0.05)
        );
        ctx.restore();
      }

      /* Tải về qua blob chứ không qua data URL: một khung 3200×1800 ra chuỗi
         base64 vài chục megabyte, và Chrome từ chối điều hướng tới data URL cỡ
         đó — nút bấm sẽ im lặng không làm gì. Thẻ neo cũng phải nằm trong tài
         liệu thì cú nhấp mới được tính là thao tác tải về. */
      canvas.toBlob((blob) => {
        if (!blob) {
          setBusy(false);
          api.pushToast({ title: t("pm.failed"), kind: "info" });
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${slug(state.city)}-${Date.now()}.png`;
        link.href = url;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setBusy(false);
        api.pushToast({ title: t("pm.saved"), sub: t("pm.savedSub"), kind: "gold" });
      }, "image/png");
    };
    image.onerror = () => {
      setBusy(false);
      api.pushToast({ title: t("pm.failed"), kind: "info" });
    };
    image.src = raw;

    /* Chớp trắng của màn trập. */
    const flash = flashRef.current;
    if (flash && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(flash, { opacity: 0.85 }, { opacity: 0, duration: 0.55, ease: "power2.out" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, framing, stamp, onCapture, state.city, state.lang]);

  /* ------------------------------ khung ------------------------------ */
  const aspect = FRAMING[framing];

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {/* Mặt nạ letterbox: hai dải đen cho biết đâu là ảnh, đâu là phần bị cắt. */}
      {aspect !== null && (
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          {/* `min(100%, 100vh × tỉ lệ)` là cách duy nhất viết bằng CSS thuần mà
              vừa cả hai chiều: đặt `width: 100%` cùng `aspect-ratio` thì chiều
              rộng thắng và khung tràn khỏi màn hình theo chiều cao. */}
          <div
            className="ring-1 ring-gold-500/30"
            style={{
              width: `min(100%, calc(100vh * ${aspect}))`,
              aspectRatio: `${aspect}`,
              boxShadow: "0 0 0 100vmax rgba(3,10,12,0.82)",
            }}
          />
        </div>
      )}
      <div ref={flashRef} className="absolute inset-0 bg-white opacity-0" />

      {/* ------------------------- bảng chỉnh cảnh ------------------------- */}
      {panel && (
        <div className="panel pointer-events-auto absolute left-3 top-3 z-10 w-[248px] rounded-xl p-3.5 sm:left-4 sm:top-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-[10px] tracking-[0.2em] text-gold-400">
              <IconCamera className="h-3.5 w-3.5" />
              {t("pm.title")}
            </span>
            <button onClick={() => setPanel(false)} className="text-mist-500 transition-colors hover:text-mist-100" aria-label={t("pm.hidePanel")}>
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* --------------------------- giờ --------------------------- */}
          <div className="mt-3">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-mist-500">
              <span className="flex items-center gap-1.5">
                <IconSun className="h-3 w-3 text-gold-400" />
                {t("pm.time")}
              </span>
              <span className="text-gold-300">
                {time === null
                  ? t("pm.timeLive")
                  : `${String(Math.floor(time)).padStart(2, "0")}:${String(Math.round((time % 1) * 60)).padStart(2, "0")}`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={23.75}
              step={0.25}
              value={time ?? new Date().getHours() + new Date().getMinutes() / 60}
              onChange={(event) => onTime(Number(event.target.value))}
              className="mt-1.5 w-full accent-[#f0c268]"
              aria-label={t("pm.time")}
            />
            <button
              onClick={() => onTime(null)}
              disabled={time === null}
              className="btn-ghost mt-1.5 w-full rounded-md py-1 font-mono text-[9.5px] disabled:opacity-40"
            >
              {t("pm.timeLive")}
            </button>
          </div>

          {/* --------------------------- mùa --------------------------- */}
          <div className="mt-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-mist-500">{t("pm.season")}</div>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {SEASONS.map((season: Season) => (
                <button
                  key={season}
                  onClick={() => api.setWorld({ mode: "manual", season })}
                  className={`rounded-md px-1 py-1.5 text-[9.5px] transition-all ${
                    manual && state.world.season === season ? "bg-gold-500/90 text-ink-950" : "chip text-mist-400 hover:text-mist-100"
                  }`}
                >
                  {t(`season.${season}`)}
                </button>
              ))}
            </div>
          </div>

          {/* ------------------------- thời tiết ------------------------- */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-mist-500">
              <IconSliders className="h-3 w-3" />
              {t("pm.weather")}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {WEATHERS.map((weather: WeatherId) => (
                <button
                  key={weather}
                  onClick={() => api.setWorld({ mode: "manual", weather })}
                  className={`rounded-md px-1 py-1.5 text-[9.5px] transition-all ${
                    manual && state.world.weather === weather ? "bg-gold-500/90 text-ink-950" : "chip text-mist-400 hover:text-mist-100"
                  }`}
                >
                  {t(`weather.${weather}`)}
                </button>
              ))}
            </div>
            <button
              onClick={() => api.setWorld({ mode: "auto" })}
              disabled={!manual}
              className="btn-ghost mt-1.5 w-full rounded-md py-1 font-mono text-[9.5px] disabled:opacity-40"
            >
              {t("pm.auto")}
            </button>
          </div>

          <p className="mt-3 text-[9.5px] leading-relaxed text-mist-500">{t("pm.hint")}</p>
        </div>
      )}

      {!panel && (
        <button
          onClick={() => setPanel(true)}
          className="chip pointer-events-auto absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] text-mist-300"
        >
          <IconSliders className="h-3.5 w-3.5" />
          {t("pm.showPanel")}
        </button>
      )}

      {/* ------------------------- thanh dưới ------------------------- */}
      <div ref={barRef} className="pointer-events-auto absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-3">
        {/* góc máy đẹp */}
        <div className="panel flex max-w-full items-center gap-1 overflow-x-auto rounded-full px-2 py-1.5">
          <span className="ml-1.5 mr-1 hidden shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-mist-500 sm:flex">
            <IconCompass className="h-3 w-3" />
            {t("pm.shots")}
          </span>
          {SHOT_IDS.map((id) => (
            <button
              key={id}
              onClick={() => {
                setShot(id);
                onShot(id);
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10.5px] transition-all ${
                shot === id ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
              }`}
            >
              {t(`shot.${id}`)}
            </button>
          ))}
        </div>

        <div className="panel flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl px-3 py-2">
          {/* khung hình */}
          <div className="chip flex items-center rounded-lg p-0.5">
            {FRAMING_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setFraming(id)}
                className={`rounded-md px-2 py-1.5 font-mono text-[9.5px] transition-all ${
                  framing === id ? "bg-gold-500/90 text-ink-950" : "text-mist-400 hover:text-mist-100"
                }`}
              >
                {t(`pm.frame.${id}`)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStamp(!stamp)}
            className={`chip flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10.5px] transition-all ${
              stamp ? "border-gold-500/50 text-gold-300" : "text-mist-400"
            }`}
          >
            <IconCheck className={`h-3.5 w-3.5 ${stamp ? "" : "opacity-30"}`} />
            {t("pm.stamp")}
          </button>

          <button
            onClick={shoot}
            disabled={busy}
            className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-[11px] tracking-[0.14em] disabled:opacity-60"
          >
            <IconCamera className="h-4 w-4" />
            {t("pm.shutter")}
          </button>

          <button onClick={onExit} className="btn-ghost rounded-xl px-4 py-2.5 font-display text-[10px] tracking-wider">
            {t("pm.exit")}
          </button>
        </div>
      </div>
    </div>
  );
}
