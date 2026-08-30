import { useEffect, useMemo, useSyncExternalStore } from "react";
import { setUsdRate } from "./format";

export type StockSector = "bank" | "realty" | "industrial" | "energy" | "consumer" | "tech" | "finance" | "health";
export type MarketVenue = "crypto" | "vn" | "us";

export interface Asset {
  id: string;
  sym: string;
  name: string;
  type: "crypto" | "stock";
  /** sàn/nhóm thị trường dùng để lọc trong giao diện */
  venue: MarketVenue;
  /** currency the raw price is denominated in */
  cur: "USD" | "VND";
  base: number;
  sector?: StockSector;
}

export interface Quote {
  p: number;
  prev: number;
  ch: number; // 24h %
  due: number; // next update timestamp
  updatedAt: number;
  source: "binance" | "yahoo" | "reference";
  status: "live" | "delayed" | "stale" | "reference";
}

export type MarketConnection = "connecting" | "live" | "partial" | "offline";

/* ------------------------------------------------------------------ */
/*  Top 100 crypto (offline reference anchors, USD)                    */
/* ------------------------------------------------------------------ */

const C: [string, string, number][] = [
  ["BTC", "Bitcoin", 97250], ["ETH", "Ethereum", 3420], ["USDT", "Tether", 1], ["BNB", "BNB", 655],
  ["SOL", "Solana", 196], ["XRP", "XRP", 2.31], ["USDC", "USD Coin", 1], ["ADA", "Cardano", 0.92],
  ["DOGE", "Dogecoin", 0.32], ["AVAX", "Avalanche", 38.4], ["TRX", "TRON", 0.24], ["LINK", "Chainlink", 22.4],
  ["TON", "Toncoin", 5.35], ["DOT", "Polkadot", 7.1], ["POL", "Polygon", 0.52], ["SHIB", "Shiba Inu", 0.000022],
  ["SUI", "Sui", 4.15], ["NEAR", "NEAR Protocol", 5.4], ["LTC", "Litecoin", 104], ["BCH", "Bitcoin Cash", 470],
  ["UNI", "Uniswap", 13.2], ["XLM", "Stellar", 0.42], ["APT", "Aptos", 9.1], ["ETC", "Ethereum Classic", 27.5],
  ["FIL", "Filecoin", 5.3], ["ARB", "Arbitrum", 0.81], ["OP", "Optimism", 1.85], ["INJ", "Injective", 24.6],
  ["ATOM", "Cosmos", 7.2], ["GRT", "The Graph", 0.21], ["IMX", "Immutable", 1.35], ["RNDR", "Render", 7.4],
  ["SEI", "Sei", 0.45], ["TIA", "Celestia", 5.1], ["PEPE", "Pepe", 0.000018], ["WIF", "dogwifhat", 2.1],
  ["FLOKI", "Floki", 0.00016], ["BONK", "Bonk", 0.000031], ["HBAR", "Hedera", 0.28], ["ALGO", "Algorand", 0.34],
  ["VET", "VeChain", 0.045], ["XMR", "Monero", 168], ["FTM", "Fantom", 0.72], ["EOS", "EOS", 0.82],
  ["THETA", "Theta Network", 1.6], ["AAVE", "Aave", 240], ["EGLD", "MultiversX", 33], ["SAND", "The Sandbox", 0.4],
  ["MANA", "Decentraland", 0.42], ["AXS", "Axie Infinity", 6.8], ["CHZ", "Chiliz", 0.088], ["QNT", "Quant", 105],
  ["RUNE", "THORChain", 4.9], ["KAVA", "Kava", 0.62], ["XTZ", "Tezos", 1.05], ["IOTA", "IOTA", 0.28],
  ["NEO", "Neo", 11.5], ["ZEC", "Zcash", 46], ["DASH", "Dash", 38], ["CRV", "Curve DAO", 0.72],
  ["SNX", "Synthetix", 2.3], ["COMP", "Compound", 62], ["YFI", "yearn.finance", 7200], ["SUSHI", "SushiSwap", 1.15],
  ["1INCH", "1inch", 0.42], ["ENS", "ENS", 27], ["LDO", "Lido DAO", 1.85], ["STX", "Stacks", 1.6],
  ["AR", "Arweave", 19.5], ["GALA", "Gala", 0.035], ["APE", "ApeCoin", 1.05], ["DYDX", "dYdX", 1.5],
  ["JUP", "Jupiter", 0.92], ["PYTH", "Pyth Network", 0.38], ["WLD", "Worldcoin", 2.3], ["ORDI", "Ordinals", 34],
  ["TAO", "Bittensor", 480], ["KAS", "Kaspa", 0.14], ["CFX", "Conflux", 0.19], ["ROSE", "Oasis", 0.075],
  ["FLOW", "Flow", 0.85], ["MINA", "Mina", 0.6], ["ZIL", "Zilliqa", 0.023], ["BAT", "Basic Attention", 0.22],
  ["CELO", "Celo", 0.68], ["ICX", "ICON", 0.21], ["ONT", "Ontology", 0.26], ["QTUM", "Qtum", 3.1],
  ["WAVES", "Waves", 1.8], ["KNC", "Kyber Network", 0.58], ["ZRX", "0x", 0.48], ["HOT", "Holo", 0.0024],
  ["RVN", "Ravencoin", 0.028], ["SC", "Siacoin", 0.0058], ["DCR", "Decred", 19.5], ["LSK", "Lisk", 1.05],
  ["ICP", "Internet Computer", 10.8], ["CRO", "Cronos", 0.13], ["OKB", "OKB", 50],
  ["MKR", "Maker", 1620],
];

