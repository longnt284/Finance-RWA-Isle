/* ------------------------------------------------------------------ */
/*  Bảng tin — client cho `/api/news`                                   */
/*                                                                     */
/*  Giữ một bản nhớ dùng chung ở tầng module để mở/đóng bảng tin không  */
/*  gọi lại mạng, và để hai chỗ hiển thị (bảng tin + huy hiệu tin mới)  */
/*  luôn nhìn thấy cùng một dữ liệu.                                    */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";

export type NewsTopic = "crypto" | "stocks" | "vn" | "world";
export const NEWS_TOPICS: NewsTopic[] = ["crypto", "stocks", "vn", "world"];

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  image: string;
  source: string;
  sourceId: string;
  topic: NewsTopic;
  lang: "vi" | "en";
  ts: number;
}

export type NewsStatus = "idle" | "loading" | "ready" | "error";

interface NewsStore {
  items: NewsItem[];
  status: NewsStatus;
  fetchedAt: number;
  error: string;
}

const FEED_URL = (import.meta.env.VITE_NEWS_FEED_URL as string | undefined) || "/api/news";
/** Tin cũ hơn 5 phút thì tải lại; RSS không đổi nhanh hơn thế. */
const REFRESH_MS = 300_000;
const READ_KEY = "vuong-news-read-v1";

export const news: NewsStore = { items: [], status: "idle", fetchedAt: 0, error: "" };

const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}

function isItem(value: unknown): value is NewsItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<NewsItem>;
  return typeof row.title === "string" && typeof row.link === "string" && /^https?:\/\//.test(row.link);
}

let inflight: Promise<void> | null = null;

export function loadNews(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && news.status === "ready" && Date.now() - news.fetchedAt < REFRESH_MS) return Promise.resolve();
  news.status = "loading";
  emit();
  inflight = (async () => {
    try {
      const response = await fetch(FEED_URL, { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as { items?: unknown[] };
      const items = Array.isArray(payload.items) ? payload.items.filter(isItem) : [];
      if (!items.length) throw new Error("empty");
      news.items = items;
      news.fetchedAt = Date.now();
      news.status = "ready";
      news.error = "";
    } catch (error) {
      /* Giữ nguyên tin cũ nếu có — bảng trắng tệ hơn bảng hơi cũ. */
      news.status = news.items.length ? "ready" : "error";
      news.error = error instanceof Error ? error.message : "network";
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

/** Đăng ký nghe thay đổi và tự tải lần đầu. */
export function useNews(): NewsStore {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    void loadNews();
    return () => void listeners.delete(listener);
  }, []);
  return news;
}

/* ------------------------- dấu "đã đọc" ------------------------- */

function readMarker(): number {
  try {
    return Number(localStorage.getItem(READ_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markNewsRead(): void {
  try {
    localStorage.setItem(READ_KEY, String(Date.now()));
  } catch {
    /* Chế độ riêng tư chặn ghi: huy hiệu chỉ hơi kém chính xác, không sao. */
  }
  emit();
}

/** Số tin mới hơn lần mở bảng tin gần nhất — dùng cho huy hiệu trên nút. */
export function unreadCount(): number {
  const marker = readMarker();
  if (!marker) return Math.min(news.items.length, 9);
  return news.items.filter((item) => item.ts > marker).length;
}
