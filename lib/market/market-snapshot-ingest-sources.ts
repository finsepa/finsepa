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

export type MarketSnapshotIngestPayloads = {
  stocksAllPages: SimpleMarketData;
  screenerDerived: SimpleScreenerDerived;
  cryptoTab: SimpleMarketData;
  cryptoPage2: SimpleMarketData;
  cryptoDerived: SimpleCryptoDerived;
  indicesTab: SimpleMarketData;
  indicesDerived: SimpleIndicesDerived;
};

/** Loads all snapshot blobs from EODHD (cron only — never reads Supabase). */
export async function buildMarketSnapshotPayloadsForIngest(): Promise<MarketSnapshotIngestPayloads> {
  const [
    stocksAllPages,
    screenerDerived,
    cryptoTab,
    cryptoPage2,
    cryptoDerived,
    indicesTab,
    indicesDerived,
  ] = await Promise.all([
    buildMarketSnapshotStocksAllPagesForIngest(),
    buildMarketSnapshotScreenerDerivedForIngest(),
    buildMarketSnapshotCryptoTabForIngest(),
    buildMarketSnapshotCryptoPage2ForIngest(),
    buildMarketSnapshotCryptoDerivedForIngest(),
    buildMarketSnapshotIndicesTabForIngest(),
    buildMarketSnapshotIndicesDerivedForIngest(),
  ]);

  return {
    stocksAllPages,
    screenerDerived,
    cryptoTab,
    cryptoPage2,
    cryptoDerived,
    indicesTab,
    indicesDerived,
  };
}
