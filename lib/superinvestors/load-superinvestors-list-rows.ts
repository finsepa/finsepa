import type { SuperinvestorsFundRowModel } from "@/components/superinvestors/superinvestors-fund-table";
import {
  attachSuperinvestorListPerformance1y,
  readSuperinvestorListPerformance1yBySlug,
} from "@/lib/superinvestors/superinvestor-list-performance";
import {
  buildSuperinvestorListRowsFromProfileSnapshots,
  readSuperinvestorListSnapshot,
} from "@/lib/superinvestors/superinvestor-list-snapshot";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";

/**
 * Ready-to-render Superinvestors table rows — snapshot-only (no SEC, no EODHD).
 * Warm path: aggregate list snapshot + one parallel batch read of performance snapshots.
 * Degraded cold path: assemble from per-CIK profile snapshots (still no SEC, no user-side writes).
 * Aggregate rebuilds belong to cron / authenticated ops only.
 */
export async function loadSuperinvestorsListRows(): Promise<SuperinvestorsFundRowModel[]> {
  const perfSlugs = Object.keys(SUPERINVESTOR_SLUG_CIK);
  const [snap, perfBySlug] = await Promise.all([
    readSuperinvestorListSnapshot(),
    readSuperinvestorListPerformance1yBySlug(perfSlugs),
  ]);

  const base = snap?.rows.length ? snap.rows : await buildSuperinvestorListRowsFromProfileSnapshots();
  if (base.length === 0) return [];

  return attachSuperinvestorListPerformance1y(base, perfBySlug);
}
