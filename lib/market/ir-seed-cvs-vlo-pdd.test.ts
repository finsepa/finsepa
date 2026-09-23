import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { CVS_KNOWN_QUARTER_DOCS, isCvsIrPdf, isCvsRejected } from "./ir-seed-cvs-match.ts";
import { PDD_KNOWN_QUARTER_DOCS, isPddIrPdf, isPddRejected } from "./ir-seed-pdd-match.ts";
import { VLO_KNOWN_QUARTER_DOCS, isVloIrPdf, isVloRejected } from "./ir-seed-vlo-match.ts";

test("CVS/VLO/PDD catalogs cover Q1 2022 → Q2 2026", () => {
  assert.equal(Object.keys(CVS_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(VLO_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(PDD_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(CVS_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /Q2-2026-Earnings-Presentation/);
  assert.match(CVS_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /Q2-2026-Earnings-Release/);
  assert.match(VLO_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /VLO-2Q26-Earnings-Release/);
  assert.match(PDD_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /static-files\/92cc7e1f/);
});

test("CVS green pairs; VLO/PDD filings-only", () => {
  assert.ok(CVS_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(CVS_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(VLO_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(VLO_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.equal(PDD_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(PDD_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + direct PDF cover CVS/VLO/PDD hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(CVS_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(VLO_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PDD_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(CVS_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(PDD_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isCvsIrPdf(CVS_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isVloIrPdf(VLO_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isPddIrPdf(PDD_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});

test("reject transcript / guidance / Non-GAAP", () => {
  assert.equal(isCvsRejected("https://s206.q4cdn.com/752775519/files/doc_financials/2026/q2/Non-GAAP.pdf"), true);
  assert.equal(isVloRejected("https://s23.q4cdn.com/587626645/files/doc_earnings/2026/q2/generic/VLO-Guidance.pdf"), true);
  assert.equal(isPddRejected("https://investor.pddholdings.com/static-files/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), false);
  assert.equal(isCvsIrPdf(CVS_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});
