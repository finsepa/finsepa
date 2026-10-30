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

const HOT_PAYLOAD_BUILDERS: {
  [K in keyof MarketSnapshotHotIngestPayloads]: () => Promise<MarketSnapshotHotIngestPayloads[K]>;
} = {
  stocksAllPages: buildMarketSnapshotStocksAllPagesForIngest,
  cryptoTab: buildMarketSnapshotCryptoTabForIngest,
  cryptoPage2: buildMarketSnapshotCryptoPage2ForIngest,
  indicesTab: buildMarketSnapshotIndicesTabForIngest,
};

/** Hot quotes/tabs — cron only; never reads Supabase. Builds only `names` (each one is billed). */
export async function buildMarketSnapshotHotPayloadsForIngest<K extends keyof MarketSnapshotHotIngestPayloads>(
  names: readonly K[],
): Promise<Pick<MarketSnapshotHotIngestPayloads, K>> {
  const built = await Promise.all(names.map(async (name) => [name, await HOT_PAYLOAD_BUILDERS[name]()] as const));
  return Object.fromEntries(built) as Pick<MarketSnapshotHotIngestPayloads, K>;
}

/** Crypto screener hot hubs only (US-frozen off-hours refresh). */
export async function buildMarketSnapshotCryptoHotPayloadsForIngest(): Promise<
  Pick<MarketSnapshotHotIngestPayloads, "cryptoTab" | "cryptoPage2">
> {
  const [cryptoTab, cryptoPage2] = await Promise.all([
    buildMarketSnapshotCryptoTabForIngest(),
    buildMarketSnapshotCryptoPage2ForIngest(),
  ]);
  return { cryptoTab, cryptoPage2 };
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
    buildMarketSnapshotHotPayloadsForIngest(["stocksAllPages", "cryptoTab", "cryptoPage2", "indicesTab"]),
    buildMarketSnapshotSlowPayloadsForIngest(),
  ]);
  return { ...hot, ...slow };
}
