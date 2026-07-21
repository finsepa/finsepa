import type { Berkshire13fComparisonPayload, Berkshire13fComparisonRow } from "@/lib/superinvestors/types";
import { SUPERINVESTOR_HOLDINGS_PAGE_SIZE } from "@/lib/superinvestors/superinvestors-holdings-page-size";

export type SuperinvestorHoldingsPageView = {
  /** Comparison with only the requested holdings page in `rows`. */
  comparison: Berkshire13fComparisonPayload;
  /** Full book for allocation donut (top-N weights). */
  allocationRows: Berkshire13fComparisonRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export function parseSuperinvestorHoldingsPage(raw: string | undefined | null): number {
  const n = Number.parseInt(String(raw ?? "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** Slice holdings for SSR — keeps header stats / soldOut on full comparison metadata. */
export function paginateSuperinvestorHoldingsComparison(
  comparison: Berkshire13fComparisonPayload,
  pageIn: number,
  pageSize = SUPERINVESTOR_HOLDINGS_PAGE_SIZE,
): SuperinvestorHoldingsPageView {
  const totalCount = comparison.positionCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, pageIn), totalPages);
  const start = (page - 1) * pageSize;
  const allocationRows = comparison.rows;
  const rows = comparison.rows.slice(start, start + pageSize);

  return {
    comparison: { ...comparison, rows },
    allocationRows,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}
