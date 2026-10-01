import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ANZGY_KNOWN_QUARTER_DOCS, isAnzgyIrPdf } from "./ir-seed-anzgy-match.ts";
import { HPE_KNOWN_QUARTER_DOCS, isHpeIrPdf } from "./ir-seed-hpe-match.ts";
import { WUXAY_KNOWN_QUARTER_DOCS, isWuxayIrPdf } from "./ir-seed-wuxay-match.ts";

test("HPE/WUXAY green; ANZGY yellow catalogs", () => {
  assert.equal(Object.keys(HPE_KNOWN_QUARTER_DOCS).length, 19);
  assert.ok(HPE_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides);
  assert.ok(HPE_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings);
  assert.equal(Object.keys(WUXAY_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(WUXAY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(WUXAY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(ANZGY_KNOWN_QUARTER_DOCS).length, 19);
  assert.equal(ANZGY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(ANZGY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(ANZGY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover ANZGY/HPE/WUXAY hosts", () => {
  const anz = ANZGY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const hpe = HPE_KNOWN_QUARTER_DOCS["Q3 2026"]!;
  const wux = WUXAY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isAnzgyIrPdf(anz.slides), true);
  assert.equal(isHpeIrPdf(hpe.slides), true);
  assert.equal(isWuxayIrPdf(wux.slides), true);
  assert.equal(isDirectEarningsPdfUrl(anz.filings), true);
  assert.equal(isDirectEarningsPdfUrl(hpe.filings), true);
  assert.equal(isDirectEarningsPdfUrl(wux.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(anz.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(hpe.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(wux.filings!), true);
});
