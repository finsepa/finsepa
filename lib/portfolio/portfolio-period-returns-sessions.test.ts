import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePeriodReturnSessionMarks } from "./portfolio-period-returns-sessions.ts";

describe("resolvePeriodReturnSessionMarks — inception year", () => {
  it("uses prior-year session when SPY history includes Dec 2024", () => {
    const bench = [
      { date: "2024-12-31" },
      { date: "2025-01-02" },
      { date: "2025-06-30" },
      { date: "2025-12-31" },
      { date: "2026-07-21" },
    ];
    const marks = resolvePeriodReturnSessionMarks({
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      asOfYmd: "2026-07-22",
      firstTxYmd: "2025-03-15",
      benchSorted: bench,
    });
    assert.ok(marks);
    assert.equal(marks!.d0, "2024-12-31");
    assert.equal(marks!.d1, "2025-12-31");
  });

  it("snaps to day-before-first-tx when prior-year bars are missing (old bug)", () => {
    // Bars only from first trade — previously made annual 2025 entirely null.
    const bench = [
      { date: "2025-03-17" },
      { date: "2025-06-30" },
      { date: "2025-12-31" },
      { date: "2026-07-21" },
    ];
    const marks = resolvePeriodReturnSessionMarks({
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      asOfYmd: "2026-07-22",
      firstTxYmd: "2025-03-15",
      benchSorted: bench,
    });
    assert.ok(marks);
    assert.equal(marks!.d0, "2025-03-14");
    assert.equal(marks!.d1, "2025-12-31");
  });

  it("returns null for calendar years entirely before first activity", () => {
    const marks = resolvePeriodReturnSessionMarks({
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
      asOfYmd: "2026-07-22",
      firstTxYmd: "2025-03-15",
      benchSorted: [{ date: "2024-12-31" }, { date: "2025-12-31" }],
    });
    assert.equal(marks, null);
  });
});
