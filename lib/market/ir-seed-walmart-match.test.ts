import assert from "node:assert/strict";
import test from "node:test";

import type { StockEarningsHistoryRow } from "./stock-earnings-types.ts";
import {
  parseWmtDocKeyFromUrl,
  pickBestWmtDocKeyForRow,
  scoreWmtDocKeyForRow,
  wmtKeyFromReportSeason,
  type WmtDocKey,
} from "./ir-seed-walmart-match.ts";

function row(partial: Partial<StockEarningsHistoryRow>): StockEarningsHistoryRow {
  return {
    reportDateYmd: null,
    fiscalPeriodEndYmd: null,
    fiscalPeriodLabel: null,
    reported: true,
    epsActual: null,
    epsEstimate: null,
    epsSurprisePct: null,
    revenueActualUsd: null,
    revenueEstimateUsd: null,
    revenueSurprisePct: null,
    revenueActualDisplay: null,
    revenueEstimateDisplay: null,
    postReport1dChangePct: null,
    secSlidesUrl: null,
    secFilingsUrl: null,
    ...partial,
  };
}

const IR_KEYS: WmtDocKey[] = [
  { fy: 2027, fq: 2 },
  { fy: 2027, fq: 1 },
  { fy: 2026, fq: 4 },
  { fy: 2026, fq: 3 },
  { fy: 2026, fq: 2 },
  { fy: 2026, fq: 1 },
  { fy: 2025, fq: 4 },
  { fy: 2025, fq: 3 },
  { fy: 2024, fq: 4 },
];

test("parses Walmart presentation filenames", () => {
  assert.deepEqual(
    parseWmtDocKeyFromUrl(
      "https://stock.walmart.com/_assets/x/presentation/Earnings+Presentation+%28FY27+Q2%29.pdf",
    ),
    { fy: 2027, fq: 2 },
  );
  assert.deepEqual(
    parseWmtDocKeyFromUrl("https://stock.walmart.com/x/Earnings-Presentation-FY25-Q3.pdf"),
    { fy: 2025, fq: 3 },
  );
});

test("report season maps Aug 29 2026 → FY27 Q2", () => {
  assert.deepEqual(wmtKeyFromReportSeason("2026-08-29"), { fy: 2027, fq: 2 });
});

test("Q2 '26 Aug 29 picks FY27 Q2 over calendar FY26 Q2", () => {
  const r = row({
    reportDateYmd: "2026-08-29",
    fiscalPeriodLabel: "Q2 2026",
    fiscalPeriodEndYmd: "2026-08-01",
  });
  const best = pickBestWmtDocKeyForRow(r, IR_KEYS);
  assert.ok(best);
  assert.deepEqual(best.key, { fy: 2027, fq: 2 });
  assert.ok(best.score >= 70);
  // Calendar label alone must not beat report/period signals for FY26 Q2
  const wrong = scoreWmtDocKeyForRow(r, { fy: 2026, fq: 2 });
  assert.ok(best.score > wrong.score);
});

test("Q4 '24 Mar 15 picks FY25 Q4", () => {
  const r = row({
    reportDateYmd: "2025-03-15",
    fiscalPeriodLabel: "Q4 2024",
    fiscalPeriodEndYmd: "2025-01-31",
  });
  const best = pickBestWmtDocKeyForRow(r, IR_KEYS);
  assert.ok(best);
  assert.deepEqual(best.key, { fy: 2025, fq: 4 });
});

test("report date alone is enough for Q3 Dec", () => {
  const r = row({ reportDateYmd: "2025-12-03", fiscalPeriodLabel: "Q3 2026" });
  const best = pickBestWmtDocKeyForRow(r, IR_KEYS);
  assert.ok(best);
  assert.deepEqual(best.key, { fy: 2026, fq: 3 });
});
