import "server-only";

import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  chunkTickers,
  fetchEarningsCalendarBatch,
} from "@/lib/notifications/earnings-calendar-batch";
import type { EarningsNotifyIngestResult } from "@/lib/notifications/earnings-notify-types";
import {
  buildEarningsNotifyInterestMap,
  interestMapTickers,
} from "@/lib/notifications/earnings-notify-universe";
import {
  buildEarningsReleaseNotification,
  isRecentEarningsCalendarRow,
  shouldNotifyEarningsRelease,
} from "@/lib/notifications/earnings-release-detect";
import {
  loadEarningsReleaseSnapshots,
  upsertEarningsReleaseSnapshots,
} from "@/lib/notifications/earnings-release-snapshot-store";
import { enrichEarningsReleaseNotifications } from "@/lib/notifications/earnings-release-enrich";
import { insertEarningsReleaseNotifications } from "@/lib/notifications/user-notifications-store";

/**
 * Detect new earnings actuals for watchlist + holdings tickers via batched EODHD calendar/earnings.
 * ~1 API credit per 80 symbols; default cron every 30m ≈ 48 runs/day.
 */
export async function ingestEarningsReleaseNotifications(): Promise<EarningsNotifyIngestResult> {
  return runWithProviderTrace("cron/earnings-notifications", async () => {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      return {
        skipped: true,
        skipReason: "no_supabase_admin",
        universeTickers: 0,
        calendarBatches: 0,
        calendarRows: 0,
        releasesDetected: 0,
        notificationsCreated: 0,
        eodhdRequests: 0,
      };
    }

    const interest = await buildEarningsNotifyInterestMap(admin);
    const tickers = interestMapTickers(interest);
    if (tickers.length === 0) {
      return {
        skipped: true,
        skipReason: "empty_universe",
        universeTickers: 0,
        calendarBatches: 0,
        calendarRows: 0,
        releasesDetected: 0,
        notificationsCreated: 0,
        eodhdRequests: 0,
      };
    }

    const batches = chunkTickers(tickers);
    let eodhdRequests = 0;
    let calendarRows = 0;
    const reportedRows: Awaited<ReturnType<typeof fetchEarningsCalendarBatch>>["rows"] = [];

    for (const batch of batches) {
      const { rows, requests } = await fetchEarningsCalendarBatch(batch);
      eodhdRequests += requests;
      calendarRows += rows.length;
      reportedRows.push(...rows);
    }

    const recentReportedRows = reportedRows.filter((row) => isRecentEarningsCalendarRow(row));

    if (recentReportedRows.length === 0) {
      return {
        skipped: false,
        universeTickers: tickers.length,
        calendarBatches: batches.length,
        calendarRows: recentReportedRows.length,
        releasesDetected: 0,
        notificationsCreated: 0,
        eodhdRequests,
      };
    }

    const snapshotKeys = recentReportedRows.map((r) => ({
      ticker: r.ticker,
      fiscalPeriodEndYmd: r.fiscalPeriodEndYmd!,
    }));
    const snapshots = await loadEarningsReleaseSnapshots(admin, snapshotKeys);

    const releases = [];
    for (const row of recentReportedRows) {
      const key = `${row.ticker}|${row.fiscalPeriodEndYmd}`;
      const prev = snapshots.get(key) ?? null;
      if (shouldNotifyEarningsRelease(prev, row)) {
        releases.push(buildEarningsReleaseNotification(row));
      }
    }

    const enrichedReleases = await enrichEarningsReleaseNotifications(releases);
    const notificationsCreated = await insertEarningsReleaseNotifications(admin, interest, enrichedReleases);

    await upsertEarningsReleaseSnapshots(admin, recentReportedRows);

    return {
      skipped: false,
      universeTickers: tickers.length,
      calendarBatches: batches.length,
      calendarRows: recentReportedRows.length,
      releasesDetected: releases.length,
      notificationsCreated,
      eodhdRequests,
    };
  });
}
