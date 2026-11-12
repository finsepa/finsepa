import "server-only";

import { loadCryptoLive1DMinuteChartPoints } from "@/lib/market/crypto-1d-live-minute-chart";
import {
  SESSION_INTRADAY_CHART_BAR_GAP_SEC,
  minGapDownsampleChartPoints,
} from "@/lib/market/stock-chart-data";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

const FIVE_DAYS_SEC = 5 * 86400;

/**
 * EODHD `.CC` intraday history only reaches the last completed UTC day, so a 5D chart stops at
 * midnight. Append the live 24h minute series past that point and keep a rolling 5×24h window.
 */
export async function appendCrypto5DLiveTail(
  symbol: string,
  points: StockChartPoint[],
): Promise<StockChartPoint[]> {
  const lastHistorical = points.at(-1)?.time;
  if (lastHistorical == null) return points;
  const live = await loadCryptoLive1DMinuteChartPoints(symbol).catch(() => [] as StockChartPoint[]);
  const tail = minGapDownsampleChartPoints(
    live.filter((p) => p.time > lastHistorical),
    SESSION_INTRADAY_CHART_BAR_GAP_SEC,
  );
  if (!tail.length) return points;
  const merged = [...points, ...tail];
  const end = merged[merged.length - 1]!.time;
  return merged.filter((p) => p.time >= end - FIVE_DAYS_SEC);
}
