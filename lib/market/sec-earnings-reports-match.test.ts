import assert from "node:assert/strict";
import test from "node:test";

import {
  isTrustedEarningsAnnouncementYmd,
  itemsHas202,
  matchEarningsEightKHigh,
  matchEarningsEightKHighBeforeForm10,
  matchEarningsForm10High,
  resolveEarningsAnnouncementYmd,
  resolveEarningsEightKMatch,
  type SecSubmissionsFiling,
} from "./sec-earnings-reports-match.ts";
import { resolveSecEarningsCik } from "./sec-earnings-cik.ts";

function f(partial: Partial<SecSubmissionsFiling> & Pick<SecSubmissionsFiling, "form" | "filingDate">): SecSubmissionsFiling {
  return {
    reportDate: partial.reportDate ?? "",
    accessionNumber: partial.accessionNumber ?? "0000000000-00-000001",
    primaryDocument: partial.primaryDocument ?? "doc.htm",
    items: partial.items ?? "",
    ...partial,
    form: partial.form,
    filingDate: partial.filingDate,
  };
}

test("Item 2.02 detection ignores 12.02 / 2.01", () => {
  assert.equal(itemsHas202("2.02,9.01"), true);
  assert.equal(itemsHas202("8.01"), false);
  assert.equal(itemsHas202("5.07"), false);
  assert.equal(itemsHas202("7.01"), false);
  assert.equal(itemsHas202("2.01,9.01"), false);
});

test("8-K HIGH: unique Item 2.02 within 3 days of announcement", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2024-05-02", items: "2.02,9.01", accessionNumber: "aapl-8k" }),
    f({ form: "8-K", filingDate: "2024-04-20", items: "8.01", accessionNumber: "other" }),
  ];
  const hit = matchEarningsEightKHigh(filings, "2024-05-02");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "aapl-8k");
});

test("8-K never publishes date-only 8.01 / 5.07", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2024-03-15", items: "8.01" }),
    f({ form: "8-K", filingDate: "2024-06-07", items: "5.07" }),
  ];
  assert.equal(matchEarningsEightKHigh(filings, "2024-03-15").grade, "MISSING");
  assert.equal(matchEarningsEightKHigh(filings, "2024-06-07").grade, "MISSING");
});

test("8-K AMBIGUOUS: two Item 2.02 originals within 3 days", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2024-05-01", items: "2.02,9.01", accessionNumber: "a" }),
    f({ form: "8-K", filingDate: "2024-05-02", items: "2.02,9.01", accessionNumber: "b" }),
  ];
  assert.equal(matchEarningsEightKHigh(filings, "2024-05-02").grade, "AMBIGUOUS");
});

test("8-K prefers original over 8-K/A in the same window", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2024-05-02", items: "2.02,9.01", accessionNumber: "orig" }),
    f({ form: "8-K/A", filingDate: "2024-05-03", items: "2.02,9.01", accessionNumber: "amend" }),
  ];
  const hit = matchEarningsEightKHigh(filings, "2024-05-02");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "orig");
});

test("COST Q2 2026: March announcement does not attach May Q3 8-K", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2026-03-05", items: "2.02,9.01", accessionNumber: "q2" }),
    f({ form: "8-K", filingDate: "2026-05-28", items: "2.02,9.01", accessionNumber: "q3" }),
  ];
  const hit = matchEarningsEightKHigh(filings, "2026-03-05");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "q2");
  const wrongAnn = matchEarningsEightKHigh(filings, "2026-05-28");
  assert.equal(wrongAnn.grade, "HIGH");
  if (wrongAnn.grade === "HIGH") assert.equal(wrongAnn.pick.accessionNumber, "q3");
});

test("untrusted EODHD 10-Q file date: unique Item 2.02 before form-10 is HIGH (WMT/COST)", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2026-02-20", items: "2.02,9.01", accessionNumber: "wmt-earn", reportDate: "2026-02-20" }),
    f({ form: "8-K", filingDate: "2026-03-13", items: "8.01", accessionNumber: "other" }),
    f({ form: "10-K", filingDate: "2026-03-13", reportDate: "2026-01-31", accessionNumber: "wmt-10k" }),
  ];
  assert.equal(
    isTrustedEarningsAnnouncementYmd({
      announcementYmd: "2026-03-13",
      fiscalPeriodEndYmd: "2026-01-31",
      form10FilingYmd: "2026-03-13",
    }),
    false,
  );
  const hit = matchEarningsEightKHighBeforeForm10(filings, "2026-01-31", "2026-03-13");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "wmt-earn");
});

test("COST Q2 2026 bounded by Q2 10-Q filing does not take May Q3 8-K", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2026-03-05", items: "2.02,9.01", accessionNumber: "q2" }),
    f({ form: "8-K", filingDate: "2026-05-28", items: "2.02,9.01", accessionNumber: "q3" }),
    f({ form: "10-Q", filingDate: "2026-03-13", reportDate: "2026-02-15", accessionNumber: "q2-10q" }),
  ];
  const cal = new Map([
    ["2026-02-28", "2026-05-28"],
    ["2026-05-31", "2026-05-28"],
  ]);
  const hit = resolveEarningsEightKMatch(filings, {
    announcementYmd: "2026-05-28",
    fiscalPeriodEndYmd: "2026-02-28",
    form10FilingYmd: "2026-03-13",
    calendarByPeriodEnd: cal,
  });
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "q2");
});