/* ------------------------------------------------------------------ */
/*  Popular stocks — Vietnam (VND, per share) + US (USD)               */
/* ------------------------------------------------------------------ */

/** 50 mã Việt Nam thanh khoản cao nhất (HOSE/HNX). `base` chỉ là mỏ neo tham chiếu offline. */
const S: [string, string, number, StockSector][] = [
  /* Ngân hàng */
  ["VCB", "Vietcombank", 91500, "bank"], ["BID", "BIDV", 45200, "bank"],
  ["CTG", "VietinBank", 34600, "bank"], ["TCB", "Techcombank", 24800, "bank"],
  ["MBB", "MB Bank", 23400, "bank"], ["ACB", "ACB", 25100, "bank"],
  ["VPB", "VPBank", 19800, "bank"], ["STB", "Sacombank", 33700, "bank"],
  ["HDB", "HDBank", 26400, "bank"], ["TPB", "TPBank", 17200, "bank"],
  ["SHB", "SHB", 11300, "bank"], ["LPB", "LPBank", 31900, "bank"],
  ["VIB", "VIB", 18900, "bank"], ["EIB", "Eximbank", 18600, "bank"],
  /* Bất động sản */
  ["VIC", "Vingroup", 41200, "realty"], ["VHM", "Vinhomes", 42600, "realty"],
  ["VRE", "Vincom Retail", 20100, "realty"], ["NVL", "Novaland", 10400, "realty"],
  ["PDR", "Phat Dat Real Estate", 19700, "realty"], ["DXG", "Dat Xanh Group", 15600, "realty"],
  ["KDH", "Khang Dien House", 33900, "realty"], ["DIG", "DIC Corp", 21800, "realty"],
  /* Công nghiệp · năng lượng */
  ["HPG", "Hoa Phat Group", 27800, "industrial"], ["HSG", "Hoa Sen Group", 20700, "industrial"],
  ["NKG", "Nam Kim Steel", 15400, "industrial"], ["DGC", "Duc Giang Chemicals", 112300, "industrial"],
  ["DCM", "Ca Mau Fertilizer", 36800, "industrial"], ["DPM", "PetroVietnam Fertilizer", 34200, "industrial"],
  ["GVR", "Vietnam Rubber Group", 21600, "industrial"], ["PLX", "Petrolimex", 41500, "energy"],
  ["GAS", "PV Gas", 70100, "energy"], ["POW", "PV Power", 12400, "energy"],
  ["PVD", "PV Drilling", 25300, "energy"],
  /* Tiêu dùng */
  ["VNM", "Vinamilk", 65300, "consumer"], ["MSN", "Masan Group", 74200, "consumer"],
  ["SAB", "Sabeco", 56800, "consumer"], ["MWG", "Mobile World", 62400, "consumer"],
  ["PNJ", "Phu Nhuan Jewelry", 97600, "consumer"], ["FRT", "FPT Retail", 178000, "consumer"],
  ["DGW", "Digiworld", 45300, "consumer"], ["VHC", "Vinh Hoan", 68900, "consumer"],
  /* Công nghệ */
  ["FPT", "FPT Corp", 135200, "tech"], ["CMG", "CMC Corp", 41800, "tech"],
  /* Chứng khoán */
  ["SSI", "SSI Securities", 26800, "finance"], ["VND", "VNDirect", 15900, "finance"],
  ["VCI", "Vietcap Securities", 41600, "finance"], ["HCM", "HSC Securities", 26200, "finance"],
  /* Vận tải · bảo hiểm */
  ["VJC", "Vietjet Air", 103500, "industrial"], ["GMD", "Gemadept", 68400, "industrial"],
  ["BVH", "Bao Viet Holdings", 47800, "finance"],
];

