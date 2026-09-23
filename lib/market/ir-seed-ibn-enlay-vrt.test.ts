import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ENLAY_KNOWN_QUARTER_DOCS, isEnlayIrPdf } from "./ir-seed-enlay-match.ts";
import { IBN_KNOWN_QUARTER_DOCS, isIbnIrPdf, isIbnRejected } from "./ir-seed-ibn-match.ts";
import { VRT_KNOWN_QUARTER_DOCS, isVrtIrPdf } from "./ir-seed-vrt-match.ts";

test("VRT/IBN/ENLAY catalogs present", () => {
  assert.equal(Object.keys(VRT_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(Object.keys(IBN_KNOWN_QUARTER_DOCS).length >= 18);
  assert.equal(Object.keys(ENLAY_KNOWN_QUARTER_DOCS).length, 18);
});

test("proxy + IR matchers cover VRT/IBN/ENLAY", () => {
  assert.equal(isIrPdfProxyUrlAllowed(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  const ibnSlides = Object.values(IBN_KNOWN_QUARTER_DOCS).find((d) => d.slides)?.slides!;
  const enlaySlides = Object.values(ENLAY_KNOWN_QUARTER_DOCS).find((d) => d.slides)?.slides!;
  assert.equal(isIrPdfProxyUrlAllowed(ibnSlides), true);
  assert.equal(isIrPdfProxyUrlAllowed(enlaySlides), true);
  assert.equal(isDirectEarningsPdfUrl(ibnSlides), true);
  assert.equal(isVrtIrPdf(VRT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIbnIrPdf(ibnSlides), true);
  assert.equal(isEnlayIrPdf(enlaySlides), true);
});

test("IBN date path not false-positive 10-Q reject", () => {
  const u =
    "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024-10-q2-2025-investor-presentation.pdf";
  assert.equal(isIbnRejected(u), false);
  assert.equal(isIbnIrPdf(u), true);
});
