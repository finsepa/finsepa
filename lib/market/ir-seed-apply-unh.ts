import "server-only";

import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/**
 * UNH: no public quarterly slide decks on IR (releases, remarks, 10-Q/K only).
 * Dedicated seed skips generic Q4 / SEC HTML fallbacks for Slides.
 */
export async function applyIrSeedUnhDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  return rows;
}
