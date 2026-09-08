import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeMerckKnownQuarterDocs,
  merckFilingsCandidates,
  merckSlidesCandidates,
  parseMerckEarningsHtml,
} from "./ir-seed-merck-match.ts";

test("Merck IR HTML maps presentation + announcement by quarter", () => {
  const html = `
    <a href="https://www.merck.com/wp-content/uploads/sites/124/2026/04/1Q26-Merck-Earnings-Presentation.pdf">1Q26 Merck Earnings Presentation</a>
    <a href="https://www.merck.com/wp-content/uploads/sites/124/2026/04/1Q26-Merck-Earnings-Announcement.pdf">1Q26 Merck Earnings Announcement</a>
    <a href="https://www.merck.com/wp-content/uploads/sites/124/2026/08/2Q26-Merck-Earnings-Presentation.pdf">2Q26 Merck Earnings Presentation</a>
    <a href="https://www.merck.com/wp-content/uploads/sites/124/2026/08/Merck-News-Release-08-04-26-Merck-Co.-Inc.-Rahway-N.J.-USA-Announces-Second-Quarter-2026-Financial-Results.pdf">News Release</a>
    <a href="https://www.merck.com/wp-content/uploads/sites/124/2026/08/MRK-06.30.2026-10Q-FINAL.pdf">Form 10-Q</a>
  `;
  const map = parseMerckEarningsHtml(html);
  assert.equal(
    map.get("Q1 2026")?.slides,
    "https://www.merck.com/wp-content/uploads/sites/124/2026/04/1Q26-Merck-Earnings-Presentation.pdf",
  );
  assert.equal(
    map.get("Q1 2026")?.filings,
    "https://www.merck.com/wp-content/uploads/sites/124/2026/04/1Q26-Merck-Earnings-Announcement.pdf",
  );
  assert.equal(
    map.get("Q2 2026")?.filings,
    "https://www.merck.com/wp-content/uploads/sites/124/2026/08/Merck-News-Release-08-04-26-Merck-Co.-Inc.-Rahway-N.J.-USA-Announces-Second-Quarter-2026-Financial-Results.pdf",
  );
  assert.equal(map.get("Q2 2026")?.slides?.includes("Earnings-Presentation"), true);
});

test("Merck known overlay fills Q3 2025 news-release filings", () => {
  const merged = mergeMerckKnownQuarterDocs(new Map());
  assert.match(merged.get("Q3 2025")?.filings ?? "", /Merck-News-Release-10-30-25/);
  assert.match(merged.get("Q3 2025")?.slides ?? "", /3Q25-Merck-Earnings-Presentation/);
  assert.match(merged.get("Q3 2024")?.filings ?? "", /s21\.q4cdn\.com\/488056881/);
});

test("Merck HTML maps q4cdn news-release + earnings deck", () => {
  const html = `
    <a href='https://s21.q4cdn.com/488056881/files/doc_financials/2024/q3/Merck-News-Release-10-31-24-Merck-Announces-Third-Quarter-2024-Financial-Results.pdf'>Announcement</a>
    <a href='https://s21.q4cdn.com/488056881/files/doc_financials/2024/q3/Q3-2024-Merck-Earnings-Deck.pdf'>3Q24 Merck Earnings Presentation</a>
  `;
  const map = parseMerckEarningsHtml(html);
  assert.match(map.get("Q3 2024")?.filings ?? "", /Merck-News-Release-10-31-24/);
  assert.match(map.get("Q3 2024")?.slides ?? "", /Q3-2024-Merck-Earnings-Deck/);
});

test("Merck HEAD candidates use wp-content month folders", () => {
  assert.ok(merckSlidesCandidates(2, 2025).some((u) => u.endsWith("/2025/07/2Q25-Merck-Earnings-Presentation.pdf")));
  assert.ok(merckFilingsCandidates(1, 2026).some((u) => u.endsWith("/2026/04/1Q26-Merck-Earnings-Announcement.pdf")));
});
