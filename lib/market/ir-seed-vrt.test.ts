import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { VRT_KNOWN_QUARTER_DOCS, isVrtIrPdf, isVrtRejected } from "./ir-seed-vrt-match.ts";

test("VRT catalog covers Q1 2022 → Q2 2026", () => {
  assert.equal(Object.keys(VRT_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /554782763/);
  assert.match(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /Earnings-Release/i);
});

test("VRT mostly green; Q4 2024 slides-only", () => {
  assert.ok(VRT_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(VRT_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(VRT_KNOWN_QUARTER_DOCS["Q4 2024"]?.slides);
  assert.equal(VRT_KNOWN_QUARTER_DOCS["Q4 2024"]?.filings, null);
});

test("IR PDF proxy + direct PDF cover VRT host", () => {
  assert.equal(isIrPdfProxyUrlAllowed(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isVrtIrPdf(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("reject transcript noise", () => {
  assert.equal(isVrtRejected("https://s205.q4cdn.com/554782763/x/transcript.pdf"), true);
});
