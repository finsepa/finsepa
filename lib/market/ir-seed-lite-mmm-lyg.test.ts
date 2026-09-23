import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { LITE_KNOWN_QUARTER_DOCS, isLiteIrPdf } from "./ir-seed-lite-match.ts";
import { LYG_KNOWN_QUARTER_DOCS, isLygIrPdf } from "./ir-seed-lyg-match.ts";
import { MMM_KNOWN_QUARTER_DOCS, isMmmIrPdf } from "./ir-seed-mmm-match.ts";

test("LYG green; LITE/MMM yellow catalogs", () => {
  assert.equal(Object.keys(LYG_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(LYG_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(LYG_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(LITE_KNOWN_QUARTER_DOCS).length, 20);
  assert.ok(LITE_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides);
  assert.ok(LITE_KNOWN_QUARTER_DOCS["Q4 2026"]?.filings);
  assert.equal(LITE_KNOWN_QUARTER_DOCS["Q2 2022"]?.filings, null);
  assert.equal(Object.keys(MMM_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(MMM_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(MMM_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(MMM_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings, null);
});

test("IR PDF proxy + matchers cover LITE/MMM/LYG hosts", () => {
  const lite = LITE_KNOWN_QUARTER_DOCS["Q4 2026"]!;
  const mmm = MMM_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const lyg = LYG_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isLiteIrPdf(lite.slides), true);
  assert.equal(isMmmIrPdf(mmm.slides), true);
  assert.equal(isLygIrPdf(lyg.slides), true);
  assert.equal(isDirectEarningsPdfUrl(lite.filings), true);
  assert.equal(isDirectEarningsPdfUrl(mmm.filings), true);
  assert.equal(isDirectEarningsPdfUrl(lyg.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(lite.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(mmm.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(lyg.slides!), true);
});
