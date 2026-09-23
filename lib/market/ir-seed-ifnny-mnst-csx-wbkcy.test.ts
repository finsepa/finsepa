import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CSX_KNOWN_QUARTER_DOCS, isCsxIrPdf } from "./ir-seed-csx-match.ts";
import { IFNNY_KNOWN_QUARTER_DOCS, isIfnnyIrPdf } from "./ir-seed-ifnny-match.ts";
import { MNST_KNOWN_QUARTER_DOCS, isMnstIrPdf } from "./ir-seed-mnst-match.ts";
import { WBKCY_KNOWN_QUARTER_DOCS, isWbkcyIrPdf } from "./ir-seed-wbkcy-match.ts";

test("CSX green; IFNNY/MNST/WBKCY yellow catalogs", () => {
  assert.equal(Object.keys(CSX_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(CSX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(CSX_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(IFNNY_KNOWN_QUARTER_DOCS).length, 19);
  assert.ok(IFNNY_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides);
  assert.equal(Object.keys(MNST_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(MNST_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(MNST_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(WBKCY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(WBKCY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(WBKCY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(WBKCY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover IFNNY/MNST/CSX/WBKCY hosts", () => {
  const ifn = IFNNY_KNOWN_QUARTER_DOCS["Q1 2022"]!;
  const mnst = MNST_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!;
  const csx = CSX_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const wbk = WBKCY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isIfnnyIrPdf(ifn.slides), true);
  assert.equal(isIfnnyIrPdf(ifn.filings), true);
  assert.equal(isMnstIrPdf(mnst), true);
  assert.equal(isCsxIrPdf(csx.slides), true);
  assert.equal(isWbkcyIrPdf(wbk.slides), true);
  assert.equal(isDirectEarningsPdfUrl(ifn.slides), true);
  assert.equal(isDirectEarningsPdfUrl(mnst), true);
  assert.equal(isDirectEarningsPdfUrl(csx.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(ifn.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(mnst), true);
  assert.equal(isIrPdfProxyUrlAllowed(csx.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(wbk.filings!), true);
});
