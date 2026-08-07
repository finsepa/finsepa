import type { SuperinvestorsFundRowModel } from "@/components/superinvestors/superinvestors-fund-table";
import {
  buildSuperinvestorListRowsFromProfileSnapshots,
  readSuperinvestorListSnapshot,
} from "@/lib/superinvestors/superinvestor-list-snapshot";

/**
 * Ready-to-render Superinvestors table rows — snapshot-only (no SEC).
 * Warm path: single durable aggregate read.
 * Degraded cold path: assemble from per-CIK profile snapshots (still no SEC, no user-side writes).
 * Aggregate rebuilds belong to cron / authenticated ops only.
 */
export async function loadSuperinvestorsListRows(): Promise<SuperinvestorsFundRowModel[]> {
  const snap = await readSuperinvestorListSnapshot();
  if (snap?.rows.length) return snap.rows;

  return buildSuperinvestorListRowsFromProfileSnapshots();
}
