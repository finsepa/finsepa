import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CM_KNOWN_QUARTER_DOCS, isCmIrPdf } from "./ir-seed-cm-match.ts";
import { ENB_KNOWN_QUARTER_DOCS, isEnbIrPdf } from "./ir-seed-enb-match.ts";
import { PSX_KNOWN_QUARTER_DOCS, isPsxIrPdf } from "./ir-seed-psx-match.ts";
import { SYK_KNOWN_QUARTER_DOCS, isSykIrPdf, isSykRejected } from "./ir-seed-syk-match.ts";

test("CM/SYK/ENB/PSX catalogs cover Q1 2022 → latest", () => {
  assert.ok(Object.keys(CM_KNOWN_QUARTER_DOCS).length >= 18);
  assert.equal(Object.keys(SYK_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ENB_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(PSX_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(CM_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /cibc\.com.*presentation/);
  assert.match(PSX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /128149789/);
  assert.match(ENB_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /enbridge\.com/);
});

test("CM/PSX green; SYK filings-sparse; ENB slides-only", () => {
  assert.ok(CM_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(CM_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(PSX_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(PSX_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(ENB_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings, null);
  assert.ok(ENB_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.equal(SYK_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(SYK_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + direct PDF cover CM/SYK/ENB/PSX hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(CM_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(SYK_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ENB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PSX_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(CM_KNOWN_QUARTER_DOCS["Q3 2026"]!.filings!), true);
  assert.equal(isCmIrPdf(CM_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isSykIrPdf(SYK_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isEnbIrPdf(ENB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isPsxIrPdf(PSX_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("reject transcript noise", () => {
  assert.equal(isSykRejected("https://s22.q4cdn.com/857738142/x/transcript.pdf"), true);
});
