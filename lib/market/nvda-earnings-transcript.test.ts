import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getNvdaEarningsTranscript,
  hasNvdaEarningsTranscript,
  isNvdaTranscriptTicker,
  listNvdaEarningsTranscripts,
} from "./nvda-earnings-transcript.ts";

describe("nvda-earnings-transcript", () => {
  test("only NVDA is enabled", () => {
    assert.equal(isNvdaTranscriptTicker("NVDA"), true);
    assert.equal(isNvdaTranscriptTicker("nvda"), true);
    assert.equal(isNvdaTranscriptTicker("AAPL"), false);
  });

  test("ships all IR-published quarters (FY2026+)", () => {
    const all = listNvdaEarningsTranscripts();
    assert.equal(all.length, 6);
    assert.deepEqual(
      all.map((t) => t.fiscalPeriodLabel),
      ["Q2 2027", "Q1 2027", "Q4 2026", "Q3 2026", "Q2 2026", "Q1 2026"],
    );
    for (const t of all) {
      assert.ok(t.paragraphs.length >= 30, t.fiscalPeriodLabel);
      assert.ok(t.sourceUrl?.includes("q4cdn.com") || t.sourceUrl?.includes("investor.nvidia.com"));
      assert.ok(t.speakers.some((s) => s.name === "Jensen Huang" || s.name === "Colette Kress"));
    }
  });

  test("matches Q2 2027 by fiscal label", () => {
    const row = {
      fiscalPeriodLabel: "Q2 2027",
      reportDateYmd: null as string | null,
      reported: true,
    };
    assert.equal(hasNvdaEarningsTranscript("NVDA", row), true);
    const t = getNvdaEarningsTranscript("NVDA", row);
    assert.ok(t);
    assert.equal(t.fiscalPeriodLabel, "Q2 2027");
  });

  test("matches each quarter by report date", () => {
    for (const t of listNvdaEarningsTranscripts()) {
      assert.equal(
        hasNvdaEarningsTranscript("NVDA", {
          fiscalPeriodLabel: null,
          reportDateYmd: t.eventDateYmd,
          reported: true,
        }),
        true,
        t.eventDateYmd,
      );
    }
  });

  test("skips unreleased or other tickers / quarters", () => {
    assert.equal(
      hasNvdaEarningsTranscript("NVDA", {
        fiscalPeriodLabel: "Q2 2027",
        reportDateYmd: "2026-08-26",
        reported: false,
      }),
      false,
    );
    assert.equal(
      hasNvdaEarningsTranscript("AAPL", {
        fiscalPeriodLabel: "Q2 2027",
        reportDateYmd: "2026-08-26",
        reported: true,
      }),
      false,
    );
    assert.equal(
      hasNvdaEarningsTranscript("NVDA", {
        fiscalPeriodLabel: "Q4 2025",
        reportDateYmd: "2025-02-26",
        reported: true,
      }),
      false,
    );
  });
});
