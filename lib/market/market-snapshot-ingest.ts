import "server-only";

import {
  MARKET_SNAPSHOT_CRYPTO_HOT_INGEST_KEYS,
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
  buildMarketSnapshotCryptoHotPayloadsForIngest,
  buildMarketSnapshotHotPayloadsForIngest,
  buildMarketSnapshotSlowPayloadsForIngest,
} from "@/lib/market/market-snapshot-ingest-sources";
import { buildMarketSnapshotCryptoDerivedForIngest } from "@/lib/market/simple-market-layer";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";
import { buildMarketSnapshotIndexCardsForIngest } from "@/lib/screener/simple-index-cards";
import { buildScreenerStocksSubtabSnapshotsForIngest } from "@/lib/screener/screener-stocks-subtab-snapshot-ingest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const LIVE_HOT_INGEST_MIN_INTERVAL_MS = MARKET_SNAPSHOT_HOT_STALE_MS;
const FROZEN_INGEST_MAX_AGE_MS = 48 * 60 * 60 * 1000;
/** Live session: derived EOD bars need at most one cron fill per regular day. */
const LIVE_SLOW_INGEST_MAX_AGE_MS = 20 * 60 * 60 * 1000;

const EQUITY_HOT_SKIP_KEYS: readonly MarketSnapshotKey[] = MARKET_SNAPSHOT_HOT_INGEST_KEYS.filter(
  (k) => !MARKET_SNAPSHOT_CRYPTO_HOT_INGEST_KEYS.includes(k),
);

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

/**
 * True when equity hot+slow can skip **and** crypto hot hubs are still fresh.
 * Frozen US session still refreshes `crypto_tab` / `crypto_page2` on the 15m cadence.
 */
export async function shouldSkipMarketSnapshotIngest(now: Date = new Date()): Promise<string | null> {
  const { hotSkipReason, slowSkipReason } = await getMarketSnapshotIngestSkipState(now);
  if (!(hotSkipReason && slowSkipReason)) return null;

  if (hotSkipReason === "frozen_segment_fresh") {
    const epoch = getScreenerUsMarketCacheEpoch(now);
    const hotSeg = marketSnapshotHotSegment(epoch);
    const cryptoFresh = await Promise.all(
      MARKET_SNAPSHOT_CRYPTO_HOT_INGEST_KEYS.map((k) =>
        marketSnapshotKeyIsFresh(k, hotSeg, LIVE_HOT_INGEST_MIN_INTERVAL_MS),
      ),
    );
    if (!cryptoFresh.every(Boolean)) return null;
  }

  return `${hotSkipReason};${slowSkipReason}`;
}

function skippedKeys(keys: readonly MarketSnapshotKey[]): Record<string, "skipped"> {
  return Object.fromEntries(keys.map((k) => [k, "skipped"] as const));
}

async function upsertCryptoHotIfStale(
  hotSeg: string,
  keys: Record<string, "ok" | "skipped" | string>,
): Promise<boolean> {
  const cryptoEntries: ["cryptoTab" | "cryptoPage2", MarketSnapshotKey][] = [
    ["cryptoTab", MARKET_SNAPSHOT_KEY.cryptoTab],
    ["cryptoPage2", MARKET_SNAPSHOT_KEY.cryptoPage2],
  ];
  const pendingFetch: typeof cryptoEntries = [];
  for (const entry of cryptoEntries) {
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
  if (!pendingFetch.length) return false;

  const crypto = await buildMarketSnapshotCryptoHotPayloadsForIngest();
  for (const [name, snapshotKey] of pendingFetch) {
    const res = await upsertMarketSnapshot(snapshotKey, hotSeg, crypto[name]);
    keys[snapshotKey] = res.ok ? "ok" : res.reason;
  }
  return true;
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
    let cryptoRefreshedWhileFrozen = false;

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
      Object.assign(keys, skippedKeys(EQUITY_HOT_SKIP_KEYS));
      // Crypto 24/7: keep refreshing screener page1/page2 while US equities stay frozen.
      if (hotSkipReason === "frozen_segment_fresh") {
        cryptoRefreshedWhileFrozen = await upsertCryptoHotIfStale(hotSeg, keys);
      } else {
        Object.assign(keys, skippedKeys(MARKET_SNAPSHOT_CRYPTO_HOT_INGEST_KEYS));
      }
    }

    if (!slowSkipReason) {
      const slow = await buildMarketSnapshotSlowPayloadsForIngest();
      const slowEntries: [keyof typeof slow, MarketSnapshotKey][] = [
        ["screenerDerived", MARKET_SNAPSHOT_KEY.screenerDerived],
        ["cryptoDerived", MARKET_SNAPSHOT_KEY.cryptoDerived],
        ["indicesDerived", MARKET_SNAPSHOT_KEY.indicesDerived],
        ["currenciesTab", MARKET_SNAPSHOT_KEY.currenciesTab],
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

    const equitySkipped = Boolean(hotSkipReason && slowSkipReason);
    const skipped = equitySkipped && !cryptoRefreshedWhileFrozen;
    return {
      segment: hotSeg,
      slowSegment: slowSeg,
      mode: epoch.mode,
      skipped,
      skipReason: equitySkipped
        ? cryptoRefreshedWhileFrozen
          ? `${hotSkipReason};${slowSkipReason};crypto_hot_refreshed`
          : `${hotSkipReason};${slowSkipReason}`
        : undefined,
      hotSkipReason: hotSkipReason ?? undefined,
      slowSkipReason: slowSkipReason ?? undefined,
      keys,
    };
  });
}

