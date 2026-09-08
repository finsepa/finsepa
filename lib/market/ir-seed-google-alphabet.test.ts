import assert from "node:assert/strict";
import test from "node:test";

import {
  alphabetFilingCandidates,
  alphabetKnownFilingUrl,
  alphabetSlidesCandidates,
} from "./ir-seed-google-alphabet-match.ts";

test("Alphabet slides fall back to earnings-release after the deck filename", () => {
  const slides = alphabetSlidesCandidates(2022, 3);
  assert.equal(
    slides[0],
    "https://s206.q4cdn.com/479360582/files/doc_financials/2022/q3/2022q3-alphabet-earnings-slides.pdf",
  );
  assert.ok(slides.includes(
    "https://s206.q4cdn.com/479360582/files/doc_financials/2022/q3/2022q3-alphabet-earnings-release.pdf",
  ));
});

test("Alphabet filings include dated 10-Q names and never the earnings-release PDF", () => {
  const q1 = alphabetFilingCandidates(2022, 1);
  assert.ok(q1.includes(
    "https://s206.q4cdn.com/479360582/files/doc_financials/2022/q1/20220427-alphabet-10q.pdf",
  ));
  assert.ok(!q1.some((u) => /earnings-release/i.test(u)));

  const q4 = alphabetFilingCandidates(2023, 4);
  assert.ok(q4.includes(
    "https://s206.q4cdn.com/479360582/files/doc_financials/2023/q4/goog-10-k-2023-final.pdf",
  ));

  assert.equal(
    alphabetKnownFilingUrl(2023, 2),
    "https://s206.q4cdn.com/479360582/files/doc_financials/2023/q2/goog-10-q-q2-2023-4.pdf",
  );
  assert.ok(alphabetFilingCandidates(2023, 2).includes(
    "https://s206.q4cdn.com/479360582/files/doc_financials/2023/q2/goog-10-q-q2-2023-4.pdf",
  ));
});
