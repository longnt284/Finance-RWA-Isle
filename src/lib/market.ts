import { useEffect, useMemo, useSyncExternalStore } from "react";
import { setUsdRate } from "./format";

export interface Asset {
  id: string;
  sym: string;
  name: string;
  type: "crypto" | "stock";
  /** currency the raw price is denominated in */
  cur: "USD" | "VND";
  base: number;
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
];

/* ------------------------------------------------------------------ */
/*  Popular stocks — Vietnam (VND, per share) + US (USD)               */
/* ------------------------------------------------------------------ */

const S: [string, string, number][] = [
  ["FPT", "FPT Corp", 135200], ["VCB", "Vietcombank", 91500], ["HPG", "Hoa Phat", 27800],
  ["VNM", "Vinamilk", 65300], ["MWG", "Mobile World", 62400], ["VIC", "Vingroup", 41200],
  ["VHM", "Vinhomes", 42600], ["GAS", "PV Gas", 70100], ["SSI", "SSI Securities", 26800],
  ["VND", "VNDirect", 15900], ["REE", "REE Corp", 68200], ["PNJ", "Phu Nhuan Jewelry", 97600],
  ["DGC", "Duc Giang Chemical", 112300], ["SAB", "Sabeco", 56800], ["VJC", "Vietjet Air", 103500],
  ["POW", "PV Power", 12400], ["BVH", "Bao Viet", 47800], ["GVR", "Rubber Group", 21600],
  ["MSN", "Masan Group", 74200], ["CTG", "VietinBank", 34600], ["BID", "BIDV", 45200],
  ["TCB", "Techcombank", 24800], ["MBB", "MB Bank", 23400], ["ACB", "ACB Bank", 25100],
  ["STB", "Sacombank", 33700], ["LPB", "LPBank", 31900], ["DPM", "PV Fertilizer", 34200],
  ["PVD", "PV Drilling", 25300], ["VRE", "Vincom Retail", 20100], ["DIG", "DIC Corp", 21800],
  ["NVL", "Novaland", 10400], ["KDH", "Khang Dien", 33900], ["NLG", "Nam Long", 38500],
  ["HSG", "Hoa Sen Group", 20700], ["VCI", "Vietcap", 41600], ["SHS", "Saigon-Hanoi Sec.", 13800],
  ["HCM", "HSC Securities", 26200], ["FUEVFVND", "Diamond ETF", 27400],
];

const US: [string, string, number][] = [
  ["AAPL", "Apple", 232.4], ["MSFT", "Microsoft", 428.6], ["NVDA", "NVIDIA", 138.9],
  ["TSLA", "Tesla", 342.2], ["AMD", "AMD", 142.8], ["META", "Meta Platforms", 585.4],
  ["AMZN", "Amazon", 219.7], ["GOOGL", "Alphabet", 191.2], ["NFLX", "Netflix", 872.5],
  ["COIN", "Coinbase", 262.3], ["MSTR", "MicroStrategy", 395.0], ["PLTR", "Palantir", 72.6],
];

export const ASSETS: Asset[] = [
  ...C.map(([sym, name, base], i) => ({ id: `c${i}`, sym, name, type: "crypto" as const, cur: "USD" as const, base })),
  ...S.map(([sym, name, base], i) => ({ id: `v${i}`, sym, name, type: "stock" as const, cur: "VND" as const, base })),
  ...US.map(([sym, name, base], i) => ({ id: `u${i}`, sym, name, type: "stock" as const, cur: "USD" as const, base })),
];

export const ASSET_BY_ID = new Map(ASSETS.map((a) => [a.id, a]));
export const DEFAULT_WATCH = ["c0", "c1", "c4", "c5", "c8", "v0", "v2", "u2"];

/* ------------------------------------------------------------------ */
/*  Resilient realtime store                                           */
/* ------------------------------------------------------------------ */

class MarketStore {
  quotes: Record<string, Quote> = {};
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
      .slice(0, 36);
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
    if (!navigator.onLine) return;
    const assets = [...this.tracked]
      .map((id) => ASSET_BY_ID.get(id))
      .filter((asset): asset is Asset => Boolean(asset?.type === "stock"))
      .slice(0, 18);
    if (!assets.length) return;
    const symbolToAsset = new Map(assets.map((asset) => [asset.cur === "VND" ? `${asset.sym}.VN` : asset.sym, asset]));
    const configuredFeed = (import.meta.env.VITE_EQUITY_FEED_URL as string | undefined)?.replace(/\/$/, "");
    const endpoint = configuredFeed || "/api/quotes";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
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
      if (payload.failed?.length) {
        for (const symbol of payload.failed) {
          const asset = symbolToAsset.get(symbol);
          const quote = asset ? this.quotes[asset.id] : null;
          if (quote?.updatedAt && Date.now() - quote.updatedAt > 10 * 60_000) quote.status = "stale";
        }
        this.connection = "partial";
      }
    } catch {
      for (const asset of assets) {
        const quote = this.quotes[asset.id];
        if (quote.updatedAt && Date.now() - quote.updatedAt > 10 * 60_000) quote.status = "stale";
      }
      this.connection = this.lastGlobalUpdate ? "partial" : "offline";
      this.lastError = "equity_feed";
      this.publish();
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
      const maxAge = quote.source === "binance" ? 45_000 : 10 * 60_000;
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
