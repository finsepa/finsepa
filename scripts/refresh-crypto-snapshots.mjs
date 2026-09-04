/**
 * Force-refresh crypto_tab / crypto_page2 / crypto_derived (bypasses frozen cron skip).
 * Usage: node --env-file=.env.local --import tsx scripts/refresh-crypto-snapshots.mjs
 */
import { getScreenerUsMarketCacheEpoch } from "../lib/screener/screener-us-market-cache.ts";
import {
  buildMarketSnapshotCryptoDerivedForIngest,
  buildMarketSnapshotCryptoPage2ForIngest,
  buildMarketSnapshotCryptoTabForIngest,
} from "../lib/market/simple-market-layer.ts";
import { MARKET_SNAPSHOT_KEY } from "../lib/market/market-snapshot-keys.ts";
import {
  marketSnapshotHotSegment,
  marketSnapshotSlowSegment,
  upsertMarketSnapshot,
} from "../lib/market/market-snapshot-store.ts";

const now = new Date();
const epoch = getScreenerUsMarketCacheEpoch(now);
const hotSeg = marketSnapshotHotSegment(epoch);
const slowSeg = marketSnapshotSlowSegment(epoch);

console.log("mode", epoch.mode, "hotSeg", hotSeg, "slowSeg", slowSeg);

const [tab, page2, derived] = await Promise.all([
  buildMarketSnapshotCryptoTabForIngest(),
  buildMarketSnapshotCryptoPage2ForIngest(),
  buildMarketSnapshotCryptoDerivedForIngest(),
]);

const results = {};
results.crypto_tab = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoTab, hotSeg, tab);
results.crypto_page2 = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoPage2, hotSeg, page2);
results.crypto_derived = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoDerived, slowSeg, derived);

const usdt = derived.USDT?.marketCapUsd ?? null;
const usdc = derived.USDC?.marketCapUsd ?? null;
const hype = derived.HYPE?.marketCapUsd ?? null;
console.log(
  JSON.stringify(
    {
      results,
      sampleMcaps: { USDT: usdt, USDC: usdc, HYPE: hype },
      tabUsdtPrice: tab.crypto?.USDT?.price ?? null,
      tabHypePrice: tab.crypto?.HYPE?.price ?? null,
    },
    null,
    2,
  ),
);