test("two Item 2.02 8-Ks before form-10 filing are AMBIGUOUS", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2026-02-10", items: "2.02,9.01", accessionNumber: "a" }),
    f({ form: "8-K", filingDate: "2026-02-20", items: "2.02,9.01", accessionNumber: "b" }),
    f({ form: "10-Q", filingDate: "2026-03-01", reportDate: "2026-01-31", accessionNumber: "q" }),
  ];
  assert.equal(matchEarningsEightKHighBeforeForm10(filings, "2026-01-31", "2026-03-01").grade, "AMBIGUOUS");
});

test("trusted announcement still uses the 3-day rule, not the form-10 window", () => {
  const filings = [
    f({ form: "8-K", filingDate: "2024-05-02", items: "2.02,9.01", accessionNumber: "earn" }),
    f({ form: "8-K", filingDate: "2024-04-10", items: "2.02,9.01", accessionNumber: "early" }),
    f({ form: "10-Q", filingDate: "2024-05-20", reportDate: "2024-03-30", accessionNumber: "q" }),
  ];
  const hit = resolveEarningsEightKMatch(filings, {
    announcementYmd: "2024-05-02",
    fiscalPeriodEndYmd: "2024-03-31",
    form10FilingYmd: "2024-05-20",
  });
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "earn");
});

test("10-Q HIGH: unique reportDate within 7 days (AAPL Saturday close)", () => {
  const filings = [
    f({ form: "10-Q", filingDate: "2024-05-03", reportDate: "2024-03-30", accessionNumber: "q" }),
  ];
  const hit = matchEarningsForm10High(filings, "2024-03-31");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "q");
});

test("10-K wins when reportDate matches period end (Q4/FY from the filing, not the label)", () => {
  const filings = [
    f({ form: "10-K", filingDate: "2025-02-26", reportDate: "2025-01-26", accessionNumber: "k" }),
    f({ form: "10-Q", filingDate: "2024-11-20", reportDate: "2024-10-27", accessionNumber: "q" }),
  ];
  const hit = matchEarningsForm10High(filings, "2025-01-31");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") {
    assert.equal(hit.pick.form, "10-K");
    assert.equal(hit.pick.accessionNumber, "k");
  }
});

test("52-week ±28d unique 10-Q is HIGH (COST / PEP)", () => {
  const filings = [
    f({ form: "10-Q", filingDate: "2024-06-06", reportDate: "2024-05-12", accessionNumber: "cost-q3" }),
  ];
  const hit = matchEarningsForm10High(filings, "2024-05-31");
  assert.equal(hit.grade, "HIGH");
  if (hit.grade === "HIGH") assert.equal(hit.pick.accessionNumber, "cost-q3");
});

test("announcement prefers calendar report_date; rejects period-end-as-announcement", () => {
  assert.equal(
    resolveEarningsAnnouncementYmd({
      fiscalPeriodEndYmd: "2026-02-28",
      historyReportDateYmd: "2026-05-28",
      calendarReportDateYmd: "2026-03-05",
    }),
    "2026-03-05",
  );
  assert.equal(
    resolveEarningsAnnouncementYmd({
      fiscalPeriodEndYmd: "2024-03-31",
      historyReportDateYmd: "2024-03-31",
      calendarReportDateYmd: null,
    }),
    null,
  );
  assert.equal(
    resolveEarningsAnnouncementYmd({
      fiscalPeriodEndYmd: "2026-02-28",
      historyReportDateYmd: "2026-05-28",
      calendarReportDateYmd: null,
    }),
    null,
    "history date 89 days after period end is next quarter — not an announcement",
  );
  assert.equal(
    resolveEarningsAnnouncementYmd({
      fiscalPeriodEndYmd: "2026-02-28",
      historyReportDateYmd: "2026-05-28",
      calendarByPeriodEnd: new Map([
        ["2026-02-15", "2026-03-05"],
        ["2026-05-10", "2026-05-28"],
      ]),
    }),
    "2026-03-05",
    "COST Q2: month-end Finsepa period matches nearby calendar period end",
  );
  assert.equal(
    resolveEarningsAnnouncementYmd({
      fiscalPeriodEndYmd: "2026-02-28",
      historyReportDateYmd: "2026-05-28",
      calendarByPeriodEnd: new Map([["2026-02-28", "2026-05-28"]]),
    }),
    null,
    "calendar date 89 days after period end is rejected",
  );
});

test("XOM CIK override beats a wrong fundamentals CIK", () => {
  assert.equal(resolveSecEarningsCik("XOM", "0002115436"), "0000034088");
  assert.equal(resolveSecEarningsCik("AAPL", "320193"), "0000320193");
});
