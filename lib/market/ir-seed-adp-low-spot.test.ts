import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ADP_KNOWN_QUARTER_DOCS, isAdpIrPdf, isAdpRejected } from "./ir-seed-adp-match.ts";
import { LOW_KNOWN_QUARTER_DOCS, isLowIrPdf } from "./ir-seed-low-match.ts";
import { SPOT_KNOWN_QUARTER_DOCS, isSpotIrPdf, isSpotRejected } from "./ir-seed-spot-match.ts";

test("ADP/LOW/SPOT catalogs cover Q1 2022 → latest", () => {
  assert.equal(Object.keys(ADP_KNOWN_QUARTER_DOCS).length, 20);
  assert.equal(Object.keys(LOW_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(SPOT_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(ADP_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides ?? "", /887941133/);
  assert.match(LOW_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /lowes\.com/);
  assert.match(SPOT_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /175625835/);
});

test("ADP green pairs; LOW filings-only; SPOT slides-only", () => {
  assert.ok(ADP_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(ADP_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(LOW_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(LOW_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.ok(SPOT_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.equal(SPOT_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings, null);
});

test("IR PDF proxy + direct PDF cover ADP/LOW/SPOT hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(ADP_KNOWN_QUARTER_DOCS["Q4 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(LOW_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(SPOT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(ADP_KNOWN_QUARTER_DOCS["Q4 2026"]!.filings!), true);
  assert.equal(isAdpIrPdf(ADP_KNOWN_QUARTER_DOCS["Q4 2026"]!.slides!), true);
  assert.equal(isLowIrPdf(LOW_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isSpotIrPdf(SPOT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("reject transcript / financial statements", () => {
  assert.equal(isAdpRejected("https://s205.q4cdn.com/887941133/x/transcript.pdf"), true);
  assert.equal(isSpotRejected("https://s29.q4cdn.com/175625835/files/Financial-Statements.pdf"), true);
});
