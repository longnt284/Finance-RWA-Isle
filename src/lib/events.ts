/* ------------------------------------------------------------------ */
/*  Sự kiện thị trường                                                 */
/*                                                                     */
/*  Thành tựu "Săn cá voi" đếm `state.events`, nhưng trước đây không    */
/*  chỗ nào gọi `logEvent` nên bộ đếm đứng yên ở 0 và thành tựu không   */
/*  bao giờ đạt được. Mô-đun này quan sát watchlist và ghi nhận khi một */
/*  mã biến động mạnh trong 24 giờ.                                    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { ASSET_BY_ID, market, useMarket } from "./market";
import { dayKey } from "./format";

/** Ngưỡng biến động 24h đủ lớn để coi là một sự kiện đáng ghi. */
const CRYPTO_THRESHOLD = 7;
const STOCK_THRESHOLD = 4;
/** Mỗi mã chỉ ghi một sự kiện mỗi ngày, và tối đa vài dòng mỗi phiên. */
const MAX_EVENTS_PER_SESSION = 6;

export interface MarketEvent {
  /** khoá i18n: `log.evUp` hoặc `log.evDown` */
  k: string;
  p: Record<string, string | number>;
}

/**
 * Gọi `onEvent` khi một mã trong `watchlist` vừa vượt ngưỡng biến động.
 * Chỉ ghi mã có giá thật (`status` khác `reference`) — giá tham chiếu offline
 * không đổi nên không bao giờ là "sự kiện".
 */
export function useMarketEvents(
  watchlist: readonly string[],
  onEvent: (event: MarketEvent) => void
): void {
  const version = useMarket(watchlist);
  const seen = useRef(new Set<string>());
  const fired = useRef(0);

  useEffect(() => {
    if (fired.current >= MAX_EVENTS_PER_SESSION) return;
    const today = dayKey(Date.now());
    for (const id of watchlist) {
      const asset = ASSET_BY_ID.get(id);
      const quote = market.quotes[id];
      if (!asset || !quote) continue;
      /* Giá tham chiếu là mỏ neo tĩnh, không phải tin tức thị trường. */
      if (quote.status === "reference" || !quote.updatedAt) continue;

      const threshold = asset.type === "crypto" ? CRYPTO_THRESHOLD : STOCK_THRESHOLD;
      if (!Number.isFinite(quote.ch) || Math.abs(quote.ch) < threshold) continue;

      const stamp = `${today}:${id}:${quote.ch >= 0 ? "up" : "down"}`;
      if (seen.current.has(stamp)) continue;
      seen.current.add(stamp);

      onEvent({
        k: quote.ch >= 0 ? "log.evUp" : "log.evDown",
        p: { s: asset.sym, c: Math.abs(quote.ch).toFixed(1) },
      });
      if (++fired.current >= MAX_EVENTS_PER_SESSION) return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, watchlist]);
}
