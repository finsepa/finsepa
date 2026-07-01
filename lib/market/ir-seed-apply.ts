import "server-only";

import { applyKnownCdnSlideDeckUrls } from "@/lib/market/ir-seed-apply-known-cdn";
import { applyIrSeedGoogleAlphabetDocumentUrls } from "@/lib/market/ir-seed-apply-google-alphabet";
import { applyIrSeedGenericQ4DocumentUrls } from "@/lib/market/ir-seed-apply-generic-q4";
import { applyIrSeedAmazonDocumentUrls } from "@/lib/market/ir-seed-apply-amazon";
import { applyIrSeedAppleDocumentUrls } from "@/lib/market/ir-seed-apply-apple";
import { applyIrSeedMetaDocumentUrls } from "@/lib/market/ir-seed-apply-meta";
import { applyIrSeedNikeDocumentUrls } from "@/lib/market/ir-seed-apply-nike";
import { applyIrSeedNvidiaPresentationUrls } from "@/lib/market/ir-seed-apply-nvidia-q4";
import { applyIrSeedTsmcDocumentUrls } from "@/lib/market/ir-seed-apply-tsmc";
import { applyIrSeedFerrariPresentationUrls } from "@/lib/market/ir-seed-apply-ferrari";
import { applyGcsWebPresentationUrls } from "@/lib/market/ir-seed-apply-gcs-presentations";
import { applyIrSeedVisaDocumentUrls } from "@/lib/market/ir-seed-apply-visa";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/** Tickers with bespoke IR seed modules (run before universal layers). */
const DEDICATED_IR_SEED_TICKERS = new Set([
  "NKE",
  "NVDA",
  "GOOGL",
  "GOOG",
  "AAPL",
  "AMZN",
  "META",
  "TSM",
  "V",
  "RACE",
]);

export function earningsIrSeedResolutionSource(
  listingTicker: string,
): "ir_seed" | "generic_q4" {
  const t = listingTicker.trim().toUpperCase();
  return DEDICATED_IR_SEED_TICKERS.has(t) ? "ir_seed" : "generic_q4";
}

async function applyDedicatedIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[] | null> {
  const t = listingTicker.trim().toUpperCase();
  if (t === "NKE") return applyIrSeedNikeDocumentUrls(rows);
  if (t === "NVDA") return applyIrSeedNvidiaPresentationUrls(rows);
  if (t === "GOOGL" || t === "GOOG") return applyIrSeedGoogleAlphabetDocumentUrls(rows, hub);
  if (t === "AAPL") return applyIrSeedAppleDocumentUrls(rows, hub);
  if (t === "AMZN") return applyIrSeedAmazonDocumentUrls(rows, hub);
  if (t === "META") return applyIrSeedMetaDocumentUrls(rows, hub);
  if (t === "TSM") return applyIrSeedTsmcDocumentUrls(rows, hub);
  if (t === "V") return applyIrSeedVisaDocumentUrls(rows, hub);
  if (t === "RACE") {
    return applyIrSeedFerrariPresentationUrls(rows, {
      preview: options?.preview,
      fyEndMonthDay: options?.fyEndMonthDay,
    });
  }
  return null;
}

async function applyUniversalIrSeedLayers(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const withKnownCdn = await applyKnownCdnSlideDeckUrls(listingTicker, rows, hub, options);
  return applyGcsWebPresentationUrls(listingTicker, withKnownCdn, hub, options);
}

/** IR seed resolution after SEC enrichment, before curated overrides. */
export async function applyIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const t = listingTicker.trim().toUpperCase();
  const dedicated = await applyDedicatedIrSeedDocumentUrls(t, rows, hub, options);
  const seeded =
    dedicated ??
    (await applyIrSeedGenericQ4DocumentUrls(t, rows, hub, {
      preview: options?.preview,
      fyEndMonthDay: options?.fyEndMonthDay,
    }));
  return applyUniversalIrSeedLayers(t, seeded, hub, options);
}
