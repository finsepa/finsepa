import "server-only";

import {
  MARKET_SNAPSHOT_HOT_INGEST_KEYS,
  MARKET_SNAPSHOT_INGEST_KEYS,
  MARKET_SNAPSHOT_KEY,
  MARKET_SNAPSHOT_SLOW_INGEST_KEYS,
  type MarketSnapshotKey,
} from "@/lib/market/market-snapshot-keys";
import {
  MARKET_SNAPSHOT_HOT_STALE_MS,
  marketSnapshotHotSegment,
  marketSnapshotKeyIsFresh,
  marketSnapshotSlowSegment,
  retagRecentMarketSnapshotSegment,
  upsertMarketSnapshot,
} from "@/lib/market/market-snapshot-store";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import {
  buildMarketSnapshotHotPayloadsForIngest,
  buildMarketSnapshotSlowPayloadsForIngest,
} from "@/lib/market/market-snapshot-ingest-sources";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";
import { buildMarketSnapshotIndexCardsForIngest } from "@/lib/screener/simple-index-cards";
import { buildScreenerStocksSubtabSnapshotsForIngest } from "@/lib/screener/screener-stocks-subtab-snapshot-ingest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const LIVE_HOT_INGEST_MIN_INTERVAL_MS = MARKET_SNAPSHOT_HOT_STALE_MS;
const FROZEN_INGEST_MAX_AGE_MS = 48 * 60 * 60 * 1000;
/** Live session: derived EOD bars need at most one cron fill per regular day. */
const LIVE_SLOW_INGEST_MAX_AGE_MS = 20 * 60 * 60 * 1000;

export type MarketSnapshotIngestSkipState = {
  hotSkipReason: string | null;
  slowSkipReason: string | null;
};

export type MarketSnapshotIngestResult = {
  segment: string;
  slowSegment: string;
  mode: "live" | "frozen";
  skipped: boolean;
  skipReason?: string;
  hotSkipReason?: string;
  slowSkipReason?: string;
  keys: Record<string, "ok" | "skipped" | string>;
};

export async function getMarketSnapshotIngestSkipState(
  now: Date = new Date(),
): Promise<MarketSnapshotIngestSkipState> {
  const epoch = getScreenerUsMarketCacheEpoch(now);
  const hotSeg = marketSnapshotHotSegment(epoch);
  const slowSeg = marketSnapshotSlowSegment(epoch);

  if (epoch.mode === "frozen") {
    const fresh = await marketSnapshotKeyIsFresh(
      MARKET_SNAPSHOT_KEY.stocksAllPages,
      hotSeg,
      FROZEN_INGEST_MAX_AGE_MS,
    );
    if (fresh) {
      return { hotSkipReason: "frozen_segment_fresh", slowSkipReason: "frozen_segment_fresh" };
    }
    return { hotSkipReason: null, slowSkipReason: null };
  }

  const hotFresh = await marketSnapshotKeyIsFresh(
    MARKET_SNAPSHOT_KEY.stocksAllPages,
    hotSeg,
    LIVE_HOT_INGEST_MIN_INTERVAL_MS,
  );
  const slowFresh = await marketSnapshotKeyIsFresh(
    MARKET_SNAPSHOT_KEY.screenerDerived,
    slowSeg,
    LIVE_SLOW_INGEST_MAX_AGE_MS,
  );

  return {
    hotSkipReason: hotFresh ? "live_hot_segment_recent" : null,
    slowSkipReason: slowFresh ? "live_slow_segment_fresh" : null,
  };
}

/** True only when both hot and slow tiers are fresh — full cron skip. */
export async function shouldSkipMarketSnapshotIngest(now: Date = new Date()): Promise<string | null> {
  const { hotSkipReason, slowSkipReason } = await getMarketSnapshotIngestSkipState(now);
  if (hotSkipReason && slowSkipReason) return `${hotSkipReason};${slowSkipReason}`;
  return null;
}

function skippedKeys(keys: readonly MarketSnapshotKey[]): Record<string, "skipped"> {
  return Object.fromEntries(keys.map((k) => [k, "skipped"] as const));
}

