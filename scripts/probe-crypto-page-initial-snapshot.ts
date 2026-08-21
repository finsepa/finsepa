import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const so = require.resolve("server-only");
require.cache[so] = { id: so, filename: so, loaded: true, exports: {} } as NodeModule;

async function main() {
  const { getSupabaseAdminClient } = await import("../lib/supabase/admin");
  const {
    getCryptoPageCacheSegment,
    cryptoPageSnapshotKey,
    readCryptoPageSnapshot,
  } = await import("../lib/market/crypto-page-snapshot-store");
  const { marketSnapshotReadEnabled } = await import("../lib/market/market-snapshot-store");

  const admin = getSupabaseAdminClient();
  const segment = getCryptoPageCacheSegment();
  console.log(
    JSON.stringify(
      { marketSnapshotReadEnabled: marketSnapshotReadEnabled(), hasAdmin: !!admin, segment },
      null,
      2,
    ),
  );

  for (const sym of ["BTC", "SOL"]) {
    const key = cryptoPageSnapshotKey(sym);
    const hit = await readCryptoPageSnapshot(sym, segment, { allowStale: true });
    let row: unknown = null;
    if (admin) {
      const { data, error } = await admin
        .from("market_snapshot")
        .select("key, segment, updated_at")
        .eq("key", key)
        .maybeSingle();
      row = { data, error: error?.message ?? null };
    }
    console.log(
      JSON.stringify(
        {
          sym,
          key,
          readPath: hit
            ? {
                status: "HIT",
                exactSegment: hit.exactSegment,
                hasAsset: !!hit.payload.asset,
                chartPts: hit.payload.chart?.points?.length ?? 0,
                news: hit.payload.news?.length ?? 0,
                sessionPts: hit.payload.sessionChart?.points?.length ?? 0,
                headerLive: hit.payload.headerLiveSpotUsd ?? null,
                chartRange: hit.payload.chart?.range ?? null,
              }
            : { status: "MISS" },
          row,
        },
        null,
        2,
      ),
    );
  }

  if (admin) {
    for (const key of [
      "asset_BTC",
      "asset_SOL",
      "crypto_market_cap_BTC",
      "crypto_market_cap_SOL",
    ]) {
      const { data } = await admin
        .from("market_snapshot")
        .select("key, segment, updated_at")
        .eq("key", key)
        .maybeSingle();
      console.log(
        JSON.stringify({
          other_key: key,
          status: data ? "HIT" : "MISS",
          segment: data?.segment ?? null,
          updated_at: data?.updated_at ?? null,
        }),
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