/** 100 mã Mỹ được theo dõi nhiều nhất. */
const US: [string, string, number, StockSector][] = [
  /* Bán dẫn & phần cứng */
  ["AAPL", "Apple", 232.4, "tech"], ["MSFT", "Microsoft", 428.6, "tech"],
  ["NVDA", "NVIDIA", 138.9, "tech"], ["AVGO", "Broadcom", 228.5, "tech"],
  ["AMD", "Advanced Micro Devices", 142.8, "tech"], ["INTC", "Intel", 24.1, "tech"],
  ["QCOM", "Qualcomm", 168.3, "tech"], ["TXN", "Texas Instruments", 198.4, "tech"],
  ["MU", "Micron Technology", 102.6, "tech"], ["AMAT", "Applied Materials", 178.2, "tech"],
  ["LRCX", "Lam Research", 76.4, "tech"], ["KLAC", "KLA Corp", 645.8, "tech"],
  ["ADI", "Analog Devices", 218.7, "tech"], ["ARM", "Arm Holdings", 138.2, "tech"],
  ["TSM", "TSMC", 198.6, "tech"], ["ASML", "ASML Holding", 712.4, "tech"],
  ["SMCI", "Super Micro Computer", 34.8, "tech"], ["MRVL", "Marvell Technology", 108.5, "tech"],
  ["NXPI", "NXP Semiconductors", 224.6, "tech"], ["ON", "ON Semiconductor", 68.4, "tech"],
  ["SNPS", "Synopsys", 512.3, "tech"], ["CDNS", "Cadence Design", 302.7, "tech"],
  ["ANET", "Arista Networks", 118.4, "tech"], ["DELL", "Dell Technologies", 122.6, "tech"],
  ["HPQ", "HP Inc", 34.2, "tech"],
  /* Phần mềm & internet */
  ["GOOGL", "Alphabet", 191.2, "tech"], ["AMZN", "Amazon", 219.7, "consumer"],
  ["META", "Meta Platforms", 585.4, "tech"], ["NFLX", "Netflix", 872.5, "consumer"],
  ["ORCL", "Oracle", 178.4, "tech"], ["CRM", "Salesforce", 342.6, "tech"],
  ["ADBE", "Adobe", 486.2, "tech"], ["NOW", "ServiceNow", 1042.5, "tech"],
  ["INTU", "Intuit", 632.4, "tech"], ["IBM", "IBM", 224.8, "tech"],
  ["PANW", "Palo Alto Networks", 188.6, "tech"], ["CRWD", "CrowdStrike", 348.2, "tech"],
  ["SNOW", "Snowflake", 168.4, "tech"], ["DDOG", "Datadog", 142.8, "tech"],
  ["NET", "Cloudflare", 108.6, "tech"], ["ZS", "Zscaler", 198.4, "tech"],
  ["SHOP", "Shopify", 108.2, "tech"], ["UBER", "Uber Technologies", 68.4, "tech"],
  ["ABNB", "Airbnb", 134.6, "consumer"], ["RBLX", "Roblox", 58.2, "tech"],
  /* Thanh toán & crypto-adjacent */
  ["V", "Visa", 312.4, "finance"], ["MA", "Mastercard", 522.6, "finance"],
  ["PYPL", "PayPal", 88.4, "finance"], ["COIN", "Coinbase", 262.3, "finance"],
  ["MSTR", "MicroStrategy", 395.0, "finance"], ["HOOD", "Robinhood", 38.6, "finance"],
  ["SOFI", "SoFi Technologies", 15.2, "finance"], ["AXP", "American Express", 298.4, "finance"],
  ["BLK", "BlackRock", 1024.6, "finance"], ["GS", "Goldman Sachs", 588.2, "finance"],
  /* Ngân hàng & tài chính */
  ["JPM", "JPMorgan Chase", 242.6, "bank"], ["BAC", "Bank of America", 46.2, "bank"],
  ["WFC", "Wells Fargo", 74.8, "bank"], ["MS", "Morgan Stanley", 128.4, "bank"],
  ["C", "Citigroup", 70.2, "bank"], ["SCHW", "Charles Schwab", 78.6, "finance"],
  ["BRK-B", "Berkshire Hathaway B", 468.2, "finance"], ["SPGI", "S&P Global", 512.4, "finance"],
  /* Y tế */
  ["LLY", "Eli Lilly", 782.4, "health"], ["UNH", "UnitedHealth", 568.2, "health"],
  ["JNJ", "Johnson & Johnson", 152.6, "health"], ["ABBV", "AbbVie", 178.4, "health"],
  ["MRK", "Merck", 98.6, "health"], ["PFE", "Pfizer", 25.4, "health"],
  ["TMO", "Thermo Fisher", 528.6, "health"], ["ABT", "Abbott Laboratories", 114.2, "health"],
  ["AMGN", "Amgen", 288.4, "health"], ["ISRG", "Intuitive Surgical", 528.4, "health"],
  /* Tiêu dùng */
  ["WMT", "Walmart", 92.4, "consumer"], ["COST", "Costco", 928.6, "consumer"],
  ["HD", "Home Depot", 412.8, "consumer"], ["PG", "Procter & Gamble", 168.4, "consumer"],
  ["KO", "Coca-Cola", 62.8, "consumer"], ["PEP", "PepsiCo", 152.4, "consumer"],
  ["MCD", "McDonald's", 292.6, "consumer"], ["SBUX", "Starbucks", 98.2, "consumer"],
  ["NKE", "Nike", 76.4, "consumer"], ["TGT", "Target", 132.6, "consumer"],
  ["LOW", "Lowe's", 258.4, "consumer"], ["DIS", "Walt Disney", 112.8, "consumer"],
  /* Năng lượng & công nghiệp */
  ["XOM", "Exxon Mobil", 118.4, "energy"], ["CVX", "Chevron", 158.2, "energy"],
  ["COP", "ConocoPhillips", 108.6, "energy"], ["CAT", "Caterpillar", 386.4, "industrial"],
  ["DE", "Deere & Co", 448.2, "industrial"], ["BA", "Boeing", 158.6, "industrial"],
  ["GE", "GE Aerospace", 188.4, "industrial"], ["HON", "Honeywell", 224.6, "industrial"],
  ["LMT", "Lockheed Martin", 512.8, "industrial"], ["RTX", "RTX Corp", 118.2, "industrial"],
  /* Xe điện & tăng trưởng */
  ["TSLA", "Tesla", 342.2, "consumer"], ["RIVN", "Rivian", 12.8, "consumer"],
  ["LCID", "Lucid Group", 2.9, "consumer"], ["PLTR", "Palantir", 72.6, "tech"],
  ["F", "Ford Motor", 10.8, "consumer"],
];

