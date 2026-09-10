import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { fiscalQuarterFromPeriodEndYmd } from "./fiscal-quarter-label.ts";
import { BHP_FY_END, BHP_KNOWN_QUARTER_DOCS, isBhpRejected } from "./ir-seed-bhp-match.ts";
import { C_KNOWN_QUARTER_DOCS, isCRejected } from "./ir-seed-c-match.ts";
import { IBM_KNOWN_QUARTER_DOCS, isIbmRejected } from "./ir-seed-ibm-match.ts";
import { TM_FY_END, tmSlidesUrl, tmUrlMatchesLabel, isTmRejected } from "./ir-seed-tm-match.ts";
import { isTmoRejected, TMO_KNOWN_QUARTER_DOCS } from "./ir-seed-tmo-match.ts";

test("BHP Jun FY: Dec 31 is Q2; reject speech", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-06-30", BHP_FY_END), { fq: 4, fy: 2026 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2025-12-31", BHP_FY_END), { fq: 2, fy: 2026 });
  assert.match(BHP_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides ?? "", /_presentation\.pdf/);
  assert.equal(BHP_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides ?? null, null);
  assert.equal(
    isBhpRejected(
      "https://www.bhp.com/-/media/documents/media/reports-and-presentations/2026/260818_bhpresultsfortheyearended30june2026_speech.pdf",
    ),
    true,
  );
});

test("C Q2 2026 uses presoqtr; reject at-a-glance", () => {
  assert.match(C_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /2026presoqtr2rslt\.pdf/);
  assert.match(C_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides ?? "", /2026psqtr1rslt\.pdf/);
  assert.equal(isDirectEarningsPdfUrl(C_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? ""), true);
  assert.equal(
    isCRejected("https://www.citigroup.com/rcs/citigpa/storage/public/Earnings/Q22026/2q2026-citigroup-at-a-glance.pdf"),
    true,
  );
});

test("TM Mar FY matches vault; presentation_2_en; reject JP", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-06-30", TM_FY_END), { fq: 1, fy: 2027 });
  assert.match(tmSlidesUrl(1, 2027) ?? "", /2027_1q_presentation_2_en\.pdf/);
  assert.equal(
    tmUrlMatchesLabel(
      "https://global.toyota/pages/global_toyota/ir/financial-results/2027_1q_presentation_2_en.pdf",
      "Q1 2026",
    ),
    false,
  );
  assert.equal(
    isTmRejected("https://global.toyota/pages/global_toyota/ir/financial-results/2027_1q_presentation_2_jp.pdf"),
    true,
  );
});

test("IBM charts + press; reject prepared remarks", () => {
  assert.match(IBM_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /ibm-2q-26-earnings-charts\.pdf/);
  assert.match(IBM_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings ?? "", /IBM-1Q22-Earnings-Press-Release\.pdf/);
  assert.equal(isDirectEarningsPdfUrl(IBM_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? ""), true);
  assert.equal(
    isIbmRejected("https://www.ibm.com/investor/att/pdf/IBM-1Q22-Earnings-Prepared-Remarks.pdf"),
    true,
  );
});

test("TMO catalog empty; reject recon and Investor Day", () => {
  assert.equal(Object.keys(TMO_KNOWN_QUARTER_DOCS).length, 0);
  assert.equal(
    isTmoRejected("https://s27.q4cdn.com/797047529/files/doc_financials/2026/q2/Q2-2026-Reconciliation-of-Financial-Information.pdf"),
    true,
  );
  assert.equal(
    isTmoRejected(
      "https://s27.q4cdn.com/797047529/files/doc_presentations/2026/May/20/2026-Investor-Day-Presentation-materials-distribution-vF.pdf",
    ),
    true,
  );
});
