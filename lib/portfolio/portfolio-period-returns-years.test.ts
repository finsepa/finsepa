import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  latestPeriodReturnYear,
  periodReturnBarLabelForYear,
  portfolioPeriodReturnYears,
} from "./portfolio-period-returns-years.ts";

describe("portfolioPeriodReturnYears", () => {
  it("lists newest year first and defaults to that year", () => {
    const years = portfolioPeriodReturnYears(
      [{ date: "2024-03-15" }, { date: "2025-01-02" }],
      new Date(2026, 8, 3),
    );
    assert.deepEqual(years, [2026, 2025, 2024]);
    assert.equal(latestPeriodReturnYear(years), 2026);
  });

  it("returns empty when there are no dated transactions", () => {
    assert.deepEqual(portfolioPeriodReturnYears([], new Date(2026, 8, 3)), []);
  });
});

describe("periodReturnBarLabelForYear", () => {
  it("drops the year from monthly / quarterly labels", () => {
    assert.equal(periodReturnBarLabelForYear("2026-03-01", "monthly"), "Mar");
    assert.equal(periodReturnBarLabelForYear("2026-04-01", "quarterly"), "Q2");
  });
});
