import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyEarningsReleaseSnapshotsToPayload } from "./earnings-release-snapshot-apply.ts";
import type { StockEarningsHistoryRow, StockEarningsTabPayload } from "./stock-earnings-types.ts";

function baseRow(partial: Partial<StockEarningsHistoryRow> & Pick<StockEarningsHistoryRow, "fiscalPeriodEndYmd">): StockEarningsHistoryRow {
  return {
    fiscalPeriodEndYmd: partial.fiscalPeriodEndYmd,
    fiscalPeriodLabel: partial.fiscalPeriodLabel ?? "Q1 2026",
    reportDateDisplay: partial.reportDateDisplay ?? null,
    reportDateYmd: partial.reportDateYmd ?? null,
    epsEstimateDisplay: partial.epsEstimateDisplay ?? "5.00",
    epsActualDisplay: partial.epsActualDisplay ?? null,
    surprisePct: partial.surprisePct ?? null,
    surpriseDisplay: partial.surpriseDisplay ?? null,
    revenueEstimateDisplay: null,
    revenueActualDisplay: null,
    reported: partial.reported ?? false,
    revenueEstimateUsd: null,
    revenueActualUsd: null,
    epsEstimateRaw: partial.epsEstimateRaw ?? 5,
    epsActualRaw: partial.epsActualRaw ?? null,
    secSlidesUrl: null,
    secFilingsUrl: null,
    eightKUrl: null,
    form10Url: null,
    form10Kind: null,
    postReport1dPct: null,
  };
}

function basePayload(history: StockEarningsHistoryRow[]): StockEarningsTabPayload {
  return {
    ticker: "ADBE",
    upcoming: {
      reportDateDisplay: "Mar 12, 2026",
      reportDateYmd: "2026-03-12",
      timing: "amc",
      timingShortLabel: "AMC",
      timingPhrase: "After market",
      fiscalPeriodLabel: "Q1 2026",
      epsEstimateDisplay: "5.00",
      revenueEstimateDisplay: null,
    },
    history,
    estimatesChart: {
      quarterly: [
        {
          sortKey: "2026-02-28",
          label: "Q1 2026",
          revenueEstimateUsd: null,
          revenueActualUsd: null,
          epsEstimate: 5,
          epsActual: null,
          reported: false,
        },
      ],
      annual: [],
    },
    documentHub: { irWebsite: null, cik: null, companyWebsite: null },
    lastPrice: 400,
  };
}

describe("applyEarningsReleaseSnapshotsToPayload", () => {
  it("patches unreported history + chart from calendar snapshot", () => {
    const payload = basePayload([
      baseRow({
        fiscalPeriodEndYmd: "2026-02-28",
        fiscalPeriodLabel: "Q1 2026",
        reported: false,
        reportDateYmd: null,
      }),
    ]);
    const next = applyEarningsReleaseSnapshotsToPayload(payload, [
      {
        ticker: "ADBE",
        fiscal_period_end: "2026-02-28",
        report_date: "2026-03-12",
        eps_actual: 5.29,
        eps_estimate: 5.05,
        surprise_pct: 4.75,
      },
    ]);
    assert.equal(next.history[0]!.reported, true);
    assert.equal(next.history[0]!.reportDateYmd, "2026-03-12");
    assert.equal(next.history[0]!.epsActualRaw, 5.29);
    assert.equal(next.history[0]!.reportDateDisplay, "Mar 12, 2026");
    assert.equal(next.estimatesChart?.quarterly[0]!.epsActual, 5.29);
    assert.equal(next.estimatesChart?.quarterly[0]!.reported, true);
    assert.equal(next.upcoming, null);
  });

  it("inserts a history row when fiscal period is missing from sticky payload", () => {
    const payload = basePayload([]);
    const next = applyEarningsReleaseSnapshotsToPayload(payload, [
      {
        ticker: "ADBE",
        fiscal_period_end: "2026-02-28",
        report_date: "2026-03-12",
        eps_actual: 5.29,
        eps_estimate: 5.05,
        surprise_pct: null,
      },
    ]);
    assert.equal(next.history.length, 1);
    assert.equal(next.history[0]!.epsActualRaw, 5.29);
    assert.equal(next.history[0]!.reported, true);
  });
});
