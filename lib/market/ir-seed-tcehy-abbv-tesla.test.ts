import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isEarningsFilingsPreviewUrl } from "./earnings-document-url.ts";
import { isIrVaultAllowedUrl } from "./earnings-ir-vault-types.ts";
import { abbvDocsByLabel } from "./ir-seed-abbv-catalog.ts";
import { TCEHY_KNOWN_QUARTER_DOCS } from "./ir-seed-tcehy-match.ts";
import {
  teslaAssetsIrUpdateUrl,
  teslaKnownDocsForQuarter,
} from "./ir-seed-tesla-catalog.ts";

test("TCEHY Q2 2024 has a distinct results presentation PDF", () => {
  const q = TCEHY_KNOWN_QUARTER_DOCS["Q2 2024"];
  assert.match(q.slides ?? "", /44149b29cb1ebb83e059bab039501c5b\.pdf$/);
  assert.notEqual(q.slides, q.filings);
});

test("ABBV pipeline slides are earnings-day companions, not JPM decks", () => {
  const q2 = abbvDocsByLabel().get("Q2 2026");
  assert.match(q2?.slides ?? "", /de1828c0-47ed-42cb-8573-24fe42ceb748/);
  assert.match(q2?.filings ?? "", /54e24524-1f24-4a49-8b48-c0333a96dc39/);
  assert.notEqual(q2?.slides, q2?.filings);
  assert.equal(abbvDocsByLabel().get("Q1 2025")?.slides, undefined);
  assert.equal(isDirectEarningsPdfUrl(q2?.slides ?? null), true);
});

test("Tesla assets-ir Update + 10-Q HTML are distinct vault docs", () => {
  const q3 = teslaKnownDocsForQuarter(3, 2025);
  assert.equal(q3?.slides, teslaAssetsIrUpdateUrl(3, 2025));
  assert.equal(isDirectEarningsPdfUrl(q3?.slides ?? null), true);
  assert.equal(isIrVaultAllowedUrl(q3?.filings ?? null), true);
  assert.equal(isEarningsFilingsPreviewUrl(q3?.filings ?? null), true);
  assert.notEqual(q3?.slides, q3?.filings);
  assert.match(teslaKnownDocsForQuarter(1, 2022)?.filings ?? "", /tsla-20220331\.htm$/);
});
