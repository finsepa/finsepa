import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { BCS_KNOWN_QUARTER_DOCS, isBcsIrPdf } from "./ir-seed-bcs-match.ts";
import { BN_KNOWN_QUARTER_DOCS, isBnIrPdf } from "./ir-seed-bn-match.ts";
import { GLNCY_KNOWN_QUARTER_DOCS, isGlncyIrPdf } from "./ir-seed-glncy-match.ts";
import { MHVIY_KNOWN_QUARTER_DOCS, isMhviyIrPdf } from "./ir-seed-mhviy-match.ts";

test("MHVIY/BCS green; GLNCY/BN yellow catalogs", () => {
  assert.equal(Object.keys(MHVIY_KNOWN_QUARTER_DOCS).length, 17);
  assert.ok(MHVIY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
  assert.ok(MHVIY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
  assert.equal(Object.keys(BCS_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(BCS_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(BCS_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(GLNCY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(GLNCY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(GLNCY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.equal(Object.keys(BN_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(BN_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(BN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(BN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover GLNCY/MHVIY/BCS/BN hosts", () => {
  const gln = GLNCY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const mhi = MHVIY_KNOWN_QUARTER_DOCS["Q1 2026"]!;
  const bcs = BCS_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const bn = BN_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isGlncyIrPdf(gln.slides), true);
  assert.equal(isMhviyIrPdf(mhi.slides), true);
  assert.equal(isBcsIrPdf(bcs.slides), true);
  assert.equal(isBnIrPdf(bn.slides), true);
  assert.equal(isDirectEarningsPdfUrl(gln.filings), true);
  assert.equal(isDirectEarningsPdfUrl(mhi.filings), true);
  assert.equal(isDirectEarningsPdfUrl(bcs.filings), true);
  assert.equal(isDirectEarningsPdfUrl(bn.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(gln.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(mhi.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(bcs.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(bn.filings!), true);
});
