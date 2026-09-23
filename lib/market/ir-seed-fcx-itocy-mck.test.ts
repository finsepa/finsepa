import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { FCX_KNOWN_QUARTER_DOCS, isFcxIrPdf, isFcxRejected } from "./ir-seed-fcx-match.ts";
import { ITOCY_KNOWN_QUARTER_DOCS, isItocyIrPdf } from "./ir-seed-itocy-match.ts";
import { MCK_KNOWN_QUARTER_DOCS, isMckIrPdf } from "./ir-seed-mck-match.ts";

test("FCX/ITOCY/MCK catalogs cover Q1 2022 → latest", () => {
  assert.equal(Object.keys(FCX_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(Object.keys(ITOCY_KNOWN_QUARTER_DOCS).length >= 18);
  assert.ok(Object.keys(MCK_KNOWN_QUARTER_DOCS).length >= 18);
  assert.match(FCX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /529358580/);
  assert.match(ITOCY_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? "", /itochu\.co\.jp/);
  assert.match(MCK_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? "", /128197368/);
});

test("FCX/ITOCY/MCK green pairs", () => {
  for (const [lab, docs] of Object.entries(FCX_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.ok(ITOCY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(ITOCY_KNOWN_QUARTER_DOCS["Q4 2026"]?.filings);
  assert.ok(MCK_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(MCK_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings);
});

test("IR PDF proxy + direct PDF cover FCX/ITOCY/MCK hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(FCX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ITOCY_KNOWN_QUARTER_DOCS["Q1 2027"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(MCK_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(FCX_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isFcxIrPdf(FCX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isItocyIrPdf(ITOCY_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isMckIrPdf(MCK_KNOWN_QUARTER_DOCS["Q1 2027"]!.filings!), true);
});

test("reject transcript noise", () => {
  assert.equal(isFcxRejected("https://s22.q4cdn.com/529358580/x/transcript.pdf"), true);
});