export const ASSETS: Asset[] = [
  ...C.map(([sym, name, base], i) => ({ id: `c${i}`, sym, name, type: "crypto" as const, venue: "crypto" as const, cur: "USD" as const, base })),
  ...S.map(([sym, name, base, sector], i) => ({ id: `v${i}`, sym, name, type: "stock" as const, venue: "vn" as const, cur: "VND" as const, base, sector })),
  ...US.map(([sym, name, base, sector], i) => ({ id: `u${i}`, sym, name, type: "stock" as const, venue: "us" as const, cur: "USD" as const, base, sector })),
];

export const ASSET_BY_ID = new Map(ASSETS.map((a) => [a.id, a]));
export const ASSET_BY_SYMBOL = new Map(ASSETS.map((a) => [`${a.venue}:${a.sym}`, a]));
export const VENUE_COUNTS: Record<MarketVenue, number> = {
  crypto: C.length,
  vn: S.length,
  us: US.length,
};
/** BTC · ETH · SOL · XRP · DOGE · VCB · CTG · NVDA */
export const DEFAULT_WATCH = ["c0", "c1", "c4", "c5", "c8", "v0", "v2", "u2"];

/** Ký hiệu Yahoo Finance cho một mã cổ phiếu. */
export function yahooSymbol(asset: Asset): string {
  return asset.venue === "vn" ? `${asset.sym}.VN` : asset.sym;
}

