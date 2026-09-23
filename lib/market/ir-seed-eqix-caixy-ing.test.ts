import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CAIXY_KNOWN_QUARTER_DOCS, isCaixyIrPdf, isCaixyRejected } from "./ir-seed-caixy-match.ts";
import { EQIX_KNOWN_QUARTER_DOCS, isEqixIrPdf, isEqixRejected } from "./ir-seed-eqix-match.ts";
import { ING_KNOWN_QUARTER_DOCS, isIngIrPdf } from "./ir-seed-ing-match.ts";

test("EQIX/CAIXY/ING catalogs cover Q1 2022 → latest", () => {
  assert.equal(Object.keys(EQIX_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(CAIXY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ING_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(EQIX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /equinix/i);
  assert.match(CAIXY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /caixabank\.com/);
  assert.match(ING_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /ing\.com/);
});

test("EQIX/CAIXY green pairs; ING mostly green", () => {
  for (const [lab, docs] of Object.entries(EQIX_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(CAIXY_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(ING_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
});

test("IR PDF proxy + direct PDF cover EQIX/CAIXY/ING hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(EQIX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(CAIXY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ING_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(EQIX_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isEqixIrPdf(EQIX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isCaixyIrPdf(CAIXY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIngIrPdf(ING_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});

test("reject transcript noise", () => {
  assert.equal(isEqixRejected("https://d1io3yog0oux5.cloudfront.net/equinix/x/transcript.pdf"), true);
  assert.equal(isCaixyRejected("https://www.caixabank.com/x/sustainability.pdf"), true);
});
