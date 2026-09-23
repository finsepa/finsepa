import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getEarningsTranscript,
  hasEarningsTranscript,
  listEarningsTranscripts,
} from "./earnings-transcript.ts";

describe("msft-earnings-transcript", () => {
  test("MSFT has six recent quarters with IR audio", () => {
    const list = listEarningsTranscripts("MSFT");
    assert.equal(list.length, 6);
    assert.deepEqual(
      list.map((t) => t.fiscalPeriodLabel),
      ["Q4 2026", "Q3 2026", "Q2 2026", "Q1 2026", "Q4 2025", "Q3 2025"],
    );
    for (const t of list) {
      assert.equal(t.ticker, "MSFT");
      assert.ok(t.paragraphs.length >= 30, t.fiscalPeriodLabel);
      assert.ok(t.audioUrl?.includes("/earnings-audio/MSFT/"));
      assert.ok(
        t.sourceUrl?.includes("microsoft.com") || t.sourceUrl?.includes("cdn-dynmedia"),
        t.fiscalPeriodLabel,
      );
      assert.ok(t.speakers.some((s) => /Nadella/i.test(s.name)));
      assert.ok(t.durationSec && t.durationSec > 600, `${t.fiscalPeriodLabel} duration`);
    }
  });

  test("matches Q4 2026 by fiscal label and report date", () => {
    assert.equal(
      hasEarningsTranscript("MSFT", {
        fiscalPeriodLabel: "Q4 2026",
        reportDateYmd: null,
        reported: true,
      }),
      true,
    );
    const byDate = getEarningsTranscript("MSFT", {
      fiscalPeriodLabel: null,
      reportDateYmd: "2026-07-29",
      reported: true,
    });
    assert.ok(byDate);
    assert.equal(byDate.fiscalPeriodLabel, "Q4 2026");
  });
});
