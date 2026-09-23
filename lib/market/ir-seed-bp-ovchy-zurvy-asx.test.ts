import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ASX_KNOWN_QUARTER_DOCS, isAsxIrPdf, isAsxRejected } from "./ir-seed-asx-match.ts";
import { BP_KNOWN_QUARTER_DOCS, isBpIrPdf, isBpRejected } from "./ir-seed-bp-match.ts";
import { OVCHY_KNOWN_QUARTER_DOCS, isOvchyIrPdf } from "./ir-seed-ovchy-match.ts";
import { ZURVY_KNOWN_QUARTER_DOCS, isZurvyIrPdf } from "./ir-seed-zurvy-match.ts";

test("BP/OVCHY/ZURVY/ASX catalogs cover Q1 2022 → Q2 2026", () => {
  assert.equal(Object.keys(BP_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(OVCHY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ZURVY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ASX_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(BP_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /bp\.com\/api\/files/);
  assert.match(OVCHY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /ocbc\.com\/iwov-resources/);
  assert.match(ASX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /media-aseholdco\.todayir\.com/);
});

test("BP/OVCHY/ASX green; ZURVY Q1/Q3 slides null", () => {
  assert.ok(BP_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(BP_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(OVCHY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(ASX_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(ZURVY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides, null);
  assert.ok(ZURVY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
  assert.ok(ZURVY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
});

test("IR PDF proxy + direct PDF cover BP/OVCHY/ZURVY/ASX hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(BP_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(OVCHY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ZURVY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ASX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(BP_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isBpIrPdf(BP_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isOvchyIrPdf(OVCHY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isZurvyIrPdf(ZURVY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isAsxIrPdf(ASX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("reject transcript / annual report noise", () => {
  assert.equal(isBpRejected("https://www.bp.com/api/files/x/bp-transcript.pdf"), true);
  assert.equal(isAsxRejected("https://media-aseholdco.todayir.com/foo_transcript_en.pdf"), true);
});
