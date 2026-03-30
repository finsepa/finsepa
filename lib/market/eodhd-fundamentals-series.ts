import "server-only";

export type { ChartingSeriesPoint, FundamentalsSeriesMode, IncomeStatementPoint } from "@/lib/market/charting-series-types";

import { fetchChartingSeries } from "@/lib/market/eodhd-charting-series";
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";

/**
 * @deprecated Prefer `fetchChartingSeries` for full charting data.
 * Returns merged charting points (same as charting API).
 */
export async function fetchIncomeStatementSeries(
  ticker: string,
  mode: FundamentalsSeriesMode,
): Promise<ChartingSeriesPoint[] | null> {
  const bundle = await fetchChartingSeries(ticker, mode);
  return bundle?.points ?? null;
}
