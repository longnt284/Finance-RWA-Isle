import { useSyncExternalStore } from "react";

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
}

/* ------------------------------------------------------------------ */
/*  Top 100 crypto (simulated anchors, USD)                            */
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
/*  Live simulated store                                               */
/* ------------------------------------------------------------------ */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface MarketEvent {
  id: "whale" | "pump" | "dump" | "vni" | "fed";
  sym?: string;
  n?: string;
  p?: string;
  d?: "tăng" | "giảm";
}

class MarketStore {
  quotes: Record<string, Quote> = {};
  private version = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  onEvent: ((e: MarketEvent) => void) | null = null;
  lastGlobalUpdate = Date.now();

  constructor() {
    const now = Date.now();
    for (const a of ASSETS) {
      const stable = a.sym === "USDT" || a.sym === "USDC";
      const ch = stable ? 0.01 : rand(-6, 8);
      const p = Math.max(a.base * 0.2, a.base * (1 + rand(-0.06, 0.06)));
      this.quotes[a.id] = { p, prev: p, ch, due: now + rand(20000, 300000) };
    }
  }

  ensureStarted() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 5000);
    this.tick();
  }

  private tick() {
    const now = Date.now();
    let changed = false;
    for (const a of ASSETS) {
      const q = this.quotes[a.id];
      if (now < q.due) continue;
      const stable = a.sym === "USDT" || a.sym === "USDC";
      const drift = stable ? rand(-0.0004, 0.0004) : rand(-0.035, 0.038);
      const p = Math.max(a.base * 0.05, q.p * (1 + drift));
      q.prev = q.p;
      q.p = p;
      q.ch = Math.max(-30, Math.min(30, q.ch + drift * 100 * 0.6));
      q.due = now + rand(60000, 300000); // 1–5 phút
      changed = true;

      if (!stable && Math.random() < 0.16 && this.onEvent) {
        const r = Math.random();
        const pStr = Math.abs(drift * 100).toFixed(1);
        if (a.type === "stock" && a.cur === "VND" && r < 0.3) {
          this.onEvent({ id: "vni", p: (rand(0.4, 2.8)).toFixed(1), d: drift >= 0 ? "tăng" : "giảm" });
        } else if (r < 0.3) {
          this.onEvent({ id: "whale", sym: a.sym, n: (rand(0.4, 12)).toFixed(1) });
        } else if (r < 0.55) {
          this.onEvent({ id: "pump", sym: a.sym, p: pStr });
        } else if (r < 0.8) {
          this.onEvent({ id: "dump", sym: a.sym, p: pStr });
        } else {
          this.onEvent({ id: "fed" });
        }
      }
    }
    if (changed) {
      this.lastGlobalUpdate = now;
      this.version++;
      this.listeners.forEach((l) => l());
    }
  }

  nextDue(): number {
    let m = Infinity;
    for (const a of ASSETS) m = Math.min(m, this.quotes[a.id].due);
    return Math.max(0, Math.round((m - Date.now()) / 1000));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
}

export const market = new MarketStore();

export function useMarket(): number {
  market.ensureStarted();
  return useSyncExternalStore(market.subscribe, market.getVersion, market.getVersion);
}
