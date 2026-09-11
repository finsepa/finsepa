import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EarningsNotifyCalendarRow,
  EarningsReleaseSnapshotRow,
} from "@/lib/notifications/earnings-notify-types";
import { EARNINGS_NOTIFY_LOOKBACK_DAYS } from "@/lib/notifications/earnings-release-detect";

function lookbackYmdUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function loadEarningsReleaseSnapshots(
  admin: SupabaseClient,
  keys: readonly { ticker: string; fiscalPeriodEndYmd: string }[],
): Promise<Map<string, EarningsReleaseSnapshotRow>> {
  const out = new Map<string, EarningsReleaseSnapshotRow>();
  if (keys.length === 0) return out;

  const tickers = [...new Set(keys.map((k) => k.ticker))];
  const { data, error } = await admin
    .from("earnings_release_snapshot")
    .select("ticker,fiscal_period_end,report_date,eps_actual,eps_estimate,surprise_pct")
    .in("ticker", tickers);

  if (error) throw new Error(`earnings_snapshot_load_failed: ${error.message}`);

  for (const row of data ?? []) {
    const ticker = typeof row.ticker === "string" ? row.ticker : "";
    const fiscal = typeof row.fiscal_period_end === "string" ? row.fiscal_period_end : "";
    if (!ticker || !fiscal) continue;
    out.set(`${ticker}|${fiscal}`, row as EarningsReleaseSnapshotRow);
  }
  return out;
}

/**
 * Recent calendar actuals for one ticker — used to patch sticky earnings-tab cache
 * after a release (same rows the push cron already wrote; no EODHD).
 */
export async function loadRecentEarningsReleaseSnapshotsForTicker(
  admin: SupabaseClient,
  ticker: string,
  lookbackDays = EARNINGS_NOTIFY_LOOKBACK_DAYS,
): Promise<EarningsReleaseSnapshotRow[]> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return [];
  const since = lookbackYmdUtc(lookbackDays);
  const { data, error } = await admin
    .from("earnings_release_snapshot")
    .select("ticker,fiscal_period_end,report_date,eps_actual,eps_estimate,surprise_pct")
    .eq("ticker", sym)
    .not("eps_actual", "is", null)
    .gte("report_date", since)
    .order("report_date", { ascending: false })
    .limit(8);

  if (error) {
    console.warn(`earnings_snapshot_ticker_load_failed: ${error.message}`);
    return [];
  }
  return (data ?? []) as EarningsReleaseSnapshotRow[];
}

export async function upsertEarningsReleaseSnapshots(
  admin: SupabaseClient,
  rows: readonly EarningsNotifyCalendarRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const payload = rows.map((row) => ({
    ticker: row.ticker,
    fiscal_period_end: row.fiscalPeriodEndYmd,
    report_date: row.reportDateYmd,
    eps_actual: row.epsActual,
    eps_estimate: row.epsEstimate,
    surprise_pct: row.surprisePct,
    updated_at: now,
  }));
  const { error } = await admin
    .from("earnings_release_snapshot")
    .upsert(payload, { onConflict: "ticker,fiscal_period_end" });
  if (error) throw new Error(`earnings_snapshot_upsert_failed: ${error.message}`);
}
