import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  ACN_KNOWN_QUARTER_DOCS,
  isAcnIrPdf,
  isAcnRejected,
} from "./ir-seed-acn-match.ts";
import {
  BNS_KNOWN_QUARTER_DOCS,
  isBnsIrPdf,
  isBnsRejected,
} from "./ir-seed-bns-match.ts";
import {
  MO_KNOWN_QUARTER_DOCS,
  isMoIrPdf,
  isMoRejected,
} from "./ir-seed-mo-match.ts";

test("BNS/MO/ACN catalogs cover in-scope quarters", () => {
  assert.equal(Object.keys(BNS_KNOWN_QUARTER_DOCS).length, 19);
  assert.equal(Object.keys(MO_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ACN_KNOWN_QUARTER_DOCS).length, 19);
  assert.match(BNS_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /Q326_Investor_Presentation/);
  assert.match(BNS_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings ?? "", /Quarterly_Press_Release-EN/);
  assert.match(MO_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /sitecorecloud/);
  assert.match(MO_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /Altria-Q2-2026-Earnings/);
  assert.match(ACN_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /accenture-3q-fy26-earnings-presentation/);
  assert.match(ACN_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /q1-fy22-supporting-materials/);
});

test("BNS/MO/ACN green pairs through latest", () => {
  assert.ok(BNS_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(BNS_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(MO_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(MO_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(MO_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.ok(ACN_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(ACN_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings);
  assert.equal(ACN_KNOWN_QUARTER_DOCS["Q3 2023"]?.slides, null);
  assert.ok(ACN_KNOWN_QUARTER_DOCS["Q3 2023"]?.filings);
});

test("IR PDF proxy + direct PDF cover BNS/MO/ACN hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(BNS_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(MO_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(MO_KNOWN_QUARTER_DOCS["Q1 2022"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ACN_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ACN_KNOWN_QUARTER_DOCS["Q1 2022"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(MO_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isBnsIrPdf(BNS_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
  assert.equal(isMoIrPdf(MO_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isAcnIrPdf(ACN_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);
});

test("reject Shareholders_Report / metrics / transcript / bare infographic", () => {
  assert.equal(
    isBnsRejected(
      "https://www.scotiabank.com/content/dam/scotiabank/corporate/quarterly-reports/2026/q2/Q226_Shareholders_Report-EN.pdf",
    ),
    true,
  );
  assert.equal(
    isMoRejected("https://s204.q4cdn.com/505541855/files/doc_downloads/2026/Altria-Q2-2026-Earnings-Metrics.pdf"),
    true,
  );
  assert.equal(
    isAcnRejected(
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/accenture-first-quarter-fiscal-2026-conference-call-transcript.pdf",
    ),
    true,
  );
  assert.equal(
    isAcnRejected(
      "https://investor.accenture.com/~/media/Files/A/Accenture-IR-V3/quarterly-earnings/2023/q3fy23/fy23q3-infographics-supporting-materials.pdf",
    ),
    true,
  );
  assert.equal(isBnsIrPdf(BNS_KNOWN_QUARTER_DOCS["Q3 2026"]!.filings!), true);
  assert.equal(isMoIrPdf(MO_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isAcnIrPdf(ACN_KNOWN_QUARTER_DOCS["Q2 2025"]!.filings!), true);
});
