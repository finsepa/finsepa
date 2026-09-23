import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  BMO_KNOWN_QUARTER_DOCS,
  isBmoIrPdf,
  isBmoRejected,
} from "./ir-seed-bmo-match.ts";
import {
  BTI_KNOWN_QUARTER_DOCS,
  isBtiIrPdf,
  isBtiRejected,
} from "./ir-seed-bti-match.ts";
import {
  CFRUY_KNOWN_QUARTER_DOCS,
  isCfruyIrPdf,
  isCfruyRejected,
} from "./ir-seed-cfruy-match.ts";
import { PGR_KNOWN_QUARTER_DOCS, isPgrIrPdf } from "./ir-seed-pgr-match.ts";

test("BMO/CFRUY/BTI/PGR catalogs cover in-scope quarters", () => {
  assert.equal(Object.keys(BMO_KNOWN_QUARTER_DOCS).length, 19);
  assert.equal(Object.keys(CFRUY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(BTI_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(PGR_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(BMO_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /AnalystPresentation/);
  assert.match(CFRUY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /fy27-q1-sales/);
  assert.match(BTI_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /HY_2026_Presentation/);
  assert.match(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /globenewswire/);
});

test("BMO green; BTI Q1/Q3 empty; CFRUY Q2 2022 filings-only; PGR Q1 slides-null", () => {
  assert.ok(BMO_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(BMO_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(BTI_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides, null);
  assert.equal(BTI_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings, null);
  assert.ok(BTI_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(CFRUY_KNOWN_QUARTER_DOCS["Q2 2022"]?.slides, null);
  assert.ok(CFRUY_KNOWN_QUARTER_DOCS["Q2 2022"]?.filings);
  assert.equal(PGR_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides, null);
  assert.ok(PGR_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
});

test("IR PDF proxy + direct PDF cover hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(BMO_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(CFRUY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(BTI_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isPgrIrPdf(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});

test("reject transcript / Pre-Close / ReportToShareholders", () => {
  assert.equal(
    isBmoRejected("https://www.bmo.com/ir/qtrinfo/1/2026-q3/Q326_ReportToShareholders.pdf"),
    true,
  );
  assert.equal(isBmoIrPdf(BMO_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(
    isCfruyRejected("https://www.richemont.com/media/x/richemont-fy26-annual-report-en.pdf"),
    true,
  );
  assert.equal(isCfruyIrPdf(CFRUY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(
    isBtiRejected("https://www.bat.com/content/dam/batcom/.../FY_2025_Pre_Close.pdf"),
    true,
  );
  assert.equal(isBtiIrPdf(BTI_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});
