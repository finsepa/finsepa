import "server-only";

import { MARKET_SNAPSHOT_INGEST_KEYS, MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { marketSnapshotSegmentIsFresh, upsertMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import {
  buildMarketSnapshotPayloadsForIngest,
  type MarketSnapshotIngestPayloads,
} from "@/lib/market/market-snapshot-ingest-sources";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

const LIVE_INGEST_MIN_INTERVAL_MS = 14 * 60 * 1000;
const FROZEN_INGEST_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type MarketSnapshotIngestResult = {
  segment: string;
  mode: "live" | "frozen";
  skipped: boolean;
  skipReason?: string;
  keys: Record<string, "ok" | string>;
};

export async function shouldSkipMarketSnapshotIngest(now: Date = new Date()): Promise<string | null> {
  const epoch = getScreenerUsMarketCacheEpoch(now);
  if (epoch.mode === "frozen") {
    const fresh = await marketSnapshotSegmentIsFresh(epoch.segment, FROZEN_INGEST_MAX_AGE_MS);
    if (fresh) return "frozen_segment_fresh";
  } else {
    const fresh = await marketSnapshotSegmentIsFresh(epoch.segment, LIVE_INGEST_MIN_INTERVAL_MS);
    if (fresh) return "live_segment_recent";
  }
  return null;
}

export async function ingestMarketSnapshots(now: Date = new Date()): Promise<MarketSnapshotIngestResult> {
  return runWithProviderTrace("cron/market-snapshots", async () => {
    const epoch = getScreenerUsMarketCacheEpoch(now);
    const skipReason = await shouldSkipMarketSnapshotIngest(now);
    if (skipReason) {
      return {
        segment: epoch.segment,
        mode: epoch.mode,
        skipped: true,
        skipReason,
        keys: Object.fromEntries(MARKET_SNAPSHOT_INGEST_KEYS.map((k) => [k, "skipped"])),
      };
    }

    const payloads: MarketSnapshotIngestPayloads = await buildMarketSnapshotPayloadsForIngest();
    const keys: Record<string, "ok" | string> = {};

    const entries: [keyof MarketSnapshotIngestPayloads, unknown][] = [
      ["stocksAllPages", payloads.stocksAllPages],
      ["screenerDerived", payloads.screenerDerived],
      ["cryptoTab", payloads.cryptoTab],
      ["cryptoPage2", payloads.cryptoPage2],
      ["cryptoDerived", payloads.cryptoDerived],
      ["indicesTab", payloads.indicesTab],
      ["indicesDerived", payloads.indicesDerived],
    ];

    for (const [name, data] of entries) {
      const snapshotKey = MARKET_SNAPSHOT_KEY[name];
      const res = await upsertMarketSnapshot(snapshotKey, epoch.segment, data);
      keys[snapshotKey] = res.ok ? "ok" : res.reason;
    }

    return {
      segment: epoch.segment,
      mode: epoch.mode,
      skipped: false,
      keys,
    };
  });
}
