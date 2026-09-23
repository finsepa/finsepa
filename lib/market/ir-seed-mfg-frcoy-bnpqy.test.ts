import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  BNPQY_KNOWN_QUARTER_DOCS,
  isBnpqyIrPdf,
  isBnpqyRejected,
} from "./ir-seed-bnpqy-match.ts";
import {
  FRCOY_KNOWN_QUARTER_DOCS,
  isFrcoyIrPdf,
  isFrcoyRejected,
} from "./ir-seed-frcoy-match.ts";
import {
  MFG_KNOWN_QUARTER_DOCS,
  isMfgIrPdf,
  isMfgRejected,
} from "./ir-seed-mfg-match.ts";

test("MFG/FRCOY/BNPQY catalogs cover in-scope quarters", () => {
  assert.equal(Object.keys(MFG_KNOWN_QUARTER_DOCS).length, 21);
  assert.equal(Object.keys(FRCOY_KNOWN_QUARTER_DOCS).length, 19);
  assert.equal(Object.keys(BNPQY_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(MFG_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? "", /fg-data26_1q_2/);
  assert.match(FRCOY_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /20260709_results_en/);
  assert.match(BNPQY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /2q26-slides/);
});

test("MFG yellow Q1–Q3 2024 filings-null; FRCOY/BNPQY green recent", () => {
  assert.equal(MFG_KNOWN_QUARTER_DOCS["Q1 2024"]?.filings, null);
  assert.ok(MFG_KNOWN_QUARTER_DOCS["Q1 2024"]?.slides);
  assert.ok(FRCOY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(FRCOY_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(BNPQY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(BNPQY_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
});

test("IR PDF proxy + direct PDF cover hosts (incl. BNP no-.pdf)", () => {
  assert.equal(isIrPdfProxyUrlAllowed(MFG_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(FRCOY_KNOWN_QUARTER_DOCS["Q3 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(BNPQY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(BNPQY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(BNPQY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isBnpqyIrPdf(BNPQY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});

test("reject capital-ratio / FAQ / transcript; keep earnings PDFs", () => {
  assert.equal(
    isMfgRejected(
      "https://library.mizuhogroup.com/asset/x/Capital_Ratio_Material_for_FY2026_Q1.pdf",
    ),
    true,
  );
  assert.equal(isMfgRejected(MFG_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), false);
  assert.equal(isMfgIrPdf(MFG_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);

  assert.equal(
    isFrcoyRejected("https://www.fastretailing.com/eng/ir/library/pdf/20260709_faq_en.pdf"),
    true,
  );
  assert.equal(isFrcoyIrPdf(FRCOY_KNOWN_QUARTER_DOCS["Q3 2026"]!.slides!), true);

  assert.equal(
    isBnpqyRejected("https://invest.bnpparibas/en/document/2q26-transcript"),
    true,
  );
  assert.equal(isBnpqyRejected(BNPQY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
});
