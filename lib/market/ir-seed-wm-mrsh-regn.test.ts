import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { MRSH_KNOWN_QUARTER_DOCS, isMrshIrPdf } from "./ir-seed-mrsh-match.ts";
import { REGN_KNOWN_QUARTER_DOCS, isRegnIrPdf } from "./ir-seed-regn-match.ts";
import { WM_KNOWN_QUARTER_DOCS, isWmIrPdf } from "./ir-seed-wm-match.ts";

test("WM yellow filings-only; MRSH yellow; REGN green catalogs", () => {
  assert.equal(Object.keys(WM_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(WM_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(WM_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(MRSH_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(MRSH_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(MRSH_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(Object.keys(REGN_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(REGN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(REGN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover WM/MRSH/REGN hosts", () => {
  const wm = WM_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const mrsh = MRSH_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const regn = REGN_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isWmIrPdf(wm.filings), true);
  assert.equal(isMrshIrPdf(mrsh.slides), true);
  assert.equal(isRegnIrPdf(regn.slides), true);
  assert.equal(isDirectEarningsPdfUrl(wm.filings), true);
  assert.equal(isDirectEarningsPdfUrl(mrsh.filings), true);
  assert.equal(isDirectEarningsPdfUrl(regn.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(wm.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(mrsh.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(regn.filings!), true);
});
