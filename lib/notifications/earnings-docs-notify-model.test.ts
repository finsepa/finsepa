import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EARNINGS_REPORTS_KIND,
  EARNINGS_SLIDES_KIND,
  detectNewlyAvailableEarningsDocs,
  isRecentEarningsDocsReportDate,
} from "./earnings-docs-notify-model.ts";

describe("detectNewlyAvailableEarningsDocs", () => {
  const recent = "2026-09-10";

  it("emits slides when presentation first appears for a recent report", () => {
    const events = detectNewlyAvailableEarningsDocs({
      ticker: "AAPL",
      fiscalPeriodEndYmd: "2026-06-27",
      reportDateYmd: recent,
      priorSlides: null,
      nextSlides: "https://example.com/deck.pdf",
      priorEightK: null,
      nextEightK: null,
      priorForm10: null,
      nextForm10: null,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]!.kind, EARNINGS_SLIDES_KIND);
  });

  it("emits reports once when first of 8-K or 10-Q appears", () => {
    const events = detectNewlyAvailableEarningsDocs({
      ticker: "AAPL",
      fiscalPeriodEndYmd: "2026-06-27",
      reportDateYmd: recent,
      priorSlides: null,
      nextSlides: null,
      priorEightK: null,
      nextEightK: "https://sec.gov/8k.htm",
      priorForm10: null,
      nextForm10: null,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]!.kind, EARNINGS_REPORTS_KIND);
  });

  it("does not re-notify reports when the second SEC form arrives", () => {
    const events = detectNewlyAvailableEarningsDocs({
      ticker: "AAPL",
      fiscalPeriodEndYmd: "2026-06-27",
      reportDateYmd: recent,
      priorSlides: null,
      nextSlides: null,
      priorEightK: "https://sec.gov/8k.htm",
      nextEightK: "https://sec.gov/8k.htm",
      priorForm10: null,
      nextForm10: "https://sec.gov/10q.htm",
    });
    assert.equal(events.length, 0);
  });

  it("skips historical report dates", () => {
    assert.equal(isRecentEarningsDocsReportDate("2022-01-15", "2026-09-11"), false);
    const events = detectNewlyAvailableEarningsDocs({
      ticker: "AAPL",
      fiscalPeriodEndYmd: "2022-01-01",
      reportDateYmd: "2022-01-15",
      priorSlides: null,
      nextSlides: "https://example.com/deck.pdf",
      priorEightK: null,
      nextEightK: null,
      priorForm10: null,
      nextForm10: null,
    });
    assert.equal(events.length, 0);
  });
});
