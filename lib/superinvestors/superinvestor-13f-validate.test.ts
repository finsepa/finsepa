import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPERINVESTOR_WEIGHT_SUM_TOLERANCE_PCT,
  validateSuperinvestorComparison,
} from "./superinvestor-13f-validate.ts";
import { slimSuperinvestorProfileForSnapshot } from "./superinvestor-13f-snapshot-slim.ts";
import { SUPERINVESTOR_SLUG_CIK } from "./superinvestor-slug-cik.ts";
import type {
  Berkshire13fComparisonPayload,
  Berkshire13fComparisonRow,
  Superinvestor13fProfilePageData,
} from "./types.ts";

function row(
  partial: Partial<Berkshire13fComparisonRow> &
    Pick<Berkshire13fComparisonRow, "companyName" | "valueUsd" | "weight">,
): Berkshire13fComparisonRow {
  return {
    cusip: null,
    ticker: null,
    shares: null,
    previousShares: null,
    sharesDelta: null,
    sharesChangePct: null,
    status: "unchanged",
    ...partial,
  };
}

function baseComparison(
  overrides: Partial<Berkshire13fComparisonPayload> = {},
): Berkshire13fComparisonPayload {
  return {
    filerDisplayName: "Test Filer",
    cik: "0001067983",
    source: "edgar",
    hasPriorFiling: true,
    current: {
      accessionNumber: "0001234567-26-000001",
      filingDate: "2026-05-15",
      reportDate: "2026-03-31",
    },
    previous: {
      accessionNumber: "0001234567-25-000099",
      filingDate: "2026-02-14",
      reportDate: "2025-12-31",
    },
    totalValueUsd: 1_000_000,
    previousTotalValueUsd: 900_000,
    positionCount: 2,
    rows: [
      row({
        companyName: "Apple Inc",
        ticker: "AAPL",
        cusip: "037833100",
        valueUsd: 600_000,
        weight: 60,
        shares: 1000,
      }),
      row({
        companyName: "Microsoft Corp",
        ticker: "MSFT",
        cusip: "594918104",
        valueUsd: 400_000,
        weight: 40,
        shares: 500,
        status: "add",
      }),
    ],
    soldOut: [],
    ...overrides,
  };
}

test("weights ≈100% pass validation and portfolio value is computed", () => {
  const v = validateSuperinvestorComparison(baseComparison());
  assert.equal(v.ok, true);
  assert.equal(v.holdingCount, 2);
  assert.equal(v.portfolioValueUsd, 1_000_000);
  assert.ok(Math.abs(v.weightSum - 100) <= SUPERINVESTOR_WEIGHT_SUM_TOLERANCE_PCT);
  assert.equal(v.unresolvedTickerCount, 0);
  assert.equal(v.duplicateKeyCount, 0);
});

test("weights materially off 100% fail validation", () => {
  const v = validateSuperinvestorComparison(
    baseComparison({
      rows: [
        row({
          companyName: "Apple Inc",
          ticker: "AAPL",
          cusip: "037833100",
          valueUsd: 600_000,
          weight: 60,
        }),
        row({
          companyName: "Microsoft Corp",
          ticker: "MSFT",
          cusip: "594918104",
          valueUsd: 400_000,
          weight: 35,
        }),
      ],
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.startsWith("weight_sum_out_of_tolerance")));
});

test("duplicate holdings fail validation", () => {
  const a = row({
    companyName: "Apple Inc",
    ticker: "AAPL",
    cusip: "037833100",
    valueUsd: 500_000,
    weight: 50,
  });
  const v = validateSuperinvestorComparison(baseComparison({ rows: [a, { ...a }] }));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.startsWith("duplicate_holdings")));
});

test("unresolved tickers are counted but do not alone fail validation", () => {
  const v = validateSuperinvestorComparison(
    baseComparison({
      rows: [
        row({
          companyName: "Mystery Co",
          ticker: null,
          cusip: "999999999",
          valueUsd: 1_000_000,
          weight: 100,
        }),
      ],
    }),
  );
  assert.equal(v.ok, true);
  assert.equal(v.unresolvedTickerCount, 1);
});

test("slimSuperinvestorProfileForSnapshot drops price fields when oversized", () => {
  const fatTx = Array.from({ length: 400 }, (_, i) => ({
    kind: "buy" as const,
    companyName: `Issuer ${i}`,
    ticker: `T${i}`,
    cusip: `C${String(i).padStart(8, "0")}`,
    quarterLabel: "Q1 2026",
    reportDate: "2026-03-31",
    sharesChangePct: 1,
    sharesDelta: 1,
    avgClosingPriceUsd: 12.34,
    priceRangeLowUsd: 10,
    priceRangeHighUsd: 15,
    portfolioWeightChangePct: 0.1,
  }));

  const page: Superinvestor13fProfilePageData = {
    comparison: baseComparison(),
    transactions: {
      filerDisplayName: "Test",
      cik: "0001067983",
      source: "edgar",
      quarters: [
        {
          quarterLabel: "Q1 2026",
          reportDate: "2026-03-31",
          filingDate: "2026-05-15",
          transactions: fatTx,
        },
      ],
    },
  };

  const slim = slimSuperinvestorProfileForSnapshot(page, 50_000);
  assert.ok(JSON.stringify(slim).length < JSON.stringify(page).length);
  const first = slim.transactions.quarters[0]?.transactions[0];
  if (first && slim.transactions.quarters[0]!.transactions.length > 0) {
    assert.equal(first.avgClosingPriceUsd, null);
  }
});

test("every manager slug has a CIK mapping entry (coverage precondition)", () => {
  const registrySlugs = Object.keys(SUPERINVESTOR_SLUG_CIK);
  assert.equal(registrySlugs.length, 18);
  for (const slug of registrySlugs) {
    assert.ok(/^\d{10}$/.test(SUPERINVESTOR_SLUG_CIK[slug]!), `bad CIK for ${slug}`);
  }
});
