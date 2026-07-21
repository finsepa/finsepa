/**
 * Pure validation for Superinvestor 13F portfolio snapshots (Phase 1).
 * Fail ingest when weights diverge materially from 100% or structure is unusable.
 */

import type {
  Berkshire13fComparisonPayload,
  Berkshire13fComparisonRow,
  Superinvestor13fProfilePageData,
} from "@/lib/superinvestors/types";

/** Absolute percentage-point tolerance for Σ weights vs 100. */
export const SUPERINVESTOR_WEIGHT_SUM_TOLERANCE_PCT = 0.05;

export type Superinvestor13fValidationResult = {
  ok: boolean;
  holdingCount: number;
  portfolioValueUsd: number;
  weightSum: number;
  weightSumDeltaFrom100: number;
  unresolvedTickerCount: number;
  duplicateKeyCount: number;
  duplicateKeys: string[];
  errors: string[];
};

function holdingKey(row: Berkshire13fComparisonRow): string {
  if (row.cusip && row.cusip.length >= 6) return `CUSIP:${row.cusip.toUpperCase()}`;
  return `ISS:${row.companyName.trim().toUpperCase()}`;
}

export function validateSuperinvestorComparison(
  comparison: Berkshire13fComparisonPayload,
): Superinvestor13fValidationResult {
  const errors: string[] = [];
  const rows = comparison.rows ?? [];
  const holdingCount = rows.length;
  const portfolioValueUsd = rows.reduce((s, r) => s + (Number.isFinite(r.valueUsd) ? r.valueUsd : 0), 0);
  const weightSum = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  const weightSumDeltaFrom100 = weightSum - 100;
  const unresolvedTickerCount = rows.filter((r) => !r.ticker?.trim()).length;

  const seen = new Map<string, number>();
  for (const row of rows) {
    const k = holdingKey(row);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const duplicateKeys = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  const duplicateKeyCount = duplicateKeys.length;

  if (comparison.source === "unavailable") {
    errors.push("source_unavailable");
  }
  if (holdingCount <= 0 && comparison.source === "edgar") {
    errors.push("empty_holdings");
  }
  if (holdingCount > 0 && portfolioValueUsd <= 0) {
    errors.push("non_positive_portfolio_value");
  }
  if (holdingCount > 0 && Math.abs(weightSumDeltaFrom100) > SUPERINVESTOR_WEIGHT_SUM_TOLERANCE_PCT) {
    errors.push(
      `weight_sum_out_of_tolerance:${weightSum.toFixed(4)} (delta ${weightSumDeltaFrom100.toFixed(4)})`,
    );
  }
  if (duplicateKeyCount > 0) {
    errors.push(`duplicate_holdings:${duplicateKeyCount}`);
  }

  return {
    ok: errors.length === 0,
    holdingCount,
    portfolioValueUsd,
    weightSum,
    weightSumDeltaFrom100,
    unresolvedTickerCount,
    duplicateKeyCount,
    duplicateKeys: duplicateKeys.slice(0, 20),
    errors,
  };
}

export function validateSuperinvestorProfilePage(
  page: Superinvestor13fProfilePageData,
): Superinvestor13fValidationResult {
  return validateSuperinvestorComparison(page.comparison);
}
