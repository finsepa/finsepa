import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { AAGIY_KNOWN_QUARTER_DOCS, isAagiyIrPdf, isAagiyRejected } from "./ir-seed-aagiy-match.ts";
import { APP_KNOWN_QUARTER_DOCS, isAppIrPdf, isAppRejected } from "./ir-seed-app-match.ts";
import { GSK_KNOWN_QUARTER_DOCS, isGskIrPdf } from "./ir-seed-gsk-match.ts";
import { SNY_KNOWN_QUARTER_DOCS, isSnyIrPdf } from "./ir-seed-sny-match.ts";

test("APP/GSK/AAGIY/SNY catalogs cover Q1 2022 → latest", () => {
  assert.equal(Object.keys(APP_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(GSK_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(AAGIY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(SNY_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(APP_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /165405286/);
  assert.match(GSK_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /gsk\.com/);
  assert.match(AAGIY_KNOWN_QUARTER_DOCS["Q2 2022"]?.slides ?? "", /aia\.com/);
  assert.match(SNY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /sanofi\.com/);
});

test("APP/GSK green pairs; AAGIY semi-annual; SNY mostly green", () => {
  for (const [lab, docs] of Object.entries(APP_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(GSK_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.ok(AAGIY_KNOWN_QUARTER_DOCS["Q2 2022"]?.slides);
  assert.ok(AAGIY_KNOWN_QUARTER_DOCS["Q4 2022"]?.filings);
  assert.equal(AAGIY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  for (const [lab, docs] of Object.entries(SNY_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
});

test("IR PDF proxy + direct PDF cover APP/GSK/AAGIY/SNY hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(APP_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(GSK_KNOWN_QUARTER_DOCS["Q1 2022"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(AAGIY_KNOWN_QUARTER_DOCS["Q2 2022"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(SNY_KNOWN_QUARTER_DOCS["Q1 2022"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(APP_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isAppIrPdf(APP_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isGskIrPdf(GSK_KNOWN_QUARTER_DOCS["Q1 2022"]!.slides!), true);
  assert.equal(isAagiyIrPdf(AAGIY_KNOWN_QUARTER_DOCS["Q2 2022"]!.filings!), true);
  assert.equal(isSnyIrPdf(SNY_KNOWN_QUARTER_DOCS["Q1 2022"]!.slides!), true);
});

test("reject transcript noise", () => {
  assert.equal(isAppRejected("https://s21.q4cdn.com/165405286/x/transcript.pdf"), true);
  assert.equal(isAagiyRejected("https://www.aia.com/x/new-business-highlights.pdf"), true);
});
