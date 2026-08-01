import "server-only";

import type {
  SimpleCryptoDerived,
  SimpleIndicesDerived,
  SimpleMarketData,
  SimpleScreenerDerived,
} from "@/lib/market/simple-market-layer";
import {
  buildMarketSnapshotCryptoDerivedForIngest,
  buildMarketSnapshotCryptoPage2ForIngest,
  buildMarketSnapshotCryptoTabForIngest,
  buildMarketSnapshotIndicesDerivedForIngest,
  buildMarketSnapshotIndicesTabForIngest,
  buildMarketSnapshotScreenerDerivedForIngest,
  buildMarketSnapshotStocksAllPagesForIngest,
} from "@/lib/market/simple-market-layer";
import { buildMarketSnapshotCurrenciesTabForIngest } from "@/lib/screener/screener-currencies-rows";
import type { CurrencyTableRow } from "@/lib/screener/screener-currencies-universe";

export type MarketSnapshotIngestPayloads = {
  stocksAllPages: SimpleMarketData;
  screenerDerived: SimpleScreenerDerived;
  cryptoTab: SimpleMarketData;
  cryptoPage2: SimpleMarketData;
  cryptoDerived: SimpleCryptoDerived;
  indicesTab: SimpleMarketData;
  indicesDerived: SimpleIndicesDerived;
  currenciesTab: CurrencyTableRow[];
};

export type MarketSnapshotHotIngestPayloads = Pick<
  MarketSnapshotIngestPayloads,
  "stocksAllPages" | "cryptoTab" | "cryptoPage2" | "indicesTab"
>;

export type MarketSnapshotSlowIngestPayloads = Pick<
  MarketSnapshotIngestPayloads,
  "screenerDerived" | "cryptoDerived" | "indicesDerived" | "currenciesTab"
>;

/** Hot quotes/tabs — cron only; never reads Supabase. */
export async function buildMarketSnapshotHotPayloadsForIngest(): Promise<MarketSnapshotHotIngestPayloads> {
  const [stocksAllPages, cryptoTab, cryptoPage2, indicesTab] = await Promise.all([
    buildMarketSnapshotStocksAllPagesForIngest(),
    buildMarketSnapshotCryptoTabForIngest(),
    buildMarketSnapshotCryptoPage2ForIngest(),
    buildMarketSnapshotIndicesTabForIngest(),
  ]);
  return { stocksAllPages, cryptoTab, cryptoPage2, indicesTab };
}

/** EOD-derived blobs — cron only; never reads Supabase. */
export async function buildMarketSnapshotSlowPayloadsForIngest(): Promise<MarketSnapshotSlowIngestPayloads> {
  const [screenerDerived, cryptoDerived, indicesDerived, currenciesTab] = await Promise.all([
    buildMarketSnapshotScreenerDerivedForIngest(),
    buildMarketSnapshotCryptoDerivedForIngest(),
    buildMarketSnapshotIndicesDerivedForIngest(),
    buildMarketSnapshotCurrenciesTabForIngest(),
  ]);
  return { screenerDerived, cryptoDerived, indicesDerived, currenciesTab };
}

/** Loads all snapshot blobs from EODHD (cron only — never reads Supabase). */
export async function buildMarketSnapshotPayloadsForIngest(): Promise<MarketSnapshotIngestPayloads> {
  const [hot, slow] = await Promise.all([
    buildMarketSnapshotHotPayloadsForIngest(),
    buildMarketSnapshotSlowPayloadsForIngest(),
  ]);
  return { ...hot, ...slow };
}
