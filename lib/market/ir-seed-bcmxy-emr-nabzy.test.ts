import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { BCMXY_KNOWN_QUARTER_DOCS, isBcmxyIrPdf } from "./ir-seed-bcmxy-match.ts";
import { EMR_KNOWN_QUARTER_DOCS, isEmrIrPdf } from "./ir-seed-emr-match.ts";
import { NABZY_KNOWN_QUARTER_DOCS, isNabzyIrPdf } from "./ir-seed-nabzy-match.ts";

test("EMR green Sept FY; BCMXY/NABZY yellow catalogs", () => {
  assert.equal(Object.keys(EMR_KNOWN_QUARTER_DOCS).length, 19);
  assert.ok(EMR_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides);
  assert.ok(EMR_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings);
  assert.equal(Object.keys(BCMXY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(BCMXY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(BCMXY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(NABZY_KNOWN_QUARTER_DOCS).length, 19);
  assert.equal(NABZY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(NABZY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(NABZY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover BCMXY/EMR/NABZY hosts", () => {
  const bcm = BCMXY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!;
  const emr = EMR_KNOWN_QUARTER_DOCS["Q3 2026"]!;
  const nab = NABZY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isBcmxyIrPdf(bcm), true);
  assert.equal(isEmrIrPdf(emr.slides), true);
  assert.equal(isNabzyIrPdf(nab.slides), true);
  assert.equal(isDirectEarningsPdfUrl(bcm), true);
  assert.equal(isDirectEarningsPdfUrl(emr.filings), true);
  assert.equal(isDirectEarningsPdfUrl(nab.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(bcm), true);
  assert.equal(isIrPdfProxyUrlAllowed(emr.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(nab.slides!), true);
});
