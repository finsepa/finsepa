import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { BAESY_KNOWN_QUARTER_DOCS, isBaesyIrPdf } from "./ir-seed-baesy-match.ts";
import { MCO_KNOWN_QUARTER_DOCS, isMcoIrPdf } from "./ir-seed-mco-match.ts";
import { UPS_KNOWN_QUARTER_DOCS, isUpsIrPdf } from "./ir-seed-ups-match.ts";

test("MCO/UPS green; BAESY yellow half-year catalogs", () => {
  assert.equal(Object.keys(MCO_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(MCO_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(MCO_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(UPS_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(UPS_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(UPS_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(BAESY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(BAESY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(BAESY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(BAESY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover MCO/UPS/BAESY hosts", () => {
  const mco = MCO_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const ups = UPS_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const bae = BAESY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isMcoIrPdf(mco.slides), true);
  assert.equal(isUpsIrPdf(ups.slides), true);
  assert.equal(isBaesyIrPdf(bae.slides), true);
  assert.equal(isDirectEarningsPdfUrl(mco.filings), true);
  assert.equal(isDirectEarningsPdfUrl(ups.filings), true);
  assert.equal(isDirectEarningsPdfUrl(bae.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(mco.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ups.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(bae.slides!), true);
});
