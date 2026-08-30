const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function fmt(n: number): string {
  return nf.format(Math.round(n));
}

/** 1_250_000_000 -> "1,3 tỷ ₫" ; 350_000_000 -> "350 tr ₫" */
export function compactVND(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${nf1.format(v / 1e9)} tỷ ₫`;
  if (abs >= 1e6) return `${nf1.format(v / 1e6)} tr ₫`;
  if (abs >= 1e3) return `${nf1.format(v / 1e3)}k ₫`;
  return `${nf.format(v)} ₫`;
}

const nf2 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** số nhỏ (BTC, ETH…) giữ 2 số thập phân; số lớn format nguyên */
export function fmtSmart(v: number): string {
  return Math.abs(v) < 10 ? nf2.format(v) : nf.format(v);
}

export function compactNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${nf1.format(v / 1e9)}B`;
  if (abs >= 1e6) return `${nf1.format(v / 1e6)}M`;
  if (abs >= 1e3) return `${nf1.format(v / 1e3)}k`;
  return nf.format(v);
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

export function pct(cur: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((cur / target) * 100));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
