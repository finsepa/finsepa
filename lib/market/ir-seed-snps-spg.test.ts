import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { SNPS_KNOWN_QUARTER_DOCS, isSnpsIrPdf } from "./ir-seed-snps-match.ts";
import { SPG_KNOWN_QUARTER_DOCS, isSpgIrPdf } from "./ir-seed-spg-match.ts";

test("SPG green; SNPS yellow Oct FY catalogs", () => {
  assert.equal(Object.keys(SPG_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(SPG_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(SPG_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(SNPS_KNOWN_QUARTER_DOCS).length, 19);
  assert.ok(SNPS_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides);
  assert.equal(SNPS_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings, null);
  assert.ok(SNPS_KNOWN_QUARTER_DOCS["Q3 2022"]?.filings);
});

test("IR PDF proxy + matchers cover SNPS/SPG hosts", () => {
  const snps = SNPS_KNOWN_QUARTER_DOCS["Q3 2026"]!;
  const spg = SPG_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const spgNode = SPG_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!;
  assert.equal(isSnpsIrPdf(snps.slides), true);
  assert.equal(isSpgIrPdf(spg.slides), true);
  assert.equal(isSpgIrPdf(spgNode), true);
  assert.equal(isDirectEarningsPdfUrl(snps.slides), true);
  assert.equal(isDirectEarningsPdfUrl(spgNode), true);
  assert.equal(isIrPdfProxyUrlAllowed(snps.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(spg.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(spgNode), true);
});
