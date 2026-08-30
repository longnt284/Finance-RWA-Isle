/* ------------------------------------------------------------------ */
/*  Nhà cung cấp giá — chạy phía máy chủ                               */
/*                                                                     */
/*  Đặt ở server chứ không ở trình duyệt vì hai lý do: tránh CORS, và   */
/*  tránh việc nhà mạng của người chơi chặn thẳng Binance hay Yahoo.    */
/*  Hàm serverless đi ra từ mạng của nhà cung cấp hosting nên không     */
/*  dính các chặn theo vùng đó.                                        */
/* ------------------------------------------------------------------ */

const UA = "Finance-RWA-Isle/1.0";

async function getJson(url, timeoutMs = 7_500, headers = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return response.json();
}

async function getText(url, timeoutMs = 7_500) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return response.text();
}

/* --------------------------- cổ phiếu --------------------------- */

/** Yahoo Finance. `query2` là host dự phòng khi `query1` trả 403/429. */
export async function yahooQuote(symbol) {
  let lastError = new Error("upstream_unreachable");
  for (const host of ["query1", "query2"]) {
    try {
      const payload = await getJson(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`
      );
      const meta = payload?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
      if (!Number.isFinite(price) || price <= 0) throw new Error("invalid_quote");
      return {
        symbol,
        price,
        previousClose: Number.isFinite(previousClose) ? previousClose : null,
        currency: meta?.currency || null,
        marketState: meta?.marketState || null,
        source: `yahoo:${host}`,
        updatedAt: Date.now(),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Stooq — dự phòng cho cổ phiếu Mỹ, không cần khoá API. Chỉ nhận mã Mỹ:
 * Stooq không phủ sóng HOSE/HNX nên mã `.VN` vẫn phải trông vào Yahoo.
 */
export async function stooqQuote(symbol) {
  if (symbol.includes(".")) throw new Error("stooq_unsupported_symbol");
  const csv = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d`);
  const rows = csv.trim().split("\n");
  /* Header + ít nhất hai phiên: cần phiên trước để tính biến động. */
  if (rows.length < 3) throw new Error("stooq_no_data");
  const closeOf = (row) => Number(row.split(",")[4]);
  const price = closeOf(rows[rows.length - 1]);
  const previousClose = closeOf(rows[rows.length - 2]);
  if (!Number.isFinite(price) || price <= 0) throw new Error("invalid_quote");
  return {
    symbol,
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    currency: "USD",
    marketState: null,
    source: "stooq",
    updatedAt: Date.now(),
  };
}

/* ---------------------------- crypto ---------------------------- */

/**
 * Mã CoinGecko cho từng ký hiệu. Bản đồ này chỉ là gợi ý: `coingeckoQuotes`
 * đối chiếu lại `symbol` mà CoinGecko trả về, nên một mã sai sẽ bị bỏ qua
 * chứ không bao giờ hiện thành giá của đồng khác.
 */
export const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", BNB: "binancecoin",
  SOL: "solana", XRP: "ripple", USDC: "usd-coin", ADA: "cardano",
  DOGE: "dogecoin", AVAX: "avalanche-2", TRX: "tron", LINK: "chainlink",
  TON: "the-open-network", DOT: "polkadot", SHIB: "shiba-inu", SUI: "sui",
  NEAR: "near", LTC: "litecoin", BCH: "bitcoin-cash", UNI: "uniswap",
  XLM: "stellar", APT: "aptos", ETC: "ethereum-classic", FIL: "filecoin",
  ARB: "arbitrum", OP: "optimism", INJ: "injective-protocol", ATOM: "cosmos",
  GRT: "the-graph", IMX: "immutable-x", SEI: "sei-network", TIA: "celestia",
  PEPE: "pepe", FLOKI: "floki", BONK: "bonk", HBAR: "hedera-hashgraph",
  ALGO: "algorand", VET: "vechain", XMR: "monero", EOS: "eos",
  THETA: "theta-token", AAVE: "aave", SAND: "the-sandbox", MANA: "decentraland",
  AXS: "axie-infinity", CHZ: "chiliz", QNT: "quant-network", RUNE: "thorchain",
  KAVA: "kava", XTZ: "tezos", IOTA: "iota", NEO: "neo", ZEC: "zcash",
  DASH: "dash", CRV: "curve-dao-token", SUSHI: "sushi", ENS: "ethereum-name-service",
  LDO: "lido-dao", AR: "arweave", GALA: "gala", APE: "apecoin",
  PYTH: "pyth-network", TAO: "bittensor", KAS: "kaspa", ROSE: "oasis-network",
  FLOW: "flow", MINA: "mina-protocol", ZIL: "zilliqa", BAT: "basic-attention-token",
  CELO: "celo", ICX: "icon", ONT: "ontology", QTUM: "qtum", WAVES: "waves",
  ZRX: "0x", HOT: "holotoken", RVN: "ravencoin", SC: "siacoin", DCR: "decred",
  LSK: "lisk", ICP: "internet-computer", CRO: "crypto-com-chain", MKR: "maker",
  FTM: "fantom", EGLD: "elrond-erd-2", SNX: "havven", COMP: "compound-governance-token",
  YFI: "yearn-finance", STX: "blockstack", WLD: "worldcoin-wld", CFX: "conflux-token",
  KNC: "kyber-network-crystal",
};

/** Vài ký hiệu Binance khác với ký hiệu hiển thị trong ứng dụng. */
const BINANCE_RENAMES = { RNDR: "RENDER" };

/** Binance REST — phủ gần hết danh sách, không cần khoá API. */
export async function binanceQuotes(symbols) {
  const wanted = symbols.filter((symbol) => symbol !== "USDT");
  if (!wanted.length) return [];
  const pairs = wanted.map((symbol) => `${BINANCE_RENAMES[symbol] ?? symbol}USDT`);
  const payload = await getJson(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`,
    9_000
  );
  if (!Array.isArray(payload)) throw new Error("invalid_payload");
  const byPair = new Map(payload.map((row) => [row.symbol, row]));
  const out = [];
  for (const symbol of wanted) {
    const row = byPair.get(`${BINANCE_RENAMES[symbol] ?? symbol}USDT`);
    const price = Number(row?.lastPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      symbol,
      price,
      changePct: Number(row.priceChangePercent) || 0,
      source: "binance",
      updatedAt: Date.now(),
    });
  }
  return out;
}

/**
 * CoinGecko — dự phòng khi Binance không trả lời. Bắt buộc đối chiếu ký hiệu
 * CoinGecko trả về với ký hiệu đang hỏi: nếu bản đồ `COINGECKO_IDS` có một mã
 * sai thì mục đó bị loại, thà thiếu giá còn hơn hiện giá của đồng khác.
 */
export async function coingeckoQuotes(symbols) {
  const pairs = symbols
    .map((symbol) => [symbol, COINGECKO_IDS[symbol]])
    .filter(([, id]) => typeof id === "string" && id);
  if (!pairs.length) return [];
  const ids = pairs.map(([, id]) => id);
  const payload = await getJson(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids.join(","))}&per_page=250`,
    9_000
  );
  if (!Array.isArray(payload)) throw new Error("invalid_payload");
  const byId = new Map(payload.map((row) => [row.id, row]));
  const out = [];
  for (const [symbol, id] of pairs) {
    const row = byId.get(id);
    if (!row) continue;
    /* Chốt chặn chống bản đồ mã sai. */
    if (String(row.symbol || "").toUpperCase() !== symbol) continue;
    const price = Number(row.current_price);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      symbol,
      price,
      changePct: Number(row.price_change_percentage_24h) || 0,
      source: "coingecko",
      updatedAt: Date.now(),
    });
  }
  return out;
}

/**
 * CoinMarketCap — chỉ bật khi có `CMC_API_KEY` trong biến môi trường máy chủ.
 * Khoá nằm ở server, không bao giờ đi vào bundle trình duyệt.
 */
export async function cmcQuotes(symbols) {
  const key = process.env.CMC_API_KEY;
  if (!key || !symbols.length) return [];
  const payload = await getJson(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbols.join(","))}&convert=USD`,
    9_000,
    { "X-CMC_PRO_API_KEY": key }
  );
  const data = payload?.data ?? {};
  const out = [];
  for (const symbol of symbols) {
    const entry = Array.isArray(data[symbol]) ? data[symbol][0] : data[symbol];
    const price = Number(entry?.quote?.USD?.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      symbol,
      price,
      changePct: Number(entry.quote.USD.percent_change_24h) || 0,
      source: "coinmarketcap",
      updatedAt: Date.now(),
    });
  }
  return out;
}
