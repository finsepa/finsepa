import type { Berkshire13fComparisonPayload } from "@/lib/superinvestors/types";
import type { Superinvestor13fFilingHead } from "@/lib/superinvestors/superinvestor-13f-freshness";
import { thirteenFilingHeadCacheKey } from "@/lib/superinvestors/superinvestor-13f-freshness";

/** Drop in-process dev memo rows for 13F loaders (5-minute TTL in development). */
export function clearSuperinvestor13fDevMemoCaches(): void {
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: Promise<unknown> }>;
  };
  const memo = g.__finsepaDevMemo;
  if (!memo) return;
  for (const key of [...memo.keys()]) {
    if (key.startsWith("13f:")) memo.delete(key);
  }
}

export function filingHeadMatchesComparison(
  head: Superinvestor13fFilingHead | null,
  comparison: Berkshire13fComparisonPayload,
): boolean {
  if (!head?.accession?.trim()) return comparison.source !== "edgar";
  const headKey = thirteenFilingHeadCacheKey(head);
  const curAcc = comparison.current.accessionNumber?.trim().replace(/-/g, "").toLowerCase();
  if (curAcc && curAcc === headKey) return true;
  const headDate = head.filingDate?.trim();
  const curDate = comparison.current.filingDate?.trim();
  return Boolean(headDate && curDate && headDate === curDate);
}
