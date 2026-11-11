import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listEarningsTranscripts } from "@/lib/market/earnings-transcript";
import { EARNINGS_TRANSCRIPT_CATALOG, findEarningsTranscriptRef } from "@/lib/market/earnings-transcript-catalog";

describe("earnings-transcript-catalog", () => {
  it("lists exactly the transcripts the fixture modules ship", () => {
    for (const ticker of ["NVDA", "AAPL", "GOOGL", "MSFT"]) {
      const fixtures = listEarningsTranscripts(ticker)
        .map((t) => `${t.fiscalPeriodLabel}|${t.eventDateYmd}`)
        .sort();
      const catalog = EARNINGS_TRANSCRIPT_CATALOG.filter((e) => e.ticker === ticker)
        .map((e) => `${e.fiscalPeriodLabel}|${e.eventDateYmd}`)
        .sort();
      assert.deepEqual(catalog, fixtures, ticker);
    }
  });

  it("lazy-loads the matching transcript", async () => {
    const ref = findEarningsTranscriptRef("NVDA", { fiscalPeriodLabel: "Q2 FY2027", reportDateYmd: null, reported: true });
    assert.ok(ref);
    const transcript = await ref.load();
    assert.equal(transcript.fiscalPeriodLabel, "Q2 2027");
    assert.ok(transcript.paragraphs.length > 0);
  });

  it("matches GOOG to Alphabet and skips unreported quarters", () => {
    assert.ok(findEarningsTranscriptRef("GOOG", { fiscalPeriodLabel: "Q1 2026", reportDateYmd: null, reported: true }));
    assert.equal(
      findEarningsTranscriptRef("NVDA", { fiscalPeriodLabel: "Q2 2027", reportDateYmd: null, reported: false }),
      null,
    );
  });
});
