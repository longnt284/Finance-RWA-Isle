import { yahooQuote, stooqQuote } from "./_providers.js";

const CACHE_TTL_MS = 20_000;
const MAX_SYMBOLS = 30;
/** Trần request đồng thời tới upstream để không bị chặn tốc độ. */
const UPSTREAM_CONCURRENCY = 8;
/** Cache tối đa vài trăm mã; xoá mục cũ nhất khi vượt ngưỡng. */
const CACHE_MAX_ENTRIES = 400;
const cache = new Map();

function normalizeSymbols(raw) {
  const seen = new Set();
  for (const symbol of String(raw || "").split(",")) {
    const clean = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.^-]{1,16}$/.test(clean)) continue;
    seen.add(clean);
    if (seen.size >= MAX_SYMBOLS) break;
  }
  return [...seen];
}

/** Chạy `worker` trên từng phần tử với trần đồng thời cố định. */
async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Thử lần lượt từng nguồn cho một mã. Yahoo đi trước vì phủ cả HOSE/HNX lẫn
 * sàn Mỹ; Stooq chỉ đỡ được mã Mỹ nhưng đủ để bảng giá không trắng khi Yahoo
 * chặn theo IP (403) hoặc giới hạn tốc độ (429).
 */
async function fetchQuote(symbol) {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;
  let lastError = new Error("upstream_unreachable");
  let value = null;
  for (const provider of [yahooQuote, stooqQuote]) {
    try {
      value = await provider(symbol);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!value) throw lastError;
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(symbol, { cachedAt: Date.now(), value });
  return value;
}

export default async function handler(request, response) {
  const url = new URL(request.url || "/api/quotes", "http://localhost");
  const symbols = normalizeSymbols(url.searchParams.get("symbols"));
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method && request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, OPTIONS");
    response.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  if (!symbols.length) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "symbols_required" }));
    return;
  }

  const settled = await mapWithLimit(symbols, UPSTREAM_CONCURRENCY, fetchQuote);
  const quotes = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failed = symbols.filter((_, index) => settled[index].status === "rejected");
  response.statusCode = quotes.length ? 200 : 502;
  response.end(JSON.stringify({ quotes, failed, asOf: Date.now() }));
}
