import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CDNS_KNOWN_QUARTER_DOCS, isCdnsIrPdf } from "./ir-seed-cdns-match.ts";
import { DASH_KNOWN_QUARTER_DOCS, isDashIrPdf } from "./ir-seed-dash-match.ts";
import { EPD_KNOWN_QUARTER_DOCS, isEpdIrPdf } from "./ir-seed-epd-match.ts";

test("DASH yellow; CDNS green; EPD yellow catalogs", () => {
  assert.equal(Object.keys(DASH_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(DASH_KNOWN_QUARTER_DOCS["Q4 2024"]?.slides);
  assert.ok(DASH_KNOWN_QUARTER_DOCS["Q4 2024"]?.filings);
  assert.equal(Object.keys(CDNS_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(CDNS_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(CDNS_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(EPD_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(EPD_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(EPD_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover DASH/CDNS/EPD hosts", () => {
  const dash = DASH_KNOWN_QUARTER_DOCS["Q4 2024"]!;
  const cdns = CDNS_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const epd = EPD_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isDashIrPdf(dash.slides), true);
  assert.equal(isCdnsIrPdf(cdns.slides), true);
  assert.equal(isEpdIrPdf(epd.slides), true);
  assert.equal(isDirectEarningsPdfUrl(dash.filings), true);
  assert.equal(isDirectEarningsPdfUrl(cdns.filings), true);
  assert.equal(isDirectEarningsPdfUrl(epd.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(dash.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(cdns.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(epd.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(epd.filings!), true);
});
