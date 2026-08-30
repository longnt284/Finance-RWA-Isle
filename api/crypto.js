/* ------------------------------------------------------------------ */
/*  /api/crypto — giá crypto qua máy chủ                               */
/*                                                                     */
/*  Trình duyệt vẫn ưu tiên WebSocket Binance vì nó nhanh nhất. Endpoint*/
/*  này là đường lui khi WebSocket không mở được — hay gặp ở các mạng   */
/*  chặn Binance. Hàm chạy trên hạ tầng hosting nên không dính chặn đó. */
/* ------------------------------------------------------------------ */

import { binanceQuotes, coingeckoQuotes, cmcQuotes } from "./_providers.js";

const CACHE_TTL_MS = 15_000;
const MAX_SYMBOLS = 60;
let cache = { at: 0, key: "", value: null };

function normalizeSymbols(raw) {
  const seen = new Set();
  for (const symbol of String(raw || "").split(",")) {
    const clean = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,12}$/.test(clean)) continue;
    seen.add(clean);
    if (seen.size >= MAX_SYMBOLS) break;
  }
  return [...seen];
}

/** Chạy lần lượt các nguồn, mỗi vòng chỉ hỏi phần còn thiếu. */
async function collect(symbols) {
  const found = new Map();
  const tried = [];
  for (const provider of [binanceQuotes, coingeckoQuotes, cmcQuotes]) {
    const missing = symbols.filter((symbol) => !found.has(symbol));
    if (!missing.length) break;
    try {
      const rows = await provider(missing);
      for (const row of rows) if (!found.has(row.symbol)) found.set(row.symbol, row);
      tried.push({ provider: provider.name, ok: rows.length });
    } catch (error) {
      tried.push({ provider: provider.name, error: String(error?.message || error) });
    }
  }
  return { quotes: [...found.values()], tried };
}

export default async function handler(request, response) {
  const url = new URL(request.url || "/api/crypto", "http://localhost");
  const symbols = normalizeSymbols(url.searchParams.get("symbols"));
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
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

  const key = symbols.slice().sort().join(",");
  if (cache.value && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    response.statusCode = 200;
    response.end(JSON.stringify(cache.value));
    return;
  }

  const { quotes, tried } = await collect(symbols);
  const failed = symbols.filter((symbol) => !quotes.some((quote) => quote.symbol === symbol));
  const body = { quotes, failed, tried, asOf: Date.now() };
  if (quotes.length) cache = { at: Date.now(), key, value: body };
  response.statusCode = quotes.length ? 200 : 502;
  response.end(JSON.stringify(body));
}
