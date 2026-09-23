import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ITUB_KNOWN_QUARTER_DOCS, isItubIrPdf } from "./ir-seed-itub-match.ts";
import { KKR_KNOWN_QUARTER_DOCS, isKkrIrPdf } from "./ir-seed-kkr-match.ts";
import { MITSY_KNOWN_QUARTER_DOCS, isMitsyIrPdf } from "./ir-seed-mitsy-match.ts";

test("MITSY green March FY through Q1 2027", () => {
  assert.equal(Object.keys(MITSY_KNOWN_QUARTER_DOCS).length, 21);
  assert.ok(MITSY_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides);
  assert.ok(MITSY_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings);
  for (const [lab, docs] of Object.entries(MITSY_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
});

test("KKR mostly green; ITUB sparse yellow", () => {
  assert.equal(Object.keys(KKR_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(KKR_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(KKR_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(KKR_KNOWN_QUARTER_DOCS["Q3 2022"]?.slides, null);
  assert.ok(KKR_KNOWN_QUARTER_DOCS["Q3 2022"]?.filings);
  assert.ok(ITUB_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
  assert.ok(ITUB_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
  assert.equal(ITUB_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.equal(ITUB_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings, null);
});

test("IR PDF proxy + matchers cover MITSY/ITUB/KKR hosts", () => {
  const m = MITSY_KNOWN_QUARTER_DOCS["Q1 2027"]!;
  const k = KKR_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const i = ITUB_KNOWN_QUARTER_DOCS["Q1 2026"]!;
  assert.equal(isMitsyIrPdf(m.slides), true);
  assert.equal(isKkrIrPdf(k.filings), true);
  assert.equal(isItubIrPdf(i.slides), true);
  assert.equal(isDirectEarningsPdfUrl(m.slides), true);
  assert.equal(isDirectEarningsPdfUrl(i.slides), true);
  assert.equal(isIrPdfProxyUrlAllowed(m.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(k.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(i.filings!), true);
});
