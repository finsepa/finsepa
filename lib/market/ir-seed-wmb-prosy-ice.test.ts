import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ICE_KNOWN_QUARTER_DOCS, isIceIrPdf } from "./ir-seed-ice-match.ts";
import { PROSY_KNOWN_QUARTER_DOCS, isProsyIrPdf } from "./ir-seed-prosy-match.ts";
import { WMB_KNOWN_QUARTER_DOCS, isWmbIrPdf } from "./ir-seed-wmb-match.ts";

test("WMB/PROSY/ICE yellow catalogs", () => {
  assert.equal(Object.keys(WMB_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(WMB_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(WMB_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(WMB_KNOWN_QUARTER_DOCS["Q4 2025"]?.slides, null);
  assert.equal(Object.keys(PROSY_KNOWN_QUARTER_DOCS).length, 20);
  assert.ok(PROSY_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides);
  assert.ok(PROSY_KNOWN_QUARTER_DOCS["Q4 2026"]?.filings);
  assert.equal(PROSY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.equal(Object.keys(ICE_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(ICE_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(ICE_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.ok(ICE_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
});

test("IR PDF proxy + matchers cover WMB/PROSY/ICE hosts", () => {
  const wmb = WMB_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const prosy = PROSY_KNOWN_QUARTER_DOCS["Q4 2026"]!;
  const ice = ICE_KNOWN_QUARTER_DOCS["Q1 2026"]!;
  assert.equal(isWmbIrPdf(wmb.slides), true);
  assert.equal(isProsyIrPdf(prosy.slides), true);
  assert.equal(isIceIrPdf(ice.slides), true);
  assert.equal(isDirectEarningsPdfUrl(wmb.filings), true);
  assert.equal(isDirectEarningsPdfUrl(prosy.filings), true);
  assert.equal(isDirectEarningsPdfUrl(ice.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(wmb.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(prosy.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ice.filings!), true);
});
