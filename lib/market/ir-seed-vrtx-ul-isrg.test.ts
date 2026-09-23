import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  ISRG_KNOWN_QUARTER_DOCS,
  isIsrgIrPdf,
  isIsrgRejected,
} from "./ir-seed-isrg-match.ts";
import {
  UL_KNOWN_QUARTER_DOCS,
  isUlIrPdf,
  isUlRejected,
} from "./ir-seed-ul-match.ts";
import {
  VRTX_KNOWN_QUARTER_DOCS,
  isVrtxIrPdf,
  isVrtxRejected,
} from "./ir-seed-vrtx-match.ts";

test("VRTX/UL/ISRG catalogs span 18 quarters (Q1 2022 → Q2 2026)", () => {
  assert.equal(Object.keys(VRTX_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(UL_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ISRG_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(VRTX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /25a09e85/);
  assert.match(UL_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /unilever-q2-2026-results-presentation/);
  assert.match(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /76f7007b/);
});

test("VRTX is slides-only; ISRG has node/pdf filings; UL green from Q4’23", () => {
  for (const docs of Object.values(VRTX_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.filings, null);
    assert.ok(docs.slides?.includes("/static-files/"));
  }
  assert.match(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /\/node\/23231\/pdf/);
  assert.match(ISRG_KNOWN_QUARTER_DOCS["Q4 2025"]?.filings ?? "", /\/node\/22616\/pdf/);
  assert.equal(ISRG_KNOWN_QUARTER_DOCS["Q4 2025"]?.slides, null);
  assert.ok(ISRG_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
  assert.ok(UL_KNOWN_QUARTER_DOCS["Q4 2023"]?.slides);
  assert.ok(UL_KNOWN_QUARTER_DOCS["Q4 2023"]?.filings);
  assert.match(UL_KNOWN_QUARTER_DOCS["Q1 2023"]?.filings ?? "", /9beca798/);
  assert.equal(UL_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
});

test("IR PDF proxy allowlist covers VRTX/ISRG static-files, ISRG node/pdf, and Unilever /files", () => {
  assert.equal(isIrPdfProxyUrlAllowed(VRTX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(UL_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(UL_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(UL_KNOWN_QUARTER_DOCS["Q1 2023"]!.filings!), true);
});

test("reject 10-Q / transcript / tables; keep earnings PDFs", () => {
  assert.equal(
    isVrtxRejected(
      "https://investors.vrtx.com/static-files/2818df50-eee5-4e54-a9dc-ce0a8b447685",
      "Reconciliation of Reported to Revised GAAP",
    ),
    true,
  );
  assert.equal(isVrtxRejected(VRTX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isVrtxIrPdf(VRTX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(VRTX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);

  assert.equal(
    isIsrgRejected(
      "https://isrg.intuitive.com/static-files/6ea9f7b2-ca9a-4441-96e2-9c95729cdce2",
      "Q2 2026 Financial Data Tables",
    ),
    true,
  );
  assert.equal(isIsrgIrPdf(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIsrgIrPdf(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(ISRG_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);

  assert.equal(
    isUlRejected("https://www.unilever.com/files/unilever-q2-2026-transcript.pdf"),
    true,
  );
  assert.equal(isUlRejected(UL_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isUlIrPdf(UL_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isUlIrPdf(UL_KNOWN_QUARTER_DOCS["Q1 2023"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(UL_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});
