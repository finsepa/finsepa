import "server-only";

import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import type { SuperinvestorPerformanceSeries } from "@/lib/superinvestors/superinvestor-performance-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Serve durable series for up to 24h even if segment day rolls. */
const PERF_STALE_MS = 24 * 60 * 60 * 1000;

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

export async function readSuperinvestorPerformanceSnapshot(
  slug: string,
): Promise<SuperinvestorPerformanceSeries | null> {
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
  if (data.segment === today) return data.data;

  const updated = Date.parse(String(data.updated_at ?? ""));
  if (Number.isFinite(updated) && Date.now() - updated <= PERF_STALE_MS) {
    return data.data;
  }
  return null;
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
