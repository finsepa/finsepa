/**
 * Immutable post-earnings 1-session returns per ticker.
 * Once a reportDateYmd has a stored %, it is never overwritten (historical fact).
 */
import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

export type EarningsPostReport1dSnapshot = {
  /** reportDateYmd → post-report 1-session return % */
  byReportDate: Record<string, number>;
};

const SEGMENT = "earnings_post_report_1d_v1";

function snapshotKey(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;
  return `earnings_post_report_1d_${t}`;
}

function isFinitePct(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function readEarningsPostReport1dSnapshot(
  ticker: string,
): Promise<EarningsPostReport1dSnapshot | null> {
  const key = snapshotKey(ticker);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data")
    .eq("key", key)
    .maybeSingle();

  if (error || !data || data.segment !== SEGMENT) return null;
  const raw = data.data as { byReportDate?: Record<string, unknown> } | null;
  const src = raw?.byReportDate;
  if (!src || typeof src !== "object") return { byReportDate: {} };

  const byReportDate: Record<string, number> = {};
  for (const [ymd, pct] of Object.entries(src)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd) && isFinitePct(pct)) {
      byReportDate[ymd] = pct;
    }
  }
  return { byReportDate };
}

/**
 * Merge-only upsert: existing reportDate keys are kept forever.
 * Returns the merged map (existing ∪ newlyInserted).
 */
export async function mergeEarningsPostReport1dSnapshot(
  ticker: string,
  newlyComputed: Record<string, number>,
): Promise<Record<string, number>> {
  const key = snapshotKey(ticker);
  if (!key) return { ...newlyComputed };

  const existing = (await readEarningsPostReport1dSnapshot(ticker))?.byReportDate ?? {};
  const merged: Record<string, number> = { ...existing };

  let added = 0;
  for (const [ymd, pct] of Object.entries(newlyComputed)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !isFinitePct(pct)) continue;
    if (ymd in merged) continue; // never overwrite
    merged[ymd] = pct;
    added += 1;
  }

  if (added === 0) return merged;

  const admin = getSupabaseAdminClient();
  if (!admin) return merged;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: SEGMENT,
      data: { byReportDate: merged } satisfies EarningsPostReport1dSnapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  return merged;
}
