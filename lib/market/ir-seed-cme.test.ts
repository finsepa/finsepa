import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CME_KNOWN_QUARTER_DOCS, isCmeIrPdf } from "./ir-seed-cme-match.ts";

test("CME catalog covers Q1 2022 → Q2 2026 green pairs", () => {
  assert.equal(Object.keys(CME_KNOWN_QUARTER_DOCS).length, 18);
  for (const [lab, docs] of Object.entries(CME_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.match(CME_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /investor\.cmegroup\.com\/static-files\//);
});

test("IR PDF proxy + matcher cover CME static-files", () => {
  const slides = CME_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!;
  const filings = CME_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!;
  assert.equal(isCmeIrPdf(slides), true);
  assert.equal(isCmeIrPdf(filings), true);
  assert.equal(isDirectEarningsPdfUrl(slides), true);
  assert.equal(isIrPdfProxyUrlAllowed(slides), true);
  assert.equal(isIrPdfProxyUrlAllowed(filings), true);
});