/**
 * Force-rebuild `crypto_derived` even when the US session is frozen / slow tier is “fresh”.
 * Manual repair path — not the regular 15m cron.
 */
export async function forceIngestCryptoDerived(now: Date = new Date()): Promise<{
  segment: string;
  result: "ok" | string;
  sampleMcaps: Record<string, number | null>;
  symbolCount: number;
}> {
  return runWithProviderTrace("cron/market-snapshots-force-crypto-derived", async () => {
    const epoch = getScreenerUsMarketCacheEpoch(now);
    const slowSeg = marketSnapshotSlowSegment(epoch);
    if (!getSupabaseAdminClient()) {
      return { segment: slowSeg, result: "no_supabase_admin", sampleMcaps: {}, symbolCount: 0 };
    }
    const derived = await buildMarketSnapshotCryptoDerivedForIngest();
    const res = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoDerived, slowSeg, derived);
    return {
      segment: slowSeg,
      result: res.ok ? "ok" : res.reason,
      symbolCount: Object.keys(derived).length,
      sampleMcaps: {
        USDT: derived.USDT?.marketCapUsd ?? null,
        SUI: derived.SUI?.marketCapUsd ?? null,
        PEPE: derived.PEPE?.marketCapUsd ?? null,
        HYPE: derived.HYPE?.marketCapUsd ?? null,
        BTC: derived.BTC?.marketCapUsd ?? null,
      },
    };
  });
}

/** Force-rebuild crypto quote hubs (`crypto_tab` + `crypto_page2`) for the current universe. */
export async function forceIngestCryptoHot(now: Date = new Date()): Promise<{
  segment: string;
  cryptoTab: string;
  cryptoPage2: string;
  page2Priced: number;
}> {
  return runWithProviderTrace("cron/market-snapshots-force-crypto-hot", async () => {
    const epoch = getScreenerUsMarketCacheEpoch(now);
    const hotSeg = marketSnapshotHotSegment(epoch);
    const empty = { segment: hotSeg, cryptoTab: "no_supabase_admin", cryptoPage2: "no_supabase_admin", page2Priced: 0 };
    if (!getSupabaseAdminClient()) return empty;
    const crypto = await buildMarketSnapshotCryptoHotPayloadsForIngest();
    const tabRes = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoTab, hotSeg, crypto.cryptoTab);
    const page2Res = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.cryptoPage2, hotSeg, crypto.cryptoPage2);
    let page2Priced = 0;
    for (const d of Object.values(crypto.cryptoPage2.crypto ?? {})) {
      if (typeof d?.price === "number" && Number.isFinite(d.price) && d.price > 0) page2Priced += 1;
    }
    return {
      segment: hotSeg,
      cryptoTab: tabRes.ok ? "ok" : tabRes.reason,
      cryptoPage2: page2Res.ok ? "ok" : page2Res.reason,
      page2Priced,
    };
  });
}
