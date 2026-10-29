import "server-only";

import { REVALIDATE_STATIC_DAY, REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import {
  earningsWeekHubSegment,
  economyWeekHubSegment,
  HUB_SNAPSHOT_KEY,
  hubEarningsWeekKey,
  hubEconomyWeekKey,
  hubNewsKey,
  macroHubSegment,
  newsHubSegment,
} from "@/lib/market/hub-snapshot-keys";
import { hubSnapshotRowIsFresh, readHubSnapshot, upsertHubSnapshot } from "@/lib/market/hub-snapshot-store";
import { buildEconomyWeekHubPayload } from "@/lib/market/economy-week-data";
import {
  addDaysUtc,
  buildEarningsWeekHubPackage,
  earningsWeekRebuildLooksDegraded,
  mondayOfWeekUtc,
  toYmdUtc,
  type EarningsWeekDataPackage,
} from "@/lib/market/earnings-week-data";
import { buildUsEquityMcapSnapshotForIngest, usEquityMcapSegment } from "@/lib/market/us-equity-mcap-universe";
import { buildMacroDashboardPayloadForIngest } from "@/lib/market/macro-dashboard-payload";
import { buildNewsFeedForHubIngest } from "@/lib/news/news-feed";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NewsTab } from "@/lib/news/news-types";

const ECONOMY_CRON_COUNTRIES = ["US"] as const;
const NEWS_TABS: NewsTab[] = ["stocks", "crypto", "indices"];
/** Hub news segment is daily; avoid re-fetching all tabs on every 15m cron tick. */
const NEWS_HUB_CRON_MAX_AGE_MS = REVALIDATE_WARM_LONG * 1000;

export type HubSnapshotIngestResult = {
  skipped: boolean;
  skipReason?: string;
  keys: Record<string, "ok" | "skipped" | string>;
};

function earningsWeekMondaysForIngest(now: Date): string[] {
  const mon = mondayOfWeekUtc(now);
  return [toYmdUtc(addDaysUtc(mon, -7)), toYmdUtc(mon), toYmdUtc(addDaysUtc(mon, 7))];
}

function utcMondayFromYmd(weekMondayYmd: string): Date {
  const t = Date.parse(`${weekMondayYmd}T12:00:00.000Z`);
  return Number.isFinite(t) ? mondayOfWeekUtc(new Date(t)) : mondayOfWeekUtc(new Date());
}

export async function ingestHubSnapshots(now: Date = new Date()): Promise<HubSnapshotIngestResult> {
  return runWithProviderTrace("cron/hub-snapshots", async () => {
    if (!getSupabaseAdminClient()) {
      return {
        skipped: true,
        skipReason: "no_supabase_admin",
        keys: {},
      };
    }

    const keys: Record<string, "ok" | "skipped" | string> = {};

    const macroSeg = macroHubSegment(now);
    if (await hubSnapshotRowIsFresh(HUB_SNAPSHOT_KEY.macroDashboard, macroSeg, REVALIDATE_STATIC_DAY * 1000)) {
      keys[HUB_SNAPSHOT_KEY.macroDashboard] = "skipped";
    } else {
      const macro = await buildMacroDashboardPayloadForIngest();
      const res = await upsertHubSnapshot(HUB_SNAPSHOT_KEY.macroDashboard, macroSeg, macro);
      keys[HUB_SNAPSHOT_KEY.macroDashboard] = res.ok ? "ok" : res.reason;
    }

    for (const tab of NEWS_TABS) {
      const key = hubNewsKey(tab);
      const seg = newsHubSegment(tab, now);
      if (await hubSnapshotRowIsFresh(key, seg, NEWS_HUB_CRON_MAX_AGE_MS)) {
        keys[key] = "skipped";
      } else {
        const feed = await buildNewsFeedForHubIngest(tab);
        const res = await upsertHubSnapshot(key, seg, feed);
        keys[key] = res.ok ? "ok" : res.reason;
      }
    }

    // Before earnings weeks: they size companies from this list instead of per-ticker fundamentals.
    const mcapSeg = usEquityMcapSegment(now);
    if (await hubSnapshotRowIsFresh(HUB_SNAPSHOT_KEY.usEquityMcap, mcapSeg, REVALIDATE_STATIC_DAY * 1000)) {
      keys[HUB_SNAPSHOT_KEY.usEquityMcap] = "skipped";
    } else {
      const snap = await buildUsEquityMcapSnapshotForIngest();
      if (snap) {
        const res = await upsertHubSnapshot(HUB_SNAPSHOT_KEY.usEquityMcap, mcapSeg, snap);
        keys[HUB_SNAPSHOT_KEY.usEquityMcap] = res.ok ? "ok" : res.reason;
      } else {
        keys[HUB_SNAPSHOT_KEY.usEquityMcap] = "incomplete_build_kept_previous";
      }
    }

    for (const weekYmd of earningsWeekMondaysForIngest(now)) {
      const key = hubEarningsWeekKey(weekYmd);
      const seg = earningsWeekHubSegment(weekYmd);
      if (await hubSnapshotRowIsFresh(key, seg, REVALIDATE_STATIC_DAY * 1000)) {
        keys[key] = "skipped";
      } else {
        try {
          const pack = await buildEarningsWeekHubPackage(utcMondayFromYmd(weekYmd));
          const previous = await readHubSnapshot<EarningsWeekDataPackage>(key, seg, { allowStale: true });
          const degraded = previous ? earningsWeekRebuildLooksDegraded(previous, pack) : null;
          if (degraded) {
            console.warn("[hub ingest] earnings week rebuild looks degraded — keeping previous", key, degraded);
            keys[key] = "degraded_kept_previous";
          } else {
            const res = await upsertHubSnapshot(key, seg, pack);
            keys[key] = res.ok ? "ok" : res.reason;
          }
        } catch (e) {
          keys[key] = e instanceof Error ? e.message.slice(0, 120) : "build_failed";
        }
      }
    }

    for (const weekYmd of earningsWeekMondaysForIngest(now)) {
      for (const cc of ECONOMY_CRON_COUNTRIES) {
        const key = hubEconomyWeekKey(weekYmd, cc);
        const seg = economyWeekHubSegment(weekYmd, cc);
        if (await hubSnapshotRowIsFresh(key, seg, REVALIDATE_STATIC_DAY * 1000)) {
          keys[key] = "skipped";
        } else {
          const payload = await buildEconomyWeekHubPayload(utcMondayFromYmd(weekYmd), cc);
          const res = await upsertHubSnapshot(key, seg, payload);
          keys[key] = res.ok ? "ok" : res.reason;
        }
      }
    }

    const allSkipped = Object.values(keys).every((v) => v === "skipped");
    return {
      skipped: allSkipped && Object.keys(keys).length > 0,
      skipReason: allSkipped ? "all_hub_keys_fresh" : undefined,
      keys,
    };
  });
}
