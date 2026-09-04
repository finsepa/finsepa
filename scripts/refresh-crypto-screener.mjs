/**
 * Force-rebuild crypto screener hubs: `crypto_tab` + `crypto_page2` + `crypto_derived`.
 * Bypasses frozen US-equity cron skip. ~2–8 min for ~100 symbols.
 *
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/refresh-crypto-screener.mjs
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
import { resolveCryptoMarketCapUsd } from "../lib/market/crypto-mcap-fallback.ts";

const now = new Date();
const epoch = getScreenerUsMarketCacheEpoch(now);
const hotSeg = marketSnapshotHotSegment(epoch);
const slowSeg = marketSnapshotSlowSegment(epoch);

console.log("start", now.toISOString(), "mode", epoch.mode, "hotSeg", hotSeg, "slowSeg", slowSeg);

const [cryptoTab, cryptoPage2] = await Promise.all([
  buildMarketSnapshotCryptoTabForIngest(),
  buildMarketSnapshotCryptoPage2ForIngest(),
]);

let page2Priced = 0;
const sampleMissing = [];
for (const [sym, d] of Object.entries(cryptoPage2.crypto ?? {})) {
  if (typeof d?.price === "number" && Number.isFinite(d.price) && d.price > 0) page2Priced += 1;
  else sampleMissing.push(sym);
}
const tabRes = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoTab, hotSeg, cryptoTab);
const page2Res = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoPage2, hotSeg, cryptoPage2);
console.log(
  JSON.stringify(
    {
      cryptoTab: tabRes,
      cryptoPage2: page2Res,
      page2SymbolCount: Object.keys(cryptoPage2.crypto ?? {}).length,
      page2Priced,
      unpricedSample: sampleMissing.slice(0, 20),
      sample: {
        SUI: cryptoPage2.crypto?.SUI?.price ?? null,
        PEPE: cryptoPage2.crypto?.PEPE?.price ?? null,
        MNT: cryptoPage2.crypto?.MNT?.price ?? null,
        CRO: cryptoPage2.crypto?.CRO?.price ?? null,
        IMX: cryptoPage2.crypto?.IMX?.price ?? null,
        KAS: cryptoPage2.crypto?.KAS?.price ?? null,
        STX: cryptoPage2.crypto?.STX?.price ?? null,
      },
    },
    null,
    2,
  ),
);

const derived = await buildMarketSnapshotCryptoDerivedForIngest();
for (const [sym, row] of Object.entries(derived)) {
  if (!row) continue;
  row.marketCapUsd = resolveCryptoMarketCapUsd(sym, row.marketCapUsd);
}
const derivedRes = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoDerived, slowSeg, derived);
let derivedOk = 0;
for (const row of Object.values(derived)) {
  if (row && (row.changePercent1M != null || (row.last5DailyCloses?.length ?? 0) > 0)) derivedOk += 1;
}
console.log(
  JSON.stringify(
    {
      cryptoDerived: derivedRes,
      derivedCount: Object.keys(derived).length,
      derivedWithPerf: derivedOk,
      sampleMcaps: {
        SUI: derived.SUI?.marketCapUsd ?? null,
        PEPE: derived.PEPE?.marketCapUsd ?? null,
        HYPE: derived.HYPE?.marketCapUsd ?? null,
      },
      samplePerf: {
        SUI: { d1m: derived.SUI?.changePercent1M ?? null, ytd: derived.SUI?.changePercentYTD ?? null },
        PEPE: { d1m: derived.PEPE?.changePercent1M ?? null, ytd: derived.PEPE?.changePercentYTD ?? null },
        MNT: { d1m: derived.MNT?.changePercent1M ?? null, ytd: derived.MNT?.changePercentYTD ?? null },
      },
    },
    null,
    2,
  ),
);

console.log("done", new Date().toISOString());
