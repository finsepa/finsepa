import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ARZGY_KNOWN_QUARTER_DOCS, isArzgyIrPdf } from "./ir-seed-arzgy-match.ts";
import { CTAS_KNOWN_QUARTER_DOCS, isCtasIrPdf } from "./ir-seed-ctas-match.ts";

test("CTAS yellow filings-only; ARZGY yellow half-year catalogs", () => {
  assert.equal(Object.keys(CTAS_KNOWN_QUARTER_DOCS).length, 20);
  assert.equal(CTAS_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(CTAS_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(Object.keys(ARZGY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(ARZGY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(ARZGY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(ARZGY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover CTAS/ARZGY hosts", () => {
  const ctas = CTAS_KNOWN_QUARTER_DOCS["Q4 2026"] || CTAS_KNOWN_QUARTER_DOCS["Q3 2026"] || CTAS_KNOWN_QUARTER_DOCS["Q1 2022"]!;
  const arz = ARZGY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isCtasIrPdf(ctas.filings), true);
  assert.equal(isArzgyIrPdf(arz.slides), true);
  assert.equal(isDirectEarningsPdfUrl(ctas.filings), true);
  assert.equal(isDirectEarningsPdfUrl(arz.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(ctas.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(arz.slides!), true);
});
