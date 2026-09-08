import assert from "node:assert/strict";
import test from "node:test";

import {
  apple10kCandidates,
  apple10qCandidates,
  appleNewsroomConsolidatedStatementsCandidates,
} from "./ir-seed-apple-match.ts";
import { metaFilingCandidates, metaSlidesCandidates } from "./ir-seed-meta-match.ts";
import { visaFilingsCandidates, visaSlidesCandidates } from "./ir-seed-visa-match.ts";

test("Visa candidates cover dotted Inc., Q2 _FINAL, Q1 apostrophe, Q4 deck", () => {
  const q2Slides = visaSlidesCandidates(2022, 2);
  const q2Filings = visaFilingsCandidates(2022, 2);
  assert.ok(
    q2Slides.includes(
      "https://s1.q4cdn.com/050606653/files/doc_financials/2022/q2/Visa-Inc.-Second-Quarter-2022-Financial-Results-Presentation.pdf",
    ),
  );
  assert.ok(
    q2Filings.includes(
      "https://s1.q4cdn.com/050606653/files/doc_financials/2022/q2/Q2-2022-Earnings-Release-_FINAL.pdf",
    ),
  );

  const q1Filings = visaFilingsCandidates(2023, 1);
  assert.ok(
    q1Filings.includes(
      "https://s1.q4cdn.com/050606653/files/doc_financials/2023/q1/Q1'23-Earnings-Release-FINAL.pdf",
    ),
  );

  const q4Slides = visaSlidesCandidates(2023, 4);
  const q4Filings = visaFilingsCandidates(2023, 4);
  assert.ok(
    q4Slides.includes(
      "https://s1.q4cdn.com/050606653/files/doc_financials/2023/q4/Q4-23-Earnings-Deck-FINAL.pdf",
    ),
  );
  assert.ok(
    q4Filings.includes(
      "https://s1.q4cdn.com/050606653/files/doc_financials/2023/q4/Q4-2023-Earnings-Release-FINAL.pdf",
    ),
  );
});

test("Meta candidates cover 2022 underscore decks, doc_news Results, _final exhibit", () => {
  const q1Slides = metaSlidesCandidates(2022, 1);
  const q1Filings = metaFilingCandidates(2022, 1);
  assert.ok(
    q1Slides.includes(
      "https://s21.q4cdn.com/399680738/files/doc_financials/2022/q1/Q1-2022_Earnings-Presentation_Final.pdf",
    ),
  );
  assert.ok(
    q1Filings.includes(
      "https://s21.q4cdn.com/399680738/files/doc_news/Meta-Reports-First-Quarter-2022-Results-2022.pdf",
    ),
  );

  const q4Filings = metaFilingCandidates(2022, 4);
  assert.ok(
    q4Filings.includes(
      "https://s21.q4cdn.com/399680738/files/doc_news/Meta-Reports-Fourth-Quarter-and-Full-Year-2022-Results-2023.pdf",
    ),
  );

  const q3Slides = metaSlidesCandidates(2023, 3);
  assert.ok(
    q3Slides.includes(
      "https://s21.q4cdn.com/399680738/files/doc_earnings/2023/q3/presentation/Earnings-Presentation-Q3-2023.pdf",
    ),
  );

  const q1_2026 = metaFilingCandidates(2026, 1);
  assert.ok(
    q1_2026.includes(
      "https://s21.q4cdn.com/399680738/files/doc_financials/2026/q1/Meta-03-31-2026-Exhibit-99-1_final.pdf",
    ),
  );
});

test("Apple candidates cover flat newsroom, compact fy2026q2, unparenthesized 10-Q, 10-Q4 10-K", () => {
  const fy22q2 = appleNewsroomConsolidatedStatementsCandidates(2022, 2);
  assert.ok(
    fy22q2.includes(
      "https://www.apple.com/newsroom/pdfs/FY22_Q2_Consolidated_Financial_Statements.pdf",
    ),
  );

  const fy26q2 = appleNewsroomConsolidatedStatementsCandidates(2026, 2);
  assert.ok(
    fy26q2.includes(
      "https://www.apple.com/newsroom/pdfs/fy2026q2/FY26_Q2_Consolidated_Financial_Statements.pdf",
    ),
  );

  const q2_2024 = apple10qCandidates(2024, 2);
  assert.ok(
    q2_2024.includes(
      "https://s2.q4cdn.com/470004039/files/doc_financials/2024/q2/_10-Q-Q2-2024-As-Filed.pdf",
    ),
  );

  const k2024 = apple10kCandidates(2024);
  assert.ok(
    k2024.includes(
      "https://s2.q4cdn.com/470004039/files/doc_earnings/2024/q4/filing/10-Q4-2024-As-Filed.pdf",
    ),
  );
});
