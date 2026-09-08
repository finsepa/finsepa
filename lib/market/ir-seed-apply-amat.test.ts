import assert from "node:assert/strict";
import test from "node:test";

import {
  amatNewsReleasePageUrls,
  mergeAmatKnownQuarterDocs,
  parseAmatNewsReleaseHtml,
  parseAmatQuarterlyResultsHtml,
} from "./ir-seed-amat-match.ts";

test("AMAT news-release HTML maps Exhibit 99.1 to filings for that quarter", () => {
  const html = `
    <title>Applied Materials Announces Third Quarter 2026 Results | Applied Materials</title>
    <h1>Applied Materials Announces Third Quarter 2026 Results</h1>
    <a href="/static-files/425ac634-4ee7-4c41-a07f-fa9e3c42b797" title="Exhibit 99.1 (Q3 2026) Earnings Release">News Release</a>
    <a href="/static-files/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" title="Form 8-K">Form 8-K</a>
    <a href="/static-files/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" title="Q3 2026 Earnings Presentation">Earnings Presentation</a>
  `;
  const map = parseAmatNewsReleaseHtml(
    html,
    "https://ir.appliedmaterials.com/news-releases/news-release-details/applied-materials-announces-third-quarter-2026-results",
  );
  assert.equal(
    map.get("Q3 2026")?.filings,
    "https://ir.appliedmaterials.com/static-files/425ac634-4ee7-4c41-a07f-fa9e3c42b797",
  );
  assert.equal(
    map.get("Q3 2026")?.slides,
    "https://ir.appliedmaterials.com/static-files/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  );
});

test("AMAT quarterly-results HTML maps News Release vs Earnings Presentation", () => {
  const html = `
    <a href="/static-files/11111111-1111-1111-1111-111111111111" title="Q2 2026 News Release">News Release</a>
    <a href="/static-files/22222222-2222-2222-2222-222222222222" title="Q2 2026 Earnings Presentation">Earnings Presentation</a>
  `;
  const map = parseAmatQuarterlyResultsHtml(html, "https://ir.appliedmaterials.com/financial-information/quarterly-results");
  assert.equal(
    map.get("Q2 2026")?.filings,
    "https://ir.appliedmaterials.com/static-files/11111111-1111-1111-1111-111111111111",
  );
  assert.equal(
    map.get("Q2 2026")?.slides,
    "https://ir.appliedmaterials.com/static-files/22222222-2222-2222-2222-222222222222",
  );
});

test("AMAT known overlay fills Exhibit 99.1 filings", () => {
  const merged = mergeAmatKnownQuarterDocs(new Map());
  assert.match(merged.get("Q3 2026")?.filings ?? "", /425ac634-4ee7-4c41-a07f-fa9e3c42b797/);
  assert.equal(merged.get("Q3 2026")?.slides, null);
});

test("AMAT news-release slugs include Q4 fiscal-year variants", () => {
  const urls = amatNewsReleasePageUrls(4, 2025);
  assert.ok(urls.some((u) => u.includes("fourth-quarter-and-fiscal-year-2025-results")));
});
