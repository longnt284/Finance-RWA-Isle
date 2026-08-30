const CACHE_TTL_MS = 20_000;
const cache = new Map();

function normalizeSymbols(raw) {
  return String(raw || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.^-]{1,16}$/.test(symbol))
    .slice(0, 24);
}

async function fetchQuote(symbol) {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
    {
      headers: { "User-Agent": "Finance-RWA-Isle/1.0" },
      signal: AbortSignal.timeout(7_500),
    }
  );
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  const payload = await response.json();
  const meta = payload?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
  if (!Number.isFinite(price) || price <= 0) throw new Error("invalid_quote");
  const value = {
    symbol,
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    currency: meta?.currency || null,
    marketState: meta?.marketState || null,
    updatedAt: Date.now(),
  };
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

  const settled = await Promise.allSettled(symbols.map(fetchQuote));
  const quotes = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failed = symbols.filter((_, index) => settled[index].status === "rejected");
  response.statusCode = quotes.length ? 200 : 502;
  response.end(JSON.stringify({ quotes, failed, asOf: Date.now() }));
}
