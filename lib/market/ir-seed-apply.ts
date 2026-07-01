import "server-only";

import { applyIrSeedGoogleAlphabetDocumentUrls } from "@/lib/market/ir-seed-apply-google-alphabet";
import { applyIrSeedGenericQ4DocumentUrls } from "@/lib/market/ir-seed-apply-generic-q4";
import { applyIrSeedAmazonDocumentUrls } from "@/lib/market/ir-seed-apply-amazon";
import { applyIrSeedAppleDocumentUrls } from "@/lib/market/ir-seed-apply-apple";
import { applyIrSeedMetaDocumentUrls } from "@/lib/market/ir-seed-apply-meta";
import { applyIrSeedMicrosoftDocumentUrls } from "@/lib/market/ir-seed-apply-microsoft";
import { applyIrSeedNikeDocumentUrls } from "@/lib/market/ir-seed-apply-nike";
import { applyIrSeedNvidiaPresentationUrls } from "@/lib/market/ir-seed-apply-nvidia-q4";
import { applyIrSeedTsmcDocumentUrls } from "@/lib/market/ir-seed-apply-tsmc";
import { applyIrSeedVisaDocumentUrls } from "@/lib/market/ir-seed-apply-visa";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const DEDICATED_IR_SEED_TICKERS = new Set([
  "NKE",
  "NVDA",
  "GOOGL",
  "GOOG",
  "AAPL",
  "MSFT",
  "AMZN",
  "META",
  "TSM",
  "V",
]);

export function earningsIrSeedResolutionSource(
  listingTicker: string,
): "ir_seed" | "generic_q4" {
  const t = listingTicker.trim().toUpperCase();
  return DEDICATED_IR_SEED_TICKERS.has(t) ? "ir_seed" : "generic_q4";
}

/** IR seed resolution after SEC enrichment, before curated overrides. */
export async function applyIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const t = listingTicker.trim().toUpperCase();
  if (t === "NKE") return applyIrSeedNikeDocumentUrls(rows);
  if (t === "NVDA") return applyIrSeedNvidiaPresentationUrls(rows);
  if (t === "GOOGL" || t === "GOOG") return applyIrSeedGoogleAlphabetDocumentUrls(rows, hub);
  if (t === "AAPL") return applyIrSeedAppleDocumentUrls(rows, hub);
  if (t === "MSFT") return applyIrSeedMicrosoftDocumentUrls(rows, hub);
  if (t === "AMZN") return applyIrSeedAmazonDocumentUrls(rows, hub);
  if (t === "META") return applyIrSeedMetaDocumentUrls(rows, hub);
  if (t === "TSM") return applyIrSeedTsmcDocumentUrls(rows, hub);
  if (t === "V") return applyIrSeedVisaDocumentUrls(rows, hub);
  return applyIrSeedGenericQ4DocumentUrls(t, rows, hub, {
    preview: options?.preview,
    fyEndMonthDay: options?.fyEndMonthDay,
  });
}
