import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EarningsNotifyCalendarRow,
  EarningsReleaseSnapshotRow,
} from "@/lib/notifications/earnings-notify-types";

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
