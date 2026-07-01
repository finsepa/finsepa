import "server-only";

import { applyKnownCdnSlideDeckUrls } from "@/lib/market/ir-seed-apply-known-cdn";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/** @deprecated Prefer unified `applyKnownCdnSlideDeckUrls` via `applyIrSeedDocumentUrls`. */
export async function applyIrSeedMicrosoftDocumentUrls(
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  return applyKnownCdnSlideDeckUrls("MSFT", rows, hub);
}