/* ------------------------------------------------------------------ */
/*  Resilient realtime store                                           */
/* ------------------------------------------------------------------ */

/** Mỗi request tới proxy gửi tối đa 25 mã; nhiều lô chạy song song. */
const EQUITY_CHUNK = 25;
/** Trần số mã cổ phiếu lấy giá mỗi vòng — đủ cho watchlist + cửa sổ đang hiển thị. */
const EQUITY_MAX_TRACKED = 75;
/** Trần số cặp crypto mở trên một kết nối WebSocket. */
const CRYPTO_MAX_STREAMS = 60;
const STALE_AFTER_MS = 10 * 60_000;

class MarketStore {
  quotes: Record<string, Quote> = {};
  private equityInFlight = false;
  private version = 0;
  private listeners = new Set<() => void>();
  private started = false;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private equityTimer: ReturnType<typeof setInterval> | null = null;
  private fxTimer: ReturnType<typeof setInterval> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1500;
  private socket: WebSocket | null = null;
  private tracked = new Set<string>(DEFAULT_WATCH);
  private trackedRefs = new Map<string, number>();
  private socketKey = "";
  lastGlobalUpdate = 0;
  connection: MarketConnection = "connecting";
  lastError = "";

  constructor() {
    const now = Date.now();
    for (const a of ASSETS) {
      this.quotes[a.id] = {
        p: a.base,
        prev: a.base,
        ch: 0,
        due: now,
        updatedAt: 0,
        source: "reference",
        status: "reference",
      };
    }
  }

  ensureStarted() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.connection = navigator.onLine ? "connecting" : "offline";
    this.connectCrypto();
    void this.refreshEquities();
    void this.refreshFx();
    this.healthTimer = window.setInterval(() => this.checkHealth(), 5000);
    this.equityTimer = window.setInterval(() => void this.refreshEquities(), 60_000);
    this.fxTimer = window.setInterval(() => void this.refreshFx(), 30 * 60_000);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  trackAssets(ids: readonly string[]): () => void {
    let cryptoChanged = false;
    let stocksChanged = false;
    const validIds = [...new Set(ids)].filter((id) => ASSET_BY_ID.has(id));
    for (const id of validIds) {
      this.trackedRefs.set(id, (this.trackedRefs.get(id) ?? 0) + 1);
      if (this.tracked.has(id)) continue;
      this.tracked.add(id);
      if (ASSET_BY_ID.get(id)?.type === "crypto") cryptoChanged = true;
      else stocksChanged = true;
    }
    if (this.started && cryptoChanged) this.scheduleReconnect();
    if (this.started && stocksChanged) void this.refreshEquities();

    return () => {
      let removedCrypto = false;
      for (const id of validIds) {
        const remaining = (this.trackedRefs.get(id) ?? 1) - 1;
        if (remaining > 0) {
          this.trackedRefs.set(id, remaining);
          continue;
        }
        this.trackedRefs.delete(id);
        if (DEFAULT_WATCH.includes(id)) continue;
        this.tracked.delete(id);
        if (ASSET_BY_ID.get(id)?.type === "crypto") removedCrypto = true;
      }
      if (this.started && removedCrypto) this.scheduleReconnect();
    };
  }

