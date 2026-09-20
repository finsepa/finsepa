import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getEarningsTranscript,
  hasEarningsTranscript,
  listEarningsTranscripts,
} from "./earnings-transcript.ts";

describe("googl-earnings-transcript", () => {
  test("GOOGL and GOOG share six recent quarters", () => {
    const googl = listEarningsTranscripts("GOOGL");
    const goog = listEarningsTranscripts("GOOG");
    assert.equal(googl.length, 6);
    assert.equal(goog.length, 6);
    assert.deepEqual(
      googl.map((t) => t.fiscalPeriodLabel),
      ["Q2 2026", "Q1 2026", "Q4 2025", "Q3 2025", "Q2 2025", "Q1 2025"],
    );
    for (const t of googl) {
      assert.equal(t.ticker, "GOOGL");
      assert.ok(t.paragraphs.length >= 30, t.fiscalPeriodLabel);
      assert.ok(t.audioUrl?.includes("/earnings-audio/GOOGL/"));
      assert.ok(
        t.sourceUrl?.includes("q4cdn.com") || t.sourceUrl?.includes("abc.xyz"),
        t.fiscalPeriodLabel,
      );
      assert.ok(t.speakers.some((s) => /Sundar|Pichai/i.test(s.name)));
    }
  });

  test("matches Q2 2026 by fiscal label and report date", () => {
    assert.equal(
      hasEarningsTranscript("GOOGL", {
        fiscalPeriodLabel: "Q2 2026",
        reportDateYmd: null,
        reported: true,
      }),
      true,
    );
    const byDate = getEarningsTranscript("GOOGL", {
      fiscalPeriodLabel: null,
      reportDateYmd: "2026-07-22",
      reported: true,
    });
    assert.ok(byDate);
    assert.equal(byDate.fiscalPeriodLabel, "Q2 2026");
  });
});
