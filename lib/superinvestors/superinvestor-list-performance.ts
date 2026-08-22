import "server-only";

import type { SuperinvestorsFundRowModel } from "@/components/superinvestors/superinvestors-fund-table";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import {
  superinvestorPerformanceHeadlineBookReturnPct,
} from "@/lib/superinvestors/superinvestor-performance-headline";
import { superinvestorPerformanceSnapshotKey } from "@/lib/superinvestors/superinvestor-performance-snapshot";
import type { SuperinvestorPerformanceSeries } from "@/lib/superinvestors/superinvestor-performance-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function slugFromFundHref(href: string): string | null {
  const m = href.match(/^\/superinvestors\/([^/?#]+)$/);
  return m?.[1]?.trim() || null;
}

function isPerformanceSeries(v: unknown): v is SuperinvestorPerformanceSeries {
  if (!v || typeof v !== "object") return false;
  const o = v as SuperinvestorPerformanceSeries;
  return typeof o.slug === "string" && Array.isArray(o.points) && o.points.length >= 2;
}

/**
 * One Supabase round-trip for all performance snapshots (no EODHD).
 * Used to hydrate list rows at read time.
 */
export async function readSuperinvestorListPerformance1yBySlug(
  slugs: readonly string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (!marketSnapshotReadEnabled() || slugs.length === 0) return out;

  const admin = getSupabaseAdminClient();
  if (!admin) return out;

  const keys = slugs.map((slug) => superinvestorPerformanceSnapshotKey(slug));
  const { data, error } = await admin.from("market_snapshot").select("key, data").in("key", keys);
  if (error || !data?.length) return out;

  const keyToSlug = new Map(slugs.map((slug) => [superinvestorPerformanceSnapshotKey(slug), slug]));

  for (const row of data) {
    const slug = keyToSlug.get(String(row.key));
    if (!slug) continue;
    const series = isPerformanceSeries(row.data) ? row.data : null;
    out.set(slug, superinvestorPerformanceHeadlineBookReturnPct(series, "1y"));
  }

  for (const slug of slugs) {
    if (!out.has(slug)) out.set(slug, null);
  }

  return out;
}

/** Merge 1Y book return % from durable performance snapshots (no vendor calls). */
export async function attachSuperinvestorListPerformance1y(
  rows: readonly SuperinvestorsFundRowModel[],
  perfBySlug?: ReadonlyMap<string, number | null>,
): Promise<SuperinvestorsFundRowModel[]> {
  if (rows.length === 0) return [];

  const slugs = rows
    .map((r) => slugFromFundHref(r.href))
    .filter((s): s is string => Boolean(s));

  const resolved =
    perfBySlug ??
    (await readSuperinvestorListPerformance1yBySlug(slugs));

  return rows.map((row) => {
    const slug = slugFromFundHref(row.href);
    const bookReturnPct1y = slug != null ? (resolved.get(slug) ?? null) : null;
    if (bookReturnPct1y === row.bookReturnPct1y) return row;
    return { ...row, bookReturnPct1y };
  });
}
