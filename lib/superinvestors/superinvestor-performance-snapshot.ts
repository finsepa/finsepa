import "server-only";

import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import type { SuperinvestorPerformanceSeries } from "@/lib/superinvestors/superinvestor-performance-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Durable `market_snapshot` key per manager.
 * Berkshire keeps the historical key so existing warm rows are not orphaned.
 */
export function superinvestorPerformanceSnapshotKey(slug: string): string {
  if (slug === "berkshire-hathaway") return "superinvestor_perf_berkshire_v1";
  return `superinvestor_perf_${slug.replace(/-/g, "_")}_v1`;
}

function isPerformanceSeries(v: unknown): v is SuperinvestorPerformanceSeries {
  if (!v || typeof v !== "object") return false;
  const o = v as SuperinvestorPerformanceSeries;
  return (
    typeof o.slug === "string" &&
    Array.isArray(o.points) &&
    o.points.length >= 2 &&
    typeof o.fromYmd === "string" &&
    typeof o.toYmd === "string"
  );
}

export type SuperinvestorPerformanceSnapshotRow = {
  series: SuperinvestorPerformanceSeries;
  segment: string | null;
  updatedAt: string | null;
  /** True when upsert segment is not today's UTC date. */
  stale: boolean;
};

function ymdDaysAgo(days: number, fromYmd: string): string {
  const [y, m, d] = fromYmd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/** Read durable row metadata (cron rebuild decisions). */
export async function readSuperinvestorPerformanceSnapshotRow(
  slug: string,
): Promise<SuperinvestorPerformanceSnapshotRow | null> {
  if (!slug.trim() || !marketSnapshotReadEnabled()) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("segment, data, updated_at")
    .eq("key", superinvestorPerformanceSnapshotKey(slug))
    .maybeSingle();

  if (error || !data?.data) return null;
  if (!isPerformanceSeries(data.data)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const segment = typeof data.segment === "string" ? data.segment : null;
  return {
    series: data.data,
    segment,
    updatedAt: data.updated_at != null ? String(data.updated_at) : null,
    stale: segment !== today,
  };
}

/**
 * User/API read: serve the last good series (stale-while-revalidate).
 * Returns null only when no valid snapshot exists.
 */
export async function readSuperinvestorPerformanceSnapshot(
  slug: string,
): Promise<SuperinvestorPerformanceSeries | null> {
  const row = await readSuperinvestorPerformanceSnapshotRow(slug);
  return row?.series ?? null;
}

/**
 * Cron rebuild skip: avoid SEC + EOD when today's segment exists or series end is recent.
 * Uses a 3-day calendar buffer so weekend/holiday gaps still refresh on the next cron.
 */
export function shouldSkipSuperinvestorPerformanceRebuild(
  row: SuperinvestorPerformanceSnapshotRow,
): boolean {
  if (!row.stale) return true;
  const today = new Date().toISOString().slice(0, 10);
  return row.series.toYmd >= ymdDaysAgo(3, today);
}

export async function upsertSuperinvestorPerformanceSnapshot(
  slug: string,
  series: SuperinvestorPerformanceSeries,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const today = new Date().toISOString().slice(0, 10);
  await admin.from("market_snapshot").upsert(
    {
      key: superinvestorPerformanceSnapshotKey(slug),
      segment: today,
      data: series,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

/** @deprecated Prefer {@link readSuperinvestorPerformanceSnapshot}. */
export async function readBerkshirePerformanceSnapshot(): Promise<SuperinvestorPerformanceSeries | null> {
  return readSuperinvestorPerformanceSnapshot("berkshire-hathaway");
}

/** @deprecated Prefer {@link upsertSuperinvestorPerformanceSnapshot}. */
export async function upsertBerkshirePerformanceSnapshot(
  series: SuperinvestorPerformanceSeries,
): Promise<void> {
  return upsertSuperinvestorPerformanceSnapshot("berkshire-hathaway", series);
}
