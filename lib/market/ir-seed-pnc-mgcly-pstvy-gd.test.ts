import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { GD_KNOWN_QUARTER_DOCS, isGdIrPdf } from "./ir-seed-gd-match.ts";
import { MGCLY_KNOWN_QUARTER_DOCS, isMgclyIrPdf } from "./ir-seed-mgcly-match.ts";
import { PNC_KNOWN_QUARTER_DOCS, isPncIrPdf } from "./ir-seed-pnc-match.ts";
import { PSTVY_KNOWN_QUARTER_DOCS, isPstvyIrPdf } from "./ir-seed-pstvy-match.ts";

test("PNC/GD green pairs Q1 2022 → Q2 2026", () => {
  assert.equal(Object.keys(PNC_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(GD_KNOWN_QUARTER_DOCS).length, 18);
  for (const [lab, docs] of Object.entries(PNC_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(GD_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
});

test("MGCLY/PSTVY yellow catalogs", () => {
  assert.ok(MGCLY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(MGCLY_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(MGCLY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides, null);
  assert.equal(MGCLY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings, null);
  assert.ok(PSTVY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(PSTVY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(PSTVY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(PSTVY_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
});

test("IR PDF proxy + matchers cover PNC/MGCLY/PSTVY/GD hosts", () => {
  const pnc = PNC_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const gd = GD_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const mg = MGCLY_KNOWN_QUARTER_DOCS["Q1 2022"]!;
  const ps = PSTVY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isPncIrPdf(pnc.slides), true);
  assert.equal(isPncIrPdf(PNC_KNOWN_QUARTER_DOCS["Q4 2022"]!.filings), true);
  assert.equal(isGdIrPdf(gd.filings), true);
  assert.equal(isMgclyIrPdf(mg.slides), true);
  assert.equal(isPstvyIrPdf(ps.slides), true);
  assert.equal(isDirectEarningsPdfUrl(pnc.slides), true);
  assert.equal(isIrPdfProxyUrlAllowed(pnc.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PNC_KNOWN_QUARTER_DOCS["Q4 2022"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(gd.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(mg.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ps.filings!), true);
});
