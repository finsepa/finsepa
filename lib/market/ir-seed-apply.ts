import "server-only";

import { applyIrSeedGoogleAlphabetDocumentUrls } from "@/lib/market/ir-seed-apply-google-alphabet";
import { applyIrSeedGenericQ4DocumentUrls } from "@/lib/market/ir-seed-apply-generic-q4";
import { applyIrSeedAmazonDocumentUrls } from "@/lib/market/ir-seed-apply-amazon";
import { applyIrSeedAppleDocumentUrls } from "@/lib/market/ir-seed-apply-apple";
import { applyIrSeedMetaDocumentUrls } from "@/lib/market/ir-seed-apply-meta";
import { applyIrSeedMicrosoftDocumentUrls } from "@/lib/market/ir-seed-apply-microsoft";
import { applyIrSeedNvidiaPresentationUrls } from "@/lib/market/ir-seed-apply-nvidia-q4";
import { applyIrSeedTsmcDocumentUrls } from "@/lib/market/ir-seed-apply-tsmc";
import { applyIrSeedVisaDocumentUrls } from "@/lib/market/ir-seed-apply-visa";
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
  if (t === "META") return applyIrSeedMetaDocumentUrls(rows, hub);
  if (t === "TSM") return applyIrSeedTsmcDocumentUrls(rows, hub);
  if (t === "V") return applyIrSeedVisaDocumentUrls(rows, hub);
  // Generic best-effort for Q4 Inc. investor sites across the screener universe.
  return applyIrSeedGenericQ4DocumentUrls(t, rows, hub);
}
