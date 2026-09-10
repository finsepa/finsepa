import assert from "node:assert/strict";
import test from "node:test";

import {
  DELL_KNOWN_QUARTER_DOCS,
  labelFromDellContext,
  parseDellQuarterlyResultsHtml,
} from "./ir-seed-dell-match.ts";
import { GE_KNOWN_QUARTER_DOCS, isGeRejectedAsSlides } from "./ir-seed-ge-match.ts";
import { labelFromMsPdfHref, msSlidesUrl, parseMsEarningsHtml } from "./ir-seed-ms-match.ts";

test("Dell FY labels parse Qn FY and nQ FY Performance Review", () => {
  assert.equal(labelFromDellContext("Q1 FY27 Performance Review"), "Q1 2027");
  assert.equal(labelFromDellContext("4Q FY22 Performance Review"), "Q4 2022");
});

test("Dell HTML maps Performance Review, not transcript or tables", () => {
  const html = `
    <a href="/static-files/a75bf8cc-b60f-4f72-8413-2e4090e46f93" title="Q1 FY27 Performance Review">Performance Review</a>
    <a href="/static-files/c0eaebe7-8d9c-45ee-9331-69f9ae6157fd" title="Q1 FY27 Press Release">Press Release</a>
    <a href="/static-files/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" title="Q1 FY27 Transcript">Transcript</a>
  `;
  const map = parseDellQuarterlyResultsHtml(
    html,
    "https://investors.delltechnologies.com/financial-information/quarterly-results",
  );
  assert.match(map.get("Q1 2027")?.slides ?? "", /a75bf8cc-b60f-4f72-8413-2e4090e46f93/);
  assert.match(map.get("Q1 2027")?.filings ?? "", /c0eaebe7-8d9c-45ee-9331-69f9ae6157fd/);
});

test("Dell catalog has FY22 Q4 and FY27 Q1; Q2 FY27 stays empty", () => {
  assert.match(DELL_KNOWN_QUARTER_DOCS["Q4 2022"]?.slides ?? "", /6370aa87/);
  assert.match(DELL_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? "", /a75bf8cc/);
  assert.equal(DELL_KNOWN_QUARTER_DOCS["Q2 2027"]?.slides, undefined);
});

test("MS Q4 slides prefer Strategic Update; Q2 uses financial supplement", () => {
  assert.match(msSlidesUrl(4, 2025), /4q2025-strategic-update/);
  assert.match(msSlidesUrl(2, 2026), /finsup2q2026/);
  assert.equal(labelFromMsPdfHref("/content/dam/msdotcom/en/about-us-ir/finsup2q2026/finsup2q2026.pdf"), "Q2 2026");
});

test("MS HTML maps supplement and release, not XLS", () => {
  const html = `
    <a href="/content/dam/msdotcom/en/about-us-ir/shareholder/2q2026.pdf">Earnings Release PDF</a>
    <a href="/content/dam/msdotcom/en/about-us-ir/finsup2q2026/finsup2q2026.pdf">Financial Supplements PDF</a>
    <a href="/content/dam/msdotcom/en/about-us-ir/finsup2q2026/finsup2q2026.xlsx">XLSX</a>
    <a href="/content/dam/msdotcom/en/about-us-ir/shareholder/4q2025-strategic-update.pdf">4Q 2025 Strategic Update PDF</a>
    <a href="/content/dam/msdotcom/en/about-us-ir/shareholder/4q2025.pdf">4Q Release</a>
    <a href="/content/dam/msdotcom/en/about-us-ir/finsup4q2025/finsup4q2025.pdf">4Q Supplement</a>
  `;
  const map = parseMsEarningsHtml(html, "https://www.morganstanley.com/about-us-ir/earnings-releases");
  assert.match(map.get("Q2 2026")?.filings ?? "", /shareholder\/2q2026\.pdf/);
  assert.match(map.get("Q2 2026")?.slides ?? "", /finsup2q2026/);
  assert.match(map.get("Q4 2025")?.slides ?? "", /strategic-update/);
});

test("GE catalog covers Q1 2022 through Q2 2026 and rejects 10-Q / Investor Day", () => {
  assert.match(GE_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /ge_webcast_presentation_04262022/);
  assert.match(GE_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /07162026_2/);
  assert.equal(isGeRejectedAsSlides("https://www.geaerospace.com/sites/default/files/geaerospace_webcast_10q_07162026.pdf"), true);
  assert.equal(isGeRejectedAsSlides("https://www.geaerospace.com/sites/default/files/investor-day-2024-presentation.pdf"), true);
});
