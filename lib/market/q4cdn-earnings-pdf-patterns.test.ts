import assert from "node:assert/strict";
import test from "node:test";

import { earningsPdfHrefMatchesQuarterLabels } from "./gcs-web-earnings-presentations.ts";
import { filterQ4CdnPdfLinksForQuarter } from "./q4cdn-earnings-pdf-patterns.ts";

test("quarter PDF filter requires year — does not reuse Q4_2026 on every Q4-ish row", () => {
  const q4Fy26 = "https://filecache.investorroom.com/x/Q4_2026_slides_full_final.pdf";
  const q2Fy26Margin =
    "https://investors.coca-colacompany.com/x/Q2%2726+Margin+Analysis+Schedule.pdf";
  const inDir = "https://s25.q4cdn.com/1/files/doc_financials/2026/q2/deck.pdf";
  const mastercard = "https://s25.q4cdn.com/1/files/doc_financials/2026/q2/2Q26-Mastercard-Earnings-Presentation.pdf";

  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([q4Fy26], 4, 2026), [q4Fy26]);
  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([q4Fy26], 2, 2026), []);
  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([q4Fy26], 4, 2025), []);
  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([q2Fy26Margin], 2, 2026), [q2Fy26Margin]);
  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([q2Fy26Margin], 2, 2025), []);
  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([inDir], 2, 2026), [inDir]);
  assert.deepEqual(filterQ4CdnPdfLinksForQuarter([mastercard], 2, 2026), [mastercard]);
});

test("filename quarter must match the row label", () => {
  const q4 = "https://filecache.investorroom.com/x/Q4_2026_slides_full_final.pdf";
  const q4Filing = "https://filecache.investorroom.com/x/LRCX_Exhibit_99.1_Q4_2022.pdf";
  assert.equal(earningsPdfHrefMatchesQuarterLabels(q4, ["Q2 2026"]), false);
  assert.equal(earningsPdfHrefMatchesQuarterLabels(q4, ["Q4 2026"]), true);
  assert.equal(earningsPdfHrefMatchesQuarterLabels(q4Filing, ["Q4 2022"]), true);
});
