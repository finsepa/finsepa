import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { AMT_KNOWN_QUARTER_DOCS, isAmtIrPdf } from "./ir-seed-amt-match.ts";
import { BE_KNOWN_QUARTER_DOCS, isBeIrPdf } from "./ir-seed-be-match.ts";
import { CMCSA_KNOWN_QUARTER_DOCS, isCmcsaIrPdf } from "./ir-seed-cmcsa-match.ts";

test("AMT/BE green; CMCSA yellow catalogs", () => {
  assert.equal(Object.keys(AMT_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(AMT_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(AMT_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(BE_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(BE_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(BE_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(CMCSA_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(CMCSA_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides || CMCSA_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover AMT/BE/CMCSA hosts", () => {
  const amt = AMT_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const be = BE_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const cmcsa =
    CMCSA_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides || CMCSA_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings
      ? CMCSA_KNOWN_QUARTER_DOCS["Q2 2026"]!
      : CMCSA_KNOWN_QUARTER_DOCS["Q4 2025"]!;
  assert.equal(isAmtIrPdf(amt.slides), true);
  assert.equal(isBeIrPdf(be.slides), true);
  const cmcsaUrl = cmcsa.slides || cmcsa.filings;
  assert.equal(isCmcsaIrPdf(cmcsaUrl), true);
  assert.equal(isDirectEarningsPdfUrl(amt.filings), true);
  assert.equal(isDirectEarningsPdfUrl(be.filings), true);
  assert.equal(isDirectEarningsPdfUrl(cmcsaUrl), true);
  assert.equal(isIrPdfProxyUrlAllowed(amt.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(be.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(cmcsaUrl!), true);
});
