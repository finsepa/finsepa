import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  TJX_KNOWN_QUARTER_DOCS,
  isTjxIrPdf,
  isTjxRejected,
} from "./ir-seed-tjx-match.ts";

test("TJX catalog is filings-only from Q4 2022 → Q2 2027", () => {
  assert.equal(Object.keys(TJX_KNOWN_QUARTER_DOCS).length, 19);
  assert.ok(TJX_KNOWN_QUARTER_DOCS["Q2 2027"]?.filings?.includes("2027"));
  assert.ok(TJX_KNOWN_QUARTER_DOCS["Q4 2022"]?.filings?.includes("2022"));
  for (const docs of Object.values(TJX_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.slides, null);
    assert.ok(docs.filings?.includes("earnings-press-release"));
  }
});

test("IR PDF proxy allowlist covers TJX docs DAM", () => {
  assert.equal(
    isIrPdfProxyUrlAllowed(TJX_KNOWN_QUARTER_DOCS["Q2 2027"]!.filings!),
    true,
  );
});

test("reject 10-Q / reconciliations; keep earnings press PDFs", () => {
  assert.equal(
    isTjxRejected(
      "https://www.tjx.com/docs/default-source/investor-docs/quarterly-results/tjx-second-quarter-fiscal-year-2027-form-10-q.pdf",
    ),
    true,
  );
  assert.equal(
    isTjxRejected(
      "https://www.tjx.com/docs/default-source/investor-docs/quarterly-results/tjx-second-quarter-fiscal-year-2027-reconciliations-of-financials.pdf",
    ),
    true,
  );
  assert.equal(isTjxRejected(TJX_KNOWN_QUARTER_DOCS["Q2 2027"]!.filings!), false);
  assert.equal(isTjxIrPdf(TJX_KNOWN_QUARTER_DOCS["Q2 2027"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(TJX_KNOWN_QUARTER_DOCS["Q2 2027"]!.filings!), true);
});