export async function ingestMarketSnapshots(now: Date = new Date()): Promise<MarketSnapshotIngestResult> {
  return runWithProviderTrace("cron/market-snapshots", async () => {
    const epoch = getScreenerUsMarketCacheEpoch(now);
    const hotSeg = marketSnapshotHotSegment(epoch);
    const slowSeg = marketSnapshotSlowSegment(epoch);
    const keys: Record<string, "ok" | "skipped" | string> = {};

    if (!getSupabaseAdminClient()) {
      return {
        segment: hotSeg,
        slowSegment: slowSeg,
        mode: epoch.mode,
        skipped: true,
        skipReason: "no_supabase_admin",
        keys: Object.fromEntries(MARKET_SNAPSHOT_INGEST_KEYS.map((k) => [k, "no_supabase_admin"])),
      };
    }

    const { hotSkipReason, slowSkipReason } = await getMarketSnapshotIngestSkipState(now);

    if (!hotSkipReason) {
      const hotEntries: [keyof Awaited<ReturnType<typeof buildMarketSnapshotHotPayloadsForIngest>>, MarketSnapshotKey][] = [
        ["stocksAllPages", MARKET_SNAPSHOT_KEY.stocksAllPages],
        ["cryptoTab", MARKET_SNAPSHOT_KEY.cryptoTab],
        ["cryptoPage2", MARKET_SNAPSHOT_KEY.cryptoPage2],
        ["indicesTab", MARKET_SNAPSHOT_KEY.indicesTab],
      ];
      const pendingFetch: typeof hotEntries = [];
      for (const entry of hotEntries) {
        const [, snapshotKey] = entry;
        if (await marketSnapshotKeyIsFresh(snapshotKey, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS)) {
          keys[snapshotKey] = "ok";
          continue;
        }
        const retagged = await retagRecentMarketSnapshotSegment(
          snapshotKey,
          hotSeg,
          LIVE_HOT_INGEST_MIN_INTERVAL_MS,
        );
        if (retagged) {
          keys[snapshotKey] = "segment_retagged";
          continue;
        }
        pendingFetch.push(entry);
      }
      if (pendingFetch.length) {
        const hot = await buildMarketSnapshotHotPayloadsForIngest();
        for (const [name, snapshotKey] of pendingFetch) {
          const res = await upsertMarketSnapshot(snapshotKey, hotSeg, hot[name]);
          keys[snapshotKey] = res.ok ? "ok" : res.reason;
        }
      }
    } else {
      Object.assign(keys, skippedKeys(MARKET_SNAPSHOT_HOT_INGEST_KEYS));
    }

    if (!slowSkipReason) {
      const slow = await buildMarketSnapshotSlowPayloadsForIngest();
      const slowEntries: [keyof typeof slow, MarketSnapshotKey][] = [
        ["screenerDerived", MARKET_SNAPSHOT_KEY.screenerDerived],
        ["cryptoDerived", MARKET_SNAPSHOT_KEY.cryptoDerived],
        ["indicesDerived", MARKET_SNAPSHOT_KEY.indicesDerived],
      ];
      for (const [name, snapshotKey] of slowEntries) {
        const res = await upsertMarketSnapshot(snapshotKey, slowSeg, slow[name]);
        keys[snapshotKey] = res.ok ? "ok" : res.reason;
      }
    } else {
      Object.assign(keys, skippedKeys(MARKET_SNAPSHOT_SLOW_INGEST_KEYS));
    }

    const indexCardsKey = MARKET_SNAPSHOT_KEY.indexCards;
    if (await marketSnapshotKeyIsFresh(indexCardsKey, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS)) {
      keys[indexCardsKey] = "ok";
    } else if (await retagRecentMarketSnapshotSegment(indexCardsKey, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS)) {
      keys[indexCardsKey] = "segment_retagged";
    } else {
      const cards = await buildMarketSnapshotIndexCardsForIngest();
      const res = await upsertMarketSnapshot(indexCardsKey, hotSeg, cards);
      keys[indexCardsKey] = res.ok ? "ok" : res.reason;
    }

    const subtabSnapshotKeys = [
      MARKET_SNAPSHOT_KEY.top500Market,
      MARKET_SNAPSHOT_KEY.screenerSectors,
      MARKET_SNAPSHOT_KEY.screenerIndustries,
      MARKET_SNAPSHOT_KEY.screenerGainersLosers,
    ] as const;
    const subtabFresh = await Promise.all(
      subtabSnapshotKeys.map((k) => marketSnapshotKeyIsFresh(k, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS)),
    );
    if (subtabFresh.every(Boolean)) {
      for (const k of subtabSnapshotKeys) keys[k] = "ok";
    } else {
      let needSubtabBuild = false;
      for (const k of subtabSnapshotKeys) {
        if (await marketSnapshotKeyIsFresh(k, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS)) {
          keys[k] = "ok";
          continue;
        }
        if (await retagRecentMarketSnapshotSegment(k, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS)) {
          keys[k] = "segment_retagged";
          continue;
        }
        needSubtabBuild = true;
      }
      if (needSubtabBuild) {
        const sub = await buildScreenerStocksSubtabSnapshotsForIngest();
        const entries: [MarketSnapshotKey, unknown][] = [
          [MARKET_SNAPSHOT_KEY.top500Market, sub.top500Market],
          [MARKET_SNAPSHOT_KEY.screenerSectors, sub.sectors],
          [MARKET_SNAPSHOT_KEY.screenerIndustries, sub.industries],
          [MARKET_SNAPSHOT_KEY.screenerGainersLosers, sub.gainersLosers],
        ];
        for (const [snapshotKey, payload] of entries) {
          const res = await upsertMarketSnapshot(snapshotKey, hotSeg, payload);
          keys[snapshotKey] = res.ok ? "ok" : res.reason;
        }
      }
    }

    const skipped = Boolean(hotSkipReason && slowSkipReason);
    return {
      segment: hotSeg,
      slowSegment: slowSeg,
      mode: epoch.mode,
      skipped,
      skipReason: skipped ? `${hotSkipReason};${slowSkipReason}` : undefined,
      hotSkipReason: hotSkipReason ?? undefined,
      slowSkipReason: slowSkipReason ?? undefined,
      keys,
    };
  });
}
