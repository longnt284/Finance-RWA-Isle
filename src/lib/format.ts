export type Currency = "VND" | "USD";

/** Live binding updated by the market service; starts from a conservative reference rate. */
export let USD_RATE = 25400; // ₫ per $

export function setUsdRate(rate: number): void {
  if (Number.isFinite(rate) && rate > 10000 && rate < 50000) USD_RATE = rate;
}

const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const nfUsd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const nfUsd0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmt(v: number): string {
  return nf.format(v);
}

/** số nhỏ (BTC, ETH…) giữ 2 số thập phân; số lớn format nguyên */
export function fmtSmart(v: number): string {
  return Math.abs(v) < 10 ? nf2.format(v) : nf.format(v);
}

export function compactVND(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${nf2.format(abs / 1e9)} tỷ ₫`;
  if (abs >= 1e6) return `${sign}${nf2.format(abs / 1e6)} tr ₫`;
  if (abs >= 1e3) return `${sign}${nf2.format(abs / 1e3)}k ₫`;
  return `${sign}${nf.format(abs)} ₫`;
}

export function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs < 1) return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(v)}`;
  return `${sign}$${abs >= 1000 ? nfUsd0.format(abs) : nfUsd.format(abs)}`;
}

export function compactUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${nf2.format(abs / 1e12)}T`;
  if (abs >= 1e9) return `${sign}$${nf2.format(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${nf2.format(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${nf2.format(abs / 1e3)}K`;
  return `${sign}$${nf2.format(abs)}`;
}

/** chuyển giữa hai đơn vị hiển thị; amount luôn lưu gốc VND */
export function convert(amountVnd: number, to: Currency): number {
  return to === "USD" ? amountVnd / USD_RATE : amountVnd;
}

export function fmtMoney(amountVnd: number, cur: Currency): string {
  return cur === "USD" ? compactUsd(amountVnd / USD_RATE) : compactVND(amountVnd);
}

/** format giá của một tài sản theo đơn vị gốc của nó, hiển thị theo đơn vị người dùng chọn */
export function fmtPrice(price: number, assetCur: "USD" | "VND", display: Currency): string {
  const inUsd = assetCur === "USD" ? price : price / USD_RATE;
  const target = display === "USD" ? inUsd : inUsd * USD_RATE;
  if (display === "USD") {
    if (target >= 1000) return `$${nfUsd0.format(target)}`;
    if (target >= 1) return `$${nfUsd.format(target)}`;
    return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(target)}`;
  }
  if (target < 1000) return `${nf2.format(target)} ₫`;
  return compactVND(target);
}

export function pct(a: number, b: number): number {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}g`;
  return `${Math.floor(h / 24)}ng`;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