  private handleOnline = () => {
    this.connection = "connecting";
    this.lastError = "";
    this.connectCrypto();
    void this.refreshEquities();
    void this.refreshFx();
    this.publish();
  };

  private handleOffline = () => {
    this.connection = "offline";
    this.socket?.close();
    this.publish();
  };

  private binanceSymbol(asset: Asset): string | null {
    if (asset.type !== "crypto") return null;
    if (asset.sym === "USDT") return null;
    const renamed: Record<string, string> = { RNDR: "RENDER", POL: "POL" };
    return `${renamed[asset.sym] ?? asset.sym}USDT`;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connectCrypto(), 350);
  }

  private connectCrypto() {
    if (!navigator.onLine || typeof WebSocket === "undefined") return;
    const assets = [...this.tracked]
      .map((id) => ASSET_BY_ID.get(id))
      .filter((asset): asset is Asset => Boolean(asset?.type === "crypto"))
      .slice(0, CRYPTO_MAX_STREAMS);
    const symbols = assets.map((asset) => this.binanceSymbol(asset)).filter((symbol): symbol is string => Boolean(symbol));
    const key = symbols.sort().join("/");
    if (!key) return;
    if (this.socket?.readyState === WebSocket.OPEN && this.socketKey === key) return;
    this.socketKey = key;
    this.socket?.close();
    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");
    const socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    this.socket = socket;
    this.connection = "connecting";
    this.publish();

    socket.addEventListener("open", () => {
      if (this.socket !== socket) return;
      this.reconnectDelay = 1500;
      this.connection = "live";
      this.lastError = "";
      const stable = ASSETS.find((asset) => asset.sym === "USDT" && asset.type === "crypto");
      if (stable) this.applyQuote(stable.id, 1, 0, "binance", "live");
    });
    socket.addEventListener("message", (event) => {
      if (this.socket !== socket) return;
      try {
        const envelope = JSON.parse(String(event.data)) as { data?: { s?: string; c?: string; P?: string } };
        const ticker = envelope.data;
        if (!ticker?.s || !ticker.c) return;
        const asset = assets.find((candidate) => this.binanceSymbol(candidate) === ticker.s);
        if (!asset) return;
        this.applyQuote(asset.id, Number(ticker.c), Number(ticker.P ?? 0), "binance", "live");
      } catch {
        // Ignore one malformed packet; the next tick will replace it.
      }
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) return;
      this.lastError = "crypto_stream";
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (!navigator.onLine) return;
      this.connection = this.lastGlobalUpdate ? "partial" : "offline";
      this.publish();
      this.reconnectTimer = window.setTimeout(() => this.connectCrypto(), this.reconnectDelay);
      this.reconnectDelay = Math.min(30_000, this.reconnectDelay * 1.8);
    });
  }

  private async refreshEquities() {
    if (!navigator.onLine || this.equityInFlight) return;
    const assets = [...this.tracked]
      .map((id) => ASSET_BY_ID.get(id))
      .filter((asset): asset is Asset => Boolean(asset?.type === "stock"))
      .slice(0, EQUITY_MAX_TRACKED);
    if (!assets.length) return;
    this.equityInFlight = true;
    const chunks: Asset[][] = [];
    for (let i = 0; i < assets.length; i += EQUITY_CHUNK) chunks.push(assets.slice(i, i + EQUITY_CHUNK));
    try {
      const results = await Promise.all(chunks.map((chunk) => this.fetchEquityChunk(chunk)));
      const failed = results.reduce((sum, count) => sum + count, 0);
      if (failed && this.connection !== "offline") this.connection = "partial";
      else if (!failed && this.lastGlobalUpdate) this.connection = this.socket?.readyState === WebSocket.OPEN ? "live" : "partial";
      this.publish();
    } finally {
      this.equityInFlight = false;
    }
  }

  /** Trả về số mã thất bại trong lô. Một lô hỏng không kéo đổ các lô còn lại. */
  private async fetchEquityChunk(assets: Asset[]): Promise<number> {
    const symbolToAsset = new Map(assets.map((asset) => [yahooSymbol(asset), asset]));
    const configuredFeed = (import.meta.env.VITE_EQUITY_FEED_URL as string | undefined)?.replace(/\/$/, "");
    const endpoint = configuredFeed || "/api/quotes";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    const markStale = () => {
      for (const asset of assets) {
        const quote = this.quotes[asset.id];
        if (quote.updatedAt && Date.now() - quote.updatedAt > STALE_AFTER_MS) quote.status = "stale";
      }
    };
    try {
      const symbols = [...symbolToAsset.keys()];
      const response = await fetch(`${endpoint}?symbols=${encodeURIComponent(symbols.join(","))}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as {
        quotes?: Array<{ symbol: string; price: number; previousClose: number | null; updatedAt: number }>;
        failed?: string[];
      };
      for (const item of payload.quotes ?? []) {
        const asset = symbolToAsset.get(item.symbol);
        if (!asset) continue;
        const previous = Number(item.previousClose);
        const change = Number.isFinite(previous) && previous > 0 ? ((item.price - previous) / previous) * 100 : 0;
        this.applyQuote(asset.id, item.price, change, "yahoo", "delayed");
      }
      for (const symbol of payload.failed ?? []) {
        const asset = symbolToAsset.get(symbol);
        const quote = asset ? this.quotes[asset.id] : null;
        if (quote?.updatedAt && Date.now() - quote.updatedAt > STALE_AFTER_MS) quote.status = "stale";
      }
      return payload.failed?.length ?? 0;
    } catch {
      markStale();
      this.lastError = "equity_feed";
      if (!this.lastGlobalUpdate) this.connection = "offline";
      return assets.length;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async refreshFx() {
    if (!navigator.onLine) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { rates?: { VND?: number } };
      if (payload.rates?.VND) setUsdRate(payload.rates.VND);
      this.publish();
    } catch {
      this.lastError ||= "fx_feed";
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private applyQuote(id: string, price: number, change: number, source: Quote["source"], status: Quote["status"]) {
    if (!Number.isFinite(price) || price <= 0) return;
    const now = Date.now();
    const quote = this.quotes[id];
    quote.prev = quote.p;
    quote.p = price;
    quote.ch = Number.isFinite(change) ? change : quote.ch;
    quote.due = source === "binance" ? now + 15_000 : now + 60_000;
    quote.updatedAt = now;
    quote.source = source;
    quote.status = status;
    this.lastGlobalUpdate = now;
    this.publish();
  }

  private checkHealth() {
    const now = Date.now();
    let changed = false;
    for (const id of this.tracked) {
      const quote = this.quotes[id];
      if (!quote?.updatedAt || quote.status === "reference") continue;
      const maxAge = quote.source === "binance" ? 45_000 : STALE_AFTER_MS;
      if (now - quote.updatedAt > maxAge && quote.status !== "stale") {
        quote.status = "stale";
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  private publish() {
    if (this.notifyTimer) return;
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null;
      this.version++;
      this.listeners.forEach((listener) => listener());
    }, 160);
  }

  nextDue(): number {
    const due = this.equityTimer ? this.lastGlobalUpdate + 60_000 : Date.now();
    return Math.max(0, Math.round((due - Date.now()) / 1000));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
}

export const market = new MarketStore();

export function useMarket(assetIds: readonly string[] = []): number {
  const key = useMemo(() => assetIds.join(","), [assetIds]);
  useEffect(() => {
    market.ensureStarted();
    return market.trackAssets(key ? key.split(",") : []);
  }, [key]);
  return useSyncExternalStore(market.subscribe, market.getVersion, market.getVersion);
}
