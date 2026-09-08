import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAvgoNodePdfPath,
  parseAvgoEarningsTitle,
  parseAvgoQuarterlyResultsHtml,
} from "./ir-seed-avgo-match.ts";
import { jnjKnownDocsForQuarter, jnjSlidesCandidateUrls } from "./ir-seed-jnj-candidates.ts";
import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrVaultAllowedUrl } from "./earnings-ir-vault-types.ts";

test("parseAvgoEarningsTitle handles ordinal + FY titles", () => {
  assert.deepEqual(
    parseAvgoEarningsTitle(
      "Broadcom Inc. Announces Second Quarter Fiscal Year 2026 Financial Results and Quarterly Dividend",
    ),
    { fq: 2, fy: 2026 },
  );
  assert.deepEqual(
    parseAvgoEarningsTitle(
      "Broadcom Inc. Announces Fourth Quarter and Fiscal Year 2025 Financial Results and Quarterly Dividend",
    ),
    { fq: 4, fy: 2025 },
  );
});

test("parseAvgoQuarterlyResultsHtml maps Q labels", () => {
  const html = `
    <a href="/news-releases/news-release-details/broadcom-inc-announces-first-quarter-fiscal-year-2024-financial">
      Broadcom Inc. Announces First Quarter Fiscal Year 2024 Financial Results and Quarterly Dividend
    </a>`;
  const map = parseAvgoQuarterlyResultsHtml(html);
  assert.equal(map.get("Q1 2024")?.href.includes("first-quarter-fiscal-year-2024"), true);
});

test("extractAvgoNodePdfPath", () => {
  assert.equal(extractAvgoNodePdfPath('<a href="/node/63416/pdf">PDF</a>'), "/node/63416/pdf");
});

test("Broadcom /node/N/pdf counts as direct PDF + vault-allowed", () => {
  const u = "https://investors.broadcom.com/node/63416/pdf";
  assert.equal(isDirectEarningsPdfUrl(u), true);
  assert.equal(isIrVaultAllowedUrl(u), true);
  assert.equal(isDirectEarningsPdfUrl("https://investors.broadcom.com/node/64671/pdf"), true);
});

test("jnj slides candidates include Webcast and Final variants", () => {
  const c = jnjSlidesCandidateUrls(4, 2022);
  assert.ok(c.some((u) => u.endsWith("Final-JNJ-Earnings-Presentation-4Q2022.pdf")));
  assert.ok(c.some((u) => u.includes("JNJ-Earnings-Presentation-Q4-2022-Final.pdf")));
});

test("jnj known overlay has 2022 press + 2023 decks + Q2 2024 Webcast slides", () => {
  assert.match(jnjKnownDocsForQuarter(1, 2022)?.filings ?? "", /1Q22-Press-Release-with-attachments/);
  assert.match(jnjKnownDocsForQuarter(1, 2023)?.slides ?? "", /FINAL-JNJ-Earnings-Presentation-Q1-2023/);
  assert.match(jnjKnownDocsForQuarter(2, 2023)?.filings ?? "", /Johnson--Johnson-Reports-Q2-2023-Results/);
  assert.match(
    jnjKnownDocsForQuarter(2, 2024)?.slides ?? "",
    /FINAL-JNJ-Earnings-Presentation-Q2-2024-Webcast/,
  );
});
