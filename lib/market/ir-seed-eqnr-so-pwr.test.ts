import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { EQNR_KNOWN_QUARTER_DOCS, isEqnrIrPdf, isEqnrRejected } from "./ir-seed-eqnr-match.ts";
import { PWR_KNOWN_QUARTER_DOCS, isPwrIrPdf } from "./ir-seed-pwr-match.ts";
import { SO_KNOWN_QUARTER_DOCS, isSoIrPdf } from "./ir-seed-so-match.ts";

test("EQNR/SO/PWR catalogs cover Q1 2022 → latest", () => {
  assert.equal(Object.keys(EQNR_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(SO_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(PWR_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(EQNR_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /sanity\.io/);
  assert.match(SO_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /273397814/);
  assert.match(PWR_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /quantaservices/);
});

test("EQNR/SO green pairs; PWR mostly green", () => {
  for (const [lab, docs] of Object.entries(EQNR_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(SO_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.ok(PWR_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(PWR_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(PWR_KNOWN_QUARTER_DOCS["Q1 2023"]?.slides, null);
  assert.ok(PWR_KNOWN_QUARTER_DOCS["Q1 2023"]?.filings);
});

test("IR PDF proxy + direct PDF cover EQNR/SO/PWR hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(EQNR_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(SO_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PWR_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(EQNR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isEqnrIrPdf(EQNR_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isSoIrPdf(SO_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isPwrIrPdf(PWR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});

test("reject transcript noise", () => {
  assert.equal(isEqnrRejected("https://cdn.sanity.io/files/h61q9gi9/global/transcript.pdf"), true);
});
