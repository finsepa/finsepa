import assert from "node:assert/strict";
import test from "node:test";

import { mergeKoKnownQuarterDocs, parseKoEarningsHtml } from "./ir-seed-ko-match.ts";
import { mergeCatKnownQuarterDocs, parseCatQuarterlyResultsHtml } from "./ir-seed-cat-match.ts";
import { mergeCostKnownQuarterDocs, parseCostIrHtml } from "./ir-seed-cost-match.ts";

test("KO financial HTML maps earnings-release filings and IR Overview slides", () => {
  const html = `
    <a href="/_assets/_2863ac7ce66ff5d8c22d382a1d89eeae/cocacolacompany/db/880/11126/earnings_release/Coca-Cola+2026+Q2+Earnings+Release_Full+Release_7.28.26.pdf">Release</a>
    <a href="/_assets/_2863ac7ce66ff5d8c22d382a1d89eeae/cocacolacompany/db/861/11134/pdf/2Q26+IR+Overview+Presentation.pdf">Overview</a>
    <a href="/_assets/_2863ac7ce66ff5d8c22d382a1d89eeae/cocacolacompany/db/880/11126/webcast_transcript/CORRECTED+TRANSCRIPT.pdf">Transcript</a>
    <a href="/_assets/_2863ac7ce66ff5d8c22d382a1d89eeae/cocacolacompany/db/880/11126/margin_analysis_schedule/Q2%2726+Margin+Analysis+Schedule.pdf">Margin</a>
  `;
  const map = parseKoEarningsHtml(html, "https://investors.coca-colacompany.com/financial-information");
  assert.match(map.get("Q2 2026")?.filings ?? "", /earnings_release\/Coca-Cola\+2026\+Q2/);
  assert.match(map.get("Q2 2026")?.slides ?? "", /2Q26\+IR\+Overview/);
  assert.equal(map.size, 1);
});

test("KO known overlay fills Q2 2022 filings and leaves Q1 2022 empty", () => {
  const merged = mergeKoKnownQuarterDocs(new Map());
  assert.match(merged.get("Q2 2022")?.filings ?? "", /10232\/earnings_release/);
  assert.equal(merged.get("Q1 2022"), undefined);
  assert.match(merged.get("Q1 2026")?.slides ?? "", /1Q26\+IR\+Overview/);
});

test("CAT quarterly HTML maps slide deck vs earnings-release and ignores transcripts", () => {
  const html = `
    <a href="https://s25.q4cdn.com/358376879/files/doc_financials/2026/q2/2Q-2026-Analyst-Slide-Deck_Final.pdf">Deck</a>
    <a href="https://s25.q4cdn.com/358376879/files/doc_financials/2026/q2/2Q-2026-Earnings-Release-Final.pdf">Release</a>
    <a href="https://s25.q4cdn.com/358376879/files/doc_financials/2026/q2/2Q-2026-Caterpillar-Inc-Earnings-Call-Transcript.pdf">Transcript</a>
  `;
  const map = parseCatQuarterlyResultsHtml(
    html,
    "https://investors.caterpillar.com/financials/quarterly-results/default.aspx",
  );
  assert.match(map.get("Q2 2026")?.slides ?? "", /Analyst-Slide-Deck_Final/);
  assert.match(map.get("Q2 2026")?.filings ?? "", /Earnings-Release-Final/);
});

test("CAT known overlay has decks for all 18 quarters and filings only for 2026 Q1/Q2", () => {
  const merged = mergeCatKnownQuarterDocs(new Map());
  assert.equal(merged.size, 18);
  assert.match(merged.get("Q1 2022")?.slides ?? "", /1Q-2022-Earnings-Release_Analyst-Slides/);
  assert.equal(merged.get("Q1 2022")?.filings, null);
  assert.match(merged.get("Q2 2026")?.filings ?? "", /2Q-2026-Earnings-Release-Final/);
});

test("COST IR HTML maps supplement + operating-results and skips monthly sales", () => {
  const html = `
    <a href="https://s201.q4cdn.com/287523651/files/doc_presentations/2026/May/28/Q3-FY-26-Earnings-Supplement.pdf">Supplement</a>
    <a href="https://s201.q4cdn.com/287523651/files/doc_news/Costco-Wholesale-Corporation-Reports-Third-Quarter-and-Year-To-Date-Operating-Results-For-Fiscal-2026-2026.pdf">Results</a>
    <a href="https://s201.q4cdn.com/287523651/files/doc_news/Costco-Wholesale-Corporation-Reports-August-Sales-Results-2026.pdf">August sales</a>
  `;
  const map = parseCostIrHtml(html, "https://investor.costco.com/news/default.aspx");
  assert.match(map.get("Q3 2026")?.slides ?? "", /Q3-FY-26-Earnings-Supplement/);
  assert.match(map.get("Q3 2026")?.filings ?? "", /Operating-Results-For-Fiscal-2026/);
  assert.equal(map.get("Q3 2026")?.filings?.includes("August-Sales"), false);
});

test("COST known overlay fills Q3 2023 supplement and leaves Q1 2026 filings empty", () => {
  const merged = mergeCostKnownQuarterDocs(new Map());
  assert.match(merged.get("Q3 2023")?.slides ?? "", /q3-fy-23\.pdf/);
  assert.equal(merged.get("Q1 2026")?.filings, null);
  assert.match(merged.get("Q2 2026")?.filings ?? "", /February-Sales-Results-2026/);
});
