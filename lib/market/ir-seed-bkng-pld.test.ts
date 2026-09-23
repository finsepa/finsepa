import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  BKNG_KNOWN_QUARTER_DOCS,
  isBkngIrPdf,
  isBkngRejected,
} from "./ir-seed-bkng-match.ts";
import {
  PLD_KNOWN_QUARTER_DOCS,
  isPldIrPdf,
  isPldRejected,
} from "./ir-seed-pld-match.ts";

test("BKNG/PLD catalogs span 18 quarters (Q1 2022 → Q2 2026)", () => {
  assert.equal(Object.keys(BKNG_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(PLD_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(BKNG_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /383369491/);
  assert.match(PLD_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /prologis/);
});

test("BKNG older quarters may be filings-only; PLD is slides-only", () => {
  assert.equal(BKNG_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(BKNG_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings?.includes("/383369491/"));
  for (const docs of Object.values(PLD_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.filings, null);
    assert.ok(docs.slides?.includes("supplemental_financial_report_pdf"));
  }
});

test("IR PDF proxy allowlist covers BKNG q4cdn and PLD cloudfront", () => {
  assert.equal(
    isIrPdfProxyUrlAllowed(BKNG_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!),
    true,
  );
  assert.equal(
    isIrPdfProxyUrlAllowed(PLD_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!),
    true,
  );
});

test("reject 10-Q / transcript / prepared remarks; keep earnings PDFs", () => {
  assert.equal(
    isBkngRejected(
      "https://s25.q4cdn.com/383369491/files/doc_financials/2023/q2/BKNG-Q2-10Q.pdf",
    ),
    true,
  );
  assert.equal(
    isBkngRejected(
      "https://s25.q4cdn.com/383369491/files/doc_financials/2026/q2/BKNG-Q2-2026-Earnings-Call-Transcript.pdf",
    ),
    true,
  );
  assert.equal(isBkngRejected(BKNG_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isBkngIrPdf(BKNG_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(
    isDirectEarningsPdfUrl(BKNG_KNOWN_QUARTER_DOCS["Q1 2024"]!.filings!),
    true,
  );

  assert.equal(
    isPldRejected(
      "https://d1io3yog0oux5.cloudfront.net/_0a55db7b115b9b5a5f02debaa95eb7af/prologis/db/2346/23537/supplemental_financial_report_pdf/PLD-Q1-10Q.pdf",
    ),
    true,
  );
  assert.equal(isPldRejected(PLD_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isPldIrPdf(PLD_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});
