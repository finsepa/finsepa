import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { SU_KNOWN_QUARTER_DOCS, isSuIrPdf } from "./ir-seed-su-match.ts";

test("SU yellow: filings Q1'23→Q2'26; slides sparse; 2022 red", () => {
  assert.equal(Object.keys(SU_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(SU_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings, null);
  assert.ok(SU_KNOWN_QUARTER_DOCS["Q1 2023"]?.filings);
  assert.equal(SU_KNOWN_QUARTER_DOCS["Q1 2023"]?.slides, null);
  assert.ok(SU_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(SU_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matcher cover SU hosts", () => {
  const su = SU_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isSuIrPdf(su.slides), true);
  assert.equal(isSuIrPdf(su.filings), true);
  assert.equal(isDirectEarningsPdfUrl(su.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(su.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(su.filings!), true);
});
