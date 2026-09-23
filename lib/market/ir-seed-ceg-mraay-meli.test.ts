import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CEG_KNOWN_QUARTER_DOCS, isCegIrPdf } from "./ir-seed-ceg-match.ts";
import { MELI_KNOWN_QUARTER_DOCS, isMeliIrPdf } from "./ir-seed-meli-match.ts";
import { MRAAY_KNOWN_QUARTER_DOCS, isMraayIrPdf } from "./ir-seed-mraay-match.ts";

test("MRAAY green March FY; CEG/MELI yellow catalogs", () => {
  assert.equal(Object.keys(MRAAY_KNOWN_QUARTER_DOCS).length, 21);
  assert.ok(MRAAY_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides);
  assert.ok(MRAAY_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings);
  assert.equal(Object.keys(CEG_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(CEG_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.equal(CEG_KNOWN_QUARTER_DOCS["Q4 2025"]?.slides, null);
  assert.ok(CEG_KNOWN_QUARTER_DOCS["Q4 2025"]?.filings);
  assert.ok(MELI_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(MELI_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(MELI_KNOWN_QUARTER_DOCS["Q2 2022"]?.slides);
});

test("IR PDF proxy + matchers cover CEG/MRAAY/MELI hosts", () => {
  const ceg = CEG_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const mraay = MRAAY_KNOWN_QUARTER_DOCS["Q1 2027"]!;
  const meli = MELI_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const cegNode = CEG_KNOWN_QUARTER_DOCS["Q4 2023"]!.filings!;
  assert.equal(isCegIrPdf(ceg.slides), true);
  assert.equal(isCegIrPdf(cegNode), true);
  assert.equal(isMraayIrPdf(mraay.slides), true);
  assert.equal(isMeliIrPdf(meli.filings), true);
  assert.equal(isDirectEarningsPdfUrl(ceg.slides), true);
  assert.equal(isDirectEarningsPdfUrl(cegNode), true);
  assert.equal(isDirectEarningsPdfUrl(mraay.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(ceg.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(mraay.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(meli.filings!), true);
});
