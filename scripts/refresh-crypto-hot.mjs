/**
 * Force-rebuild crypto quote hubs only (`crypto_tab` + `crypto_page2`).
 *
 * Usage: set -a && source .env.local && set +a && NODE_OPTIONS='--conditions=react-server' npx tsx scripts/refresh-crypto-hot.mjs
 */
import { getScreenerUsMarketCacheEpoch } from "../lib/screener/screener-us-market-cache.ts";
import {
  buildMarketSnapshotCryptoPage2ForIngest,
  buildMarketSnapshotCryptoTabForIngest,
} from "../lib/market/simple-market-layer.ts";
import { MARKET_SNAPSHOT_KEY } from "../lib/market/market-snapshot-keys.ts";
import { marketSnapshotHotSegment, upsertMarketSnapshot } from "../lib/market/market-snapshot-store.ts";

const now = new Date();
const epoch = getScreenerUsMarketCacheEpoch(now);
const hotSeg = marketSnapshotHotSegment(epoch);
console.log("start", now.toISOString(), "mode", epoch.mode, "hotSeg", hotSeg);

const [cryptoTab, cryptoPage2] = await Promise.all([
  buildMarketSnapshotCryptoTabForIngest(),
  buildMarketSnapshotCryptoPage2ForIngest(),
]);

function pricedCount(data) {
  let n = 0;
  for (const d of Object.values(data.crypto ?? {})) {
    if (typeof d?.price === "number" && Number.isFinite(d.price) && d.price > 0) n += 1;
  }
  return n;
}

const tabRes = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoTab, hotSeg, cryptoTab);
const page2Res = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoPage2, hotSeg, cryptoPage2);

console.log(
  JSON.stringify(
    {
      cryptoTab: tabRes,
      cryptoPage2: page2Res,
      tabPriced: pricedCount(cryptoTab),
      tabKeys: Object.keys(cryptoTab.crypto ?? {}).length,
      page2Priced: pricedCount(cryptoPage2),
      page2Keys: Object.keys(cryptoPage2.crypto ?? {}).length,
      sample: {
        SUI: cryptoPage2.crypto?.SUI ?? null,
        PEPE: cryptoPage2.crypto?.PEPE ?? null,
        MNT: cryptoPage2.crypto?.MNT ?? null,
        CRO: cryptoPage2.crypto?.CRO ?? null,
        IMX: cryptoPage2.crypto?.IMX ?? null,
        KAS: cryptoPage2.crypto?.KAS ?? null,
        STX: cryptoPage2.crypto?.STX ?? null,
        BTC: cryptoTab.crypto?.BTC ?? null,
      },
    },
    null,
    2,
  ),
);
console.log("done", new Date().toISOString());
