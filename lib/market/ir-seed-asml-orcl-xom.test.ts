import assert from "node:assert/strict";
import test from "node:test";

import { parseAsmlQuarterResultsHtml } from "./ir-seed-asml-match.ts";
import { orclFilingsCandidateUrls, orclKnownDocsForQuarter } from "./ir-seed-orcl-candidates.ts";
import {
  classifyXomCloudfrontUrl,
  parseXomQuarterFromFilename,
  XOM_KNOWN_DOCUMENT_URLS,
} from "./ir-seed-xom-match.ts";

test("ASML parser prefers IR presentation + press release", () => {
  const html = `
    <a href="https://ourbrand.asml.com/m/x/original/Financial-statements-US-GAAP-Q2-2025.pdf">fs</a>
    <a href="https://ourbrand.asml.com/m/y/original/Press-Release-Quarterly-Results-Q2-2025.pdf">pr</a>
    <a href="https://ourbrand.asml.com/m/z/original/2025_07_16_Presentation-Investor-Relations-Q2-2025.pdf">deck</a>
  `;
  const hit = parseAsmlQuarterResultsHtml(html);
  assert.match(hit.slides ?? "", /Presentation-Investor-Relations/);
  assert.match(hit.filings ?? "", /Press-Release/);
});

test("ORCL filings candidates include month-named press releases", () => {
  const c = orclFilingsCandidateUrls(4, 2025);
  assert.ok(c.some((u) => u.endsWith("4q25-pressrelease-June-final.pdf")));
});

test("ORCL known overlay uses capital-Q FY2024 paths and Q3 2022 without -final", () => {
  assert.match(orclKnownDocsForQuarter(1, 2024)?.filings ?? "", /2024\/Q1\/1q24-pressrelease-September-final/);
  assert.match(orclKnownDocsForQuarter(2, 2024)?.filings ?? "", /2024\/Q2\/2q24-pressrelease-December-final/);
  assert.match(orclKnownDocsForQuarter(3, 2022)?.filings ?? "", /3q22-pressrelease-March\.pdf$/);
});

test("XOM filename quarter + cloudfront classify", () => {
  const slides =
    "https://d1io3yog0oux5.cloudfront.net/_x/exxonmobil/db/2288/22701/presentation/2Q26+Earnings+presentation+slides.pdf";
  const filings =
    "https://d1io3yog0oux5.cloudfront.net/_x/exxonmobil/db/2288/22701/earnings_release/2Q26+Earnings+Release+Website.pdf";
  assert.deepEqual(parseXomQuarterFromFilename(slides), { fq: 2, fy: 2026 });
  assert.equal(classifyXomCloudfrontUrl(slides), "slides");
  assert.equal(classifyXomCloudfrontUrl(filings), "filings");
});

test("XOM known overlay covers 2022 10-Q filings + 2023 press", () => {
  const q1_22 = XOM_KNOWN_DOCUMENT_URLS.find((d) => d.fq === 1 && d.fy === 2022);
  const q1_23 = XOM_KNOWN_DOCUMENT_URLS.find((d) => d.fq === 1 && d.fy === 2023);
  assert.match(q1_22?.slides ?? "", /earnings-presentation-1q\.pdf$/);
  assert.match(q1_22?.filings ?? "", /investor\.exxonmobil\.com\/sec-filings/);
  assert.match(q1_23?.filings ?? "", /earnings_release\/2023-04-28_ExxonMobil/);
});
