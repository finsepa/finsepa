import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { AXAHY_KNOWN_QUARTER_DOCS, isAxahyIrPdf } from "./ir-seed-axahy-match.ts";
import { HOOD_KNOWN_QUARTER_DOCS, isHoodIrPdf, isHoodRejected } from "./ir-seed-hood-match.ts";
import { SBUX_KNOWN_QUARTER_DOCS, isSbuxIrPdf, isSbuxRejected } from "./ir-seed-sbux-match.ts";

test("SBUX/HOOD/AXAHY catalogs cover Q1 2022 → latest", () => {
  assert.ok(Object.keys(SBUX_KNOWN_QUARTER_DOCS).length >= 18);
  assert.equal(Object.keys(HOOD_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(Object.keys(AXAHY_KNOWN_QUARTER_DOCS).length >= 18);
  assert.match(SBUX_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /q4cdn\.com\/326826266/);
  assert.match(HOOD_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /static-files\/f5aa8c24/);
  assert.match(AXAHY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /prismic\.io/);
});

test("HOOD green pairs; SBUX yellow early-2022; AXAHY semi-annual", () => {
  for (const [lab, docs] of Object.entries(HOOD_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.equal(SBUX_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(SBUX_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(SBUX_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides);
  assert.equal(AXAHY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides, null);
  assert.equal(AXAHY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings, null);
  assert.ok(AXAHY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(AXAHY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + direct PDF cover SBUX/HOOD/AXAHY hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(SBUX_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(HOOD_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(AXAHY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(SBUX_KNOWN_QUARTER_DOCS["Q3 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(HOOD_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isSbuxIrPdf(SBUX_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isHoodIrPdf(HOOD_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isAxahyIrPdf(AXAHY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("reject transcript / investor-day noise", () => {
  assert.equal(isSbuxRejected("https://s203.q4cdn.com/326826266/files/doc_financials/2026/q3/Q3-FY26-SBUX-Transcript.pdf"), true);
  assert.equal(isHoodRejected("https://investors.robinhood.com/static-files/x", "Q2 2026 Transcript"), true);
});
