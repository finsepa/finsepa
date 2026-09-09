import "server-only";

import { applyKnownCdnSlideDeckUrls } from "@/lib/market/ir-seed-apply-known-cdn";
import { applyIrSeedGoogleAlphabetDocumentUrls } from "@/lib/market/ir-seed-apply-google-alphabet";
import { applyIrSeedGenericQ4DocumentUrls } from "@/lib/market/ir-seed-apply-generic-q4";
import { applyIrSeedAbbvDocumentUrls } from "@/lib/market/ir-seed-apply-abbv";
import { applyIrSeedAmazonDocumentUrls } from "@/lib/market/ir-seed-apply-amazon";
import { applyIrSeedAppleDocumentUrls } from "@/lib/market/ir-seed-apply-apple";
import { applyIrSeedAsmlDocumentUrls } from "@/lib/market/ir-seed-apply-asml";
import { applyIrSeedAvgoDocumentUrls } from "@/lib/market/ir-seed-apply-avgo";
import { applyIrSeedCscoDocumentUrls } from "@/lib/market/ir-seed-apply-csco";
import { applyIrSeedBacDocumentUrls } from "@/lib/market/ir-seed-apply-bac";
import { applyIrSeedJnjDocumentUrls } from "@/lib/market/ir-seed-apply-jnj";
import { applyIrSeedJpmDocumentUrls } from "@/lib/market/ir-seed-apply-jpm";
import { applyIrSeedLillyDocumentUrls } from "@/lib/market/ir-seed-apply-lilly";
import { applyIrSeedMaDocumentUrls } from "@/lib/market/ir-seed-apply-ma";
import { applyIrSeedMetaDocumentUrls } from "@/lib/market/ir-seed-apply-meta";
import { applyIrSeedMuDocumentUrls } from "@/lib/market/ir-seed-apply-mu";
import { applyIrSeedNikeDocumentUrls } from "@/lib/market/ir-seed-apply-nike";
import { applyIrSeedNvidiaPresentationUrls } from "@/lib/market/ir-seed-apply-nvidia-q4";
import { applyIrSeedOrclDocumentUrls } from "@/lib/market/ir-seed-apply-orcl";
import { applyIrSeedPgDocumentUrls } from "@/lib/market/ir-seed-apply-pg";
import { applyIrSeedTcehyDocumentUrls } from "@/lib/market/ir-seed-apply-tcehy";
import { applyIrSeedTeslaDocumentUrls } from "@/lib/market/ir-seed-apply-tesla";
import { applyIrSeedTsmcDocumentUrls } from "@/lib/market/ir-seed-apply-tsmc";
import { applyIrSeedFerrariPresentationUrls } from "@/lib/market/ir-seed-apply-ferrari";
import { applyGcsWebPresentationUrls } from "@/lib/market/ir-seed-apply-gcs-presentations";
import { applyIrSeedVisaDocumentUrls } from "@/lib/market/ir-seed-apply-visa";
import { applyIrSeedWalmartDocumentUrls } from "@/lib/market/ir-seed-apply-walmart";
import { applyIrSeedXomDocumentUrls } from "@/lib/market/ir-seed-apply-xom";
import { applyIrSeedAmatDocumentUrls } from "@/lib/market/ir-seed-apply-amat";
import { applyIrSeedMerckDocumentUrls } from "@/lib/market/ir-seed-apply-merck";
import { applyIrSeedCostDocumentUrls } from "@/lib/market/ir-seed-apply-cost";
import { applyIrSeedKoDocumentUrls } from "@/lib/market/ir-seed-apply-ko";
import { applyIrSeedCatDocumentUrls } from "@/lib/market/ir-seed-apply-cat";
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
  "MU",
  "TSM",
  "V",
  "RACE",
  "PG",
  "WMT",
  "LLY",
  "TSLA",
  "JNJ",
  "AVGO",
  "ASML",
  "ORCL",
  "XOM",
  "BAC",
  "MA",
  "JPM",
  "TCEHY",
  "ABBV",
  "CSCO",
  "AMAT",
  "MRK",
  "COST",
  "KO",
  "CAT",
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
  if (t === "PG") return applyIrSeedPgDocumentUrls(rows);
  if (t === "NVDA") return applyIrSeedNvidiaPresentationUrls(rows);
  if (t === "GOOGL" || t === "GOOG") return applyIrSeedGoogleAlphabetDocumentUrls(rows, hub);
  if (t === "AAPL") return applyIrSeedAppleDocumentUrls(rows, hub);
  if (t === "AMZN") return applyIrSeedAmazonDocumentUrls(rows, hub);
  if (t === "MU") return applyIrSeedMuDocumentUrls(rows, hub);
  if (t === "META") return applyIrSeedMetaDocumentUrls(rows, hub);
  if (t === "TSM") return applyIrSeedTsmcDocumentUrls(rows, hub);
  if (t === "V") return applyIrSeedVisaDocumentUrls(rows, hub);
  if (t === "WMT") return applyIrSeedWalmartDocumentUrls(rows, hub);
  if (t === "LLY") return applyIrSeedLillyDocumentUrls(rows, hub);
  if (t === "TSLA") return applyIrSeedTeslaDocumentUrls(rows);
  if (t === "JNJ") return applyIrSeedJnjDocumentUrls(rows);
  if (t === "AVGO") return applyIrSeedAvgoDocumentUrls(rows, hub);
  if (t === "ASML") return applyIrSeedAsmlDocumentUrls(rows, hub);
  if (t === "ORCL") return applyIrSeedOrclDocumentUrls(rows);
  if (t === "XOM") return applyIrSeedXomDocumentUrls(rows, hub);
  if (t === "BAC") return applyIrSeedBacDocumentUrls(rows, hub);
  if (t === "MA") return applyIrSeedMaDocumentUrls(rows);
  if (t === "JPM") return applyIrSeedJpmDocumentUrls(rows, hub);
  if (t === "TCEHY") return applyIrSeedTcehyDocumentUrls(rows, hub);
  if (t === "ABBV") return applyIrSeedAbbvDocumentUrls(rows, hub);
  if (t === "CSCO") return applyIrSeedCscoDocumentUrls(rows, hub);
  if (t === "AMAT") return applyIrSeedAmatDocumentUrls(rows, hub);
  if (t === "MRK") return applyIrSeedMerckDocumentUrls(rows, hub);
  if (t === "COST") return applyIrSeedCostDocumentUrls(rows, hub);
  if (t === "KO") return applyIrSeedKoDocumentUrls(rows, hub);
  if (t === "CAT") return applyIrSeedCatDocumentUrls(rows, hub);
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

/** IR seed resolution after SEC enrichment; curated QA overrides run after this in the tab payload. */
export async function applyIrSeedDocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: {
    preview?: boolean;
    fyEndMonthDay?: string | null;
    /** Vault / cron backfill only — user tab traffic should not run the generic HEAD grid. */
    allowGenericQ4?: boolean;
  },
): Promise<StockEarningsHistoryRow[]> {
  const t = listingTicker.trim().toUpperCase();
  const dedicated = await applyDedicatedIrSeedDocumentUrls(t, rows, hub, options);
  const allowGeneric = options?.allowGenericQ4 !== false;
  const seeded =
    dedicated ??
    (allowGeneric
      ? await applyIrSeedGenericQ4DocumentUrls(t, rows, hub, {
          preview: options?.preview,
          fyEndMonthDay: options?.fyEndMonthDay,
        })
      : rows);
  return applyUniversalIrSeedLayers(t, seeded, hub, options);
}
