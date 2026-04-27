import "server-only";

import { applyIrSeedGoogleAlphabetDocumentUrls } from "@/lib/market/ir-seed-apply-google-alphabet";
import { applyIrSeedAmazonDocumentUrls } from "@/lib/market/ir-seed-apply-amazon";
import { applyIrSeedAppleDocumentUrls } from "@/lib/market/ir-seed-apply-apple";
import { applyIrSeedMicrosoftDocumentUrls } from "@/lib/market/ir-seed-apply-microsoft";
import { applyIrSeedNvidiaPresentationUrls } from "@/lib/market/ir-seed-apply-nvidia-q4";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/** IR seed resolution after SEC enrichment, before curated overrides. */
export async function applyIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const t = listingTicker.trim().toUpperCase();
  if (t === "NVDA") return applyIrSeedNvidiaPresentationUrls(rows);
  if (t === "GOOGL" || t === "GOOG") return applyIrSeedGoogleAlphabetDocumentUrls(rows, hub);
  if (t === "AAPL") return applyIrSeedAppleDocumentUrls(rows, hub);
  if (t === "MSFT") return applyIrSeedMicrosoftDocumentUrls(rows, hub);
  if (t === "AMZN") return applyIrSeedAmazonDocumentUrls(rows, hub);
  return rows;
}
