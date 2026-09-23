import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { DUK_KNOWN_QUARTER_DOCS, isDukIrPdf } from "./ir-seed-duk-match.ts";
import { HCA_KNOWN_QUARTER_DOCS, isHcaIrPdf } from "./ir-seed-hca-match.ts";
import { SNHIY_KNOWN_QUARTER_DOCS, isSnhiyIrPdf } from "./ir-seed-snhiy-match.ts";

test("DUK green; HCA/SNHIY filings-only yellow", () => {
  assert.equal(Object.keys(DUK_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(HCA_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(SNHIY_KNOWN_QUARTER_DOCS).length, 18);
  for (const [lab, docs] of Object.entries(DUK_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(HCA_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.slides, null, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(SNHIY_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.slides, null, lab);
    assert.ok(docs.filings, lab);
    assert.match(docs.filings!, /^https:/);
  }
});

test("IR PDF proxy + matchers cover HCA/SNHIY/DUK hosts", () => {
  const duk = DUK_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const hca = HCA_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const sn = SNHIY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const snEarly = SNHIY_KNOWN_QUARTER_DOCS["Q1 2022"]!;
  assert.equal(isDukIrPdf(duk.slides), true);
  assert.equal(isHcaIrPdf(hca.filings), true);
  assert.equal(isSnhiyIrPdf(sn.filings), true);
  assert.equal(isSnhiyIrPdf(snEarly.filings), true);
  assert.equal(isDirectEarningsPdfUrl(duk.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(duk.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(hca.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(sn.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(snEarly.filings!), true);
});
