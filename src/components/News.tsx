import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { makeT } from "../lib/i18n";
import { timeAgo } from "../lib/format";
import { sound } from "../lib/audio";
import { useNews, loadNews, markNewsRead, NEWS_TOPICS } from "../lib/news";
import type { NewsItem, NewsTopic } from "../lib/news";
import { IconClose, IconNews, IconArrowR, IconReset } from "./icons";

const TOPIC_ACCENT: Record<NewsTopic, string> = {
  crypto: "#5ce8c4",
  stocks: "#f0c268",
  vn: "#ff9ac1",
  world: "#9fd0ff",
};

function Story({ item }: { item: NewsItem }) {
  const { state } = useStore();
  const t = makeT(state.lang);
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => sound.tick()}
      className="anim-fade-up group block rounded-xl border hairline-gold bg-ink-850/55 p-3.5 transition-all hover:border-gold-500/45 hover:bg-ink-850/80"
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: TOPIC_ACCENT[item.topic] }} />
        <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.16em] text-mist-500">{item.source}</span>
        <span className="ml-auto shrink-0 font-mono text-[9px] text-mist-500">{timeAgo(item.ts, state.lang)}</span>
      </div>
      <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-mist-100 group-hover:text-gold-300">{item.title}</h3>
      {item.summary && <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-mist-400">{item.summary}</p>}
      <span className="mt-2 inline-flex items-center gap-1 font-mono text-[9.5px] text-gold-400/80">
        {t("nw.open")} <IconArrowR className="h-3 w-3" />
      </span>
    </a>
  );
}

export default function NewsPanel({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const t = makeT(state.lang);
  const feed = useNews();
  const [topic, setTopic] = useState<NewsTopic | "all">("all");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /* Mở bảng tin là đã đọc: huy hiệu tắt và nhiệm vụ ngày "đọc tin" nhích lên. */
  useEffect(() => {
    markNewsRead();
    api.readNews();
  }, [api]);

  const list = useMemo(
    () => (topic === "all" ? feed.items : feed.items.filter((item) => item.topic === topic)),
    [feed.items, feed.fetchedAt, topic]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("nw.title")}
      className="anim-slide-left panel absolute inset-y-0 right-0 z-40 flex w-full flex-col sm:inset-y-auto sm:bottom-10 sm:top-[88px] sm:w-[420px] sm:rounded-l-2xl sm:border-l"
    >
      <div className="flex items-center justify-between border-b border-mist-500/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gold-400"><IconNews className="h-[18px] w-[18px]" /></span>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">{t("nw.title")}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              void loadNews(true);
              sound.tick();
            }}
            title={t("nw.refresh")}
            aria-label={t("nw.refresh")}
            className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-gold-300"
          >
            <IconReset className={`h-4 w-4 ${feed.status === "loading" ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose} aria-label={t("misc.close")} className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700 hover:text-mist-100">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 border-b border-mist-500/10 px-5 py-3">
        <p className="text-[11px] leading-relaxed text-mist-400">{t("nw.sub")}</p>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...NEWS_TOPICS] as (NewsTopic | "all")[]).map((candidate) => (
            <button
              key={candidate}
              onClick={() => {
                setTopic(candidate);
                sound.tick();
              }}
              className={`rounded-full border px-2.5 py-1 text-[10.5px] transition-all ${
                topic === candidate
                  ? "border-jade-500/55 bg-jade-500/10 text-jade-300"
                  : "border-mist-500/18 text-mist-400 hover:border-gold-500/40 hover:text-mist-100"
              }`}
            >
              {candidate === "all" ? t("nw.all") : t(`nw.topic.${candidate}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between font-mono text-[9px] text-mist-500">
          <span>{t("nw.count", { n: list.length })}</span>
          {feed.fetchedAt > 0 && <span>{t("nw.updated", { t: timeAgo(feed.fetchedAt, state.lang) })}</span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {feed.status === "loading" && feed.items.length === 0 && (
          <>
            <p className="text-center text-[11px] text-mist-500">{t("nw.loading")}</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[86px] animate-pulse rounded-xl border border-mist-500/10 bg-ink-850/40" />
            ))}
          </>
        )}
        {feed.status === "error" && (
          <div className="rounded-xl border border-coral-500/30 bg-coral-500/5 p-4 text-center">
            <p className="text-[11.5px] leading-relaxed text-coral-400">{t("nw.error")}</p>
            <button onClick={() => void loadNews(true)} className="btn-ghost mt-3 rounded-lg px-3 py-1.5 text-[11px]">
              {t("nw.retry")}
            </button>
          </div>
        )}
        {feed.status !== "error" && feed.status !== "loading" && list.length === 0 && (
          <p className="rounded-lg border border-dashed border-mist-500/20 p-4 text-center text-[11px] text-mist-500">{t("nw.empty")}</p>
        )}
        {list.map((item) => (
          <Story key={item.id} item={item} />
        ))}
      </div>

      <div className="border-t border-mist-500/10 px-5 py-2.5 text-[9.5px] leading-relaxed text-mist-500">{t("nw.note")}</div>
    </div>
  );
}
