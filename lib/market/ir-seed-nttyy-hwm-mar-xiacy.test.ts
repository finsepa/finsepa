import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { HWM_KNOWN_QUARTER_DOCS, isHwmIrPdf } from "./ir-seed-hwm-match.ts";
import { MAR_KNOWN_QUARTER_DOCS, isMarIrPdf } from "./ir-seed-mar-match.ts";
import { NTTYY_KNOWN_QUARTER_DOCS, isNttyyIrPdf } from "./ir-seed-nttyy-match.ts";
import { XIACY_KNOWN_QUARTER_DOCS, isXiacyIrPdf } from "./ir-seed-xiacy-match.ts";

test("NTTYY/HWM/XIACY green; MAR filings-only yellow", () => {
  assert.equal(Object.keys(NTTYY_KNOWN_QUARTER_DOCS).length, 17);
  assert.equal(Object.keys(HWM_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(MAR_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(XIACY_KNOWN_QUARTER_DOCS).length, 18);
  for (const [lab, docs] of Object.entries(HWM_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(XIACY_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(MAR_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.slides, null, lab);
    assert.ok(docs.filings, lab);
  }
  assert.ok(NTTYY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
  assert.ok(NTTYY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
});

test("IR PDF proxy + matchers cover NTTYY/HWM/MAR/XIACY hosts", () => {
  const n = NTTYY_KNOWN_QUARTER_DOCS["Q1 2026"]!;
  const h = HWM_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const m = MAR_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const x = XIACY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isNttyyIrPdf(n.slides), true);
  assert.equal(isHwmIrPdf(h.filings), true);
  assert.equal(isMarIrPdf(m.filings), true);
  assert.equal(isXiacyIrPdf(x.slides), true);
  assert.equal(isDirectEarningsPdfUrl(n.slides), true);
  assert.equal(isDirectEarningsPdfUrl(m.filings), true);
  assert.equal(isDirectEarningsPdfUrl(x.slides), true);
  assert.equal(isIrPdfProxyUrlAllowed(n.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(h.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(m.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(x.filings!), true);
});
