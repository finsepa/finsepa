import assert from "node:assert/strict";
import test from "node:test";

import {
  countVaultReports,
  isIrVaultAllowedUrl,
  isIrVaultPeriodInScope,
  vaultTrafficLight,
} from "./earnings-ir-vault-types.ts";

test("vault period scope starts at Q1 2022", () => {
  assert.equal(isIrVaultPeriodInScope("2021-12-31"), false);
  assert.equal(isIrVaultPeriodInScope("2022-01-01"), true);
  assert.equal(isIrVaultPeriodInScope("2026-06-30"), true);
});

test("traffic lights match report counts", () => {
  assert.equal(vaultTrafficLight(0), "red");
  assert.equal(vaultTrafficLight(1), "yellow");
  assert.equal(vaultTrafficLight(2), "green");
  assert.equal(countVaultReports("https://a/x.pdf", null), 1);
  assert.equal(countVaultReports("https://a/x.pdf", "https://a/x.pdf"), 1);
  assert.equal(countVaultReports("https://a/x.pdf", "https://a/y.pdf"), 2);
});

test("IR vault allows previewable SEC exhibit HTML; rejects unrelated SEC HTML", () => {
  assert.equal(
    isIrVaultAllowedUrl("https://www.sec.gov/Archives/edgar/data/1/x.htm"),
    false,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000451/a2q26presentatione.htm",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://www.sec.gov/Archives/edgar/data/1046179/000156459023000363/tsm-ex991_38.htm",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://www.sec.gov/Archives/edgar/data/731766/000073176626000191/ex991pressrelease.pdf",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl("https://www.sec.gov/Archives/edgar/data/731766/000073176626000191/logo.pdf"),
    false,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://s25.q4cdn.com/479285134/files/doc_financials/2026/q2/2Q26-Mastercard-Earnings-Presentation.pdf",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/PressReleaseFY25Q4",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/PressReleaseFY22_Q3",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://investors.micron.com/static-files/9c0becf5-df56-4eec-bd67-453dda68b273",
    ),
    false,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q3/Micron_Q3_26_Earnings_Deck.pdf",
    ),
    true,
  );
  assert.equal(
    isIrVaultAllowedUrl(
      "https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm",
    ),
    true,
  );
});
