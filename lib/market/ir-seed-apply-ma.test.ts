import assert from "node:assert/strict";
import test from "node:test";

import { maFilingsCandidates, maSlidesCandidates } from "./ir-seed-ma-match.ts";

test("MA candidates cover 2023 hyphenated release + 2025 website/final names", () => {
  const q3Filings = maFilingsCandidates(3, 2023);
  assert.ok(q3Filings.includes(
    "https://s25.q4cdn.com/479285134/files/doc_financials/2023/q3/3Q-2023-Mastercard-Earnings-Release.pdf",
  ));

  const q1Slides = maSlidesCandidates(1, 2025);
  const q1Filings = maFilingsCandidates(1, 2025);
  assert.ok(q1Slides.includes(
    "https://s25.q4cdn.com/479285134/files/doc_financials/2025/q1/1Q25-Earnings-Presentation-Website.pdf",
  ));
  assert.ok(q1Filings.includes(
    "https://s25.q4cdn.com/479285134/files/doc_financials/2025/q1/1Q25-Earnings-Release.pdf",
  ));

  const q2Slides = maSlidesCandidates(2, 2025);
  const q2Filings = maFilingsCandidates(2, 2025);
  assert.ok(q2Slides.includes(
    "https://s25.q4cdn.com/479285134/files/doc_financials/2025/q2/2Q25-Earnings-Presentation-Website.pdf",
  ));
  assert.ok(q2Filings.includes(
    "https://s25.q4cdn.com/479285134/files/doc_financials/2025/q2/2Q25-Earnings-Release-Final.pdf",
  ));
});
