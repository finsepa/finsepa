/**
 * Force-refresh crypto_derived only (bypasses frozen cron skip).
 * ~2–5 min for ~60 symbols (EOD + mcap).
 *
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/refresh-crypto-derived.mjs
 */
import { getScreenerUsMarketCacheEpoch } from "../lib/screener/screener-us-market-cache.ts";
import { buildMarketSnapshotCryptoDerivedForIngest } from "../lib/market/simple-market-layer.ts";
import { MARKET_SNAPSHOT_KEY } from "../lib/market/market-snapshot-keys.ts";
import {
  marketSnapshotSlowSegment,
  upsertMarketSnapshot,
} from "../lib/market/market-snapshot-store.ts";
import { resolveCryptoMarketCapUsd } from "../lib/market/crypto-mcap-fallback.ts";

const now = new Date();
const epoch = getScreenerUsMarketCacheEpoch(now);
const slowSeg = marketSnapshotSlowSegment(epoch);

console.log("start", now.toISOString(), "mode", epoch.mode, "slowSeg", slowSeg);

const derived = await buildMarketSnapshotCryptoDerivedForIngest();

// Ensure junk provider caps never land in the hub (HYPE etc.).
for (const [sym, row] of Object.entries(derived)) {
  if (!row) continue;
  row.marketCapUsd = resolveCryptoMarketCapUsd(sym, row.marketCapUsd);
}

const res = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoDerived, slowSeg, derived);

const top = Object.entries(derived)
  .map(([s, r]) => ({ s, mc: r?.marketCapUsd ?? -1 }))
  .filter((x) => x.mc > 0)
  .sort((a, b) => b.mc - a.mc)
  .slice(0, 12)
  .map((x, i) => `${i + 1}.${x.s}:${(x.mc / 1e9).toFixed(1)}B`);

console.log(
  JSON.stringify(
    {
      result: res,
      count: Object.keys(derived).length,
      sample: {
        USDT: derived.USDT?.marketCapUsd ?? null,
        USDC: derived.USDC?.marketCapUsd ?? null,
        HYPE: derived.HYPE?.marketCapUsd ?? null,
      },
      top12: top,
    },
    null,
    2,
  ),
);
console.log("done", new Date().toISOString());
