import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ATLKY_KNOWN_QUARTER_DOCS, isAtlkyIrPdf } from "./ir-seed-atlky-match.ts";
import { ENLAY_KNOWN_QUARTER_DOCS, isEnlayIrPdf } from "./ir-seed-enlay-match.ts";
import { IBN_KNOWN_QUARTER_DOCS, isIbnIrPdf, isIbnRejected } from "./ir-seed-ibn-match.ts";

test("IBN/ENLAY/ATLKY catalogs cover Q1 2022 → latest", () => {
  assert.equal(Object.keys(IBN_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ENLAY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ATLKY_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(IBN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /icici\.bank\.in/);
  assert.match(ATLKY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /atlascopcogroup\.com/);
});

test("IBN/ATLKY green pairs; ENLAY mostly green", () => {
  for (const [lab, docs] of Object.entries(IBN_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(ATLKY_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.ok(ENLAY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(ENLAY_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(ENLAY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
});

test("IR PDF proxy + matchers cover IBN/ENLAY/ATLKY hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(IBN_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ENLAY_KNOWN_QUARTER_DOCS["Q1 2022"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ATLKY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(ATLKY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIbnIrPdf(IBN_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isEnlayIrPdf(ENLAY_KNOWN_QUARTER_DOCS["Q1 2022"]!.slides!), true);
  assert.equal(isAtlkyIrPdf(ATLKY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("IBN date path not false-positive 10-Q reject", () => {
  const u = IBN_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!;
  assert.equal(isIbnRejected(u), false);
  assert.equal(isIbnIrPdf(u), true);
});
