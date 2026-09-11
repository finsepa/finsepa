import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { filterUserIdsWithActivityAlerts } from "@/lib/account/activity-alerts-entitlement";
import { listDevicePushTokensForUsers } from "@/lib/notifications/device-push-tokens-store";
import { sendEarningsApnsToDevices } from "@/lib/notifications/apns-push";
import {
  EARNINGS_REPORTS_KIND,
  EARNINGS_SLIDES_KIND,
  type EarningsDocsAvailabilityEvent,
  earningsDocsDedupeKey,
  formatEarningsDocsPeriodLabel,
  formatEarningsReportsPushCopy,
  formatEarningsSlidesPushCopy,
} from "@/lib/notifications/earnings-docs-notify-model";
import {
  loadReportsNotificationsDisabledUserIds,
  loadSlidesNotificationsDisabledUserIds,
} from "@/lib/notifications/notification-preferences-store";
import {
  canonicalNotifyTicker,
  isEarningsNotifiableTicker,
} from "@/lib/notifications/ticker-notify-eligibility";
import { parsePersistedPortfolioUnknown } from "@/lib/portfolio/portfolio-storage";

async function loadInterestedUserIdsForTicker(
  admin: SupabaseClient,
  ticker: string,
): Promise<string[]> {
  const key = canonicalNotifyTicker(ticker);
  if (!key || !isEarningsNotifiableTicker(key)) return [];

  const interested = new Set<string>();

  const { data: watchRows, error: watchErr } = await admin
    .from("watchlist")
    .select("user_id,ticker")
    .ilike("ticker", key);
  if (watchErr) throw new Error(`watchlist_load_failed: ${watchErr.message}`);
  for (const row of watchRows ?? []) {
    if (typeof row.user_id !== "string" || typeof row.ticker !== "string") continue;
    if (canonicalNotifyTicker(row.ticker) !== key) continue;
    interested.add(row.user_id);
  }

  const { data: portfolioRows, error: portErr } = await admin
    .from("portfolio_workspace")
    .select("user_id,state");
  if (portErr) throw new Error(`portfolio_workspace_load_failed: ${portErr.message}`);

  for (const row of portfolioRows ?? []) {
    if (typeof row.user_id !== "string") continue;
    const state = parsePersistedPortfolioUnknown(row.state);
    if (!state) continue;
    for (const holdings of Object.values(state.holdingsByPortfolioId)) {
      for (const h of holdings) {
        if (h.shares <= 0) continue;
        if (canonicalNotifyTicker(h.symbol) !== key) continue;
        interested.add(row.user_id);
      }
    }
  }

  return [...interested];
}

/**
 * After document cache gains slides or SEC reports for a recent quarter, notify
 * interested Pro users (prefs + entitlement). No EODHD — detection is on persist only.
 */
export async function notifyEarningsDocsAvailable(
  admin: SupabaseClient,
  events: readonly EarningsDocsAvailabilityEvent[],
): Promise<number> {
  if (events.length === 0) return 0;

  const byTicker = new Map<string, EarningsDocsAvailabilityEvent[]>();
  for (const event of events) {
    const list = byTicker.get(event.ticker) ?? [];
    list.push(event);
    byTicker.set(event.ticker, list);
  }

  const [slidesDisabled, reportsDisabled] = await Promise.all([
    loadSlidesNotificationsDisabledUserIds(admin),
    loadReportsNotificationsDisabledUserIds(admin),
  ]);

  const rows: {
    user_id: string;
    kind: string;
    ticker: string;
    title: string;
    body: string;
    href: string;
    payload: Record<string, unknown>;
    dedupe_key: string;
  }[] = [];

  for (const [ticker, tickerEvents] of byTicker) {
    const userIds = await loadInterestedUserIdsForTicker(admin, ticker);
    if (userIds.length === 0) continue;
    const eligible = await filterUserIdsWithActivityAlerts(admin, userIds);

    for (const event of tickerEvents) {
      const periodLabel = formatEarningsDocsPeriodLabel(event.fiscalPeriodEndYmd);
      const copy =
        event.kind === EARNINGS_SLIDES_KIND
          ? formatEarningsSlidesPushCopy({ ticker: event.ticker, periodLabel })
          : formatEarningsReportsPushCopy({ ticker: event.ticker, periodLabel });
      const href = `/stock/${encodeURIComponent(event.ticker)}?tab=earnings`;
      const dedupeKey = earningsDocsDedupeKey(
        event.kind,
        event.ticker,
        event.fiscalPeriodEndYmd,
      );
      const payload = {
        ticker: event.ticker,
        fiscalPeriodLabel: periodLabel,
        fiscalPeriodEndYmd: event.fiscalPeriodEndYmd,
        reportDateYmd: event.reportDateYmd,
        documentUrl: event.documentUrl,
        href,
        docsKind: event.kind === EARNINGS_SLIDES_KIND ? "slides" : "reports",
      };

      for (const userId of userIds) {
        if (!eligible.has(userId)) continue;
        if (event.kind === EARNINGS_SLIDES_KIND && slidesDisabled.has(userId)) continue;
        if (event.kind === EARNINGS_REPORTS_KIND && reportsDisabled.has(userId)) continue;
        rows.push({
          user_id: userId,
          kind: event.kind,
          ticker: event.ticker,
          title: copy.title,
          body: copy.body,
          href,
          payload,
          dedupe_key: dedupeKey,
        });
      }
    }
  }

  if (rows.length === 0) return 0;

  const { data, error } = await admin
    .from("user_notifications")
    .upsert(rows, { onConflict: "user_id,kind,dedupe_key", ignoreDuplicates: true })
    .select("id,user_id,ticker,title,body,kind,payload");

  if (error) throw new Error(`user_notifications_insert_failed: ${error.message}`);

  const inserted = (data ?? []) as {
    id: string;
    user_id: string;
    ticker: string;
    title: string;
    body: string;
    kind: string;
    payload: Record<string, unknown> | null;
  }[];

  if (inserted.length > 0) {
    const deviceUserIds = [...new Set(inserted.map((row) => row.user_id))];
    const devices = await listDevicePushTokensForUsers(admin, deviceUserIds);
    if (devices.length > 0) {
      const devicesByUser = new Map<string, typeof devices>();
      for (const device of devices) {
        const list = devicesByUser.get(device.user_id) ?? [];
        list.push(device);
        devicesByUser.set(device.user_id, list);
      }
      await Promise.all(
        inserted.map(async (row) => {
          const userDevices = devicesByUser.get(row.user_id) ?? [];
          if (userDevices.length === 0) return;
          const logoUrl =
            typeof row.payload?.logoUrl === "string" && row.payload.logoUrl.trim()
              ? row.payload.logoUrl.trim()
              : undefined;
          await sendEarningsApnsToDevices(admin, userDevices, {
            title: row.title,
            body: row.body,
            ticker: row.ticker,
            kind: row.kind,
            notificationId: row.id,
            logoUrl,
          });
        }),
      );
    }
  }

  return inserted.length;
}

/** Fire-and-forget from document persist — never fail the warm/page path. */
export function scheduleNotifyEarningsDocsAvailable(
  events: readonly EarningsDocsAvailabilityEvent[],
): void {
  if (events.length === 0) return;
  void (async () => {
    try {
      const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = getSupabaseAdminClient();
      if (!admin) return;
      await notifyEarningsDocsAvailable(admin, events);
    } catch (err) {
      console.warn(
        "earnings_docs_notify_failed",
        err instanceof Error ? err.message : err,
      );
    }
  })();
}
