import "server-only";

import { REVALIDATE_HOT, REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
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
import { hubSnapshotRowIsFresh, upsertHubSnapshot } from "@/lib/market/hub-snapshot-store";
import { buildEconomyWeekHubPayload } from "@/lib/market/economy-week-data";
import { addDaysUtc, buildEarningsWeekHubPackage, mondayOfWeekUtc, toYmdUtc } from "@/lib/market/earnings-week-data";
import { buildMacroDashboardPayloadForIngest } from "@/lib/market/macro-dashboard-payload";
import { buildNewsFeedForHubIngest } from "@/lib/news/news-feed";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import type { NewsTab } from "@/lib/news/news-types";

const ECONOMY_CRON_COUNTRIES = ["US"] as const;
const NEWS_TABS: NewsTab[] = ["stocks", "crypto", "indices"];

export type HubSnapshotIngestResult = {
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
      if (await hubSnapshotRowIsFresh(key, seg, REVALIDATE_HOT * 1000)) {
        keys[key] = "skipped";
      } else {
        const feed = await buildNewsFeedForHubIngest(tab);
        const res = await upsertHubSnapshot(key, seg, feed);
        keys[key] = res.ok ? "ok" : res.reason;
      }
    }

    for (const weekYmd of earningsWeekMondaysForIngest(now)) {
      const key = hubEarningsWeekKey(weekYmd);
      const seg = earningsWeekHubSegment(weekYmd);
      if (await hubSnapshotRowIsFresh(key, seg, REVALIDATE_STATIC_DAY * 1000)) {
        keys[key] = "skipped";
      } else {
        const pack = await buildEarningsWeekHubPackage(utcMondayFromYmd(weekYmd));
        const res = await upsertHubSnapshot(key, seg, pack);
        keys[key] = res.ok ? "ok" : res.reason;
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

    return { keys };
  });
}
