import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { fiscalQuarterFromPeriodEndYmd } from "./fiscal-quarter-label.ts";
import { KLAC_FY_END, KLAC_KNOWN_QUARTER_DOCS, isKlacRejected } from "./ir-seed-klac-match.ts";
import { LRLCY_KNOWN_QUARTER_DOCS, isLrlcyRejected } from "./ir-seed-lrlcy-match.ts";
import { LVMUY_KNOWN_QUARTER_DOCS, isLvmuyRejected } from "./ir-seed-lvmuy-match.ts";
import {
  SFTBY_FY_END,
  sftbyJpFy,
  sftbySlidesUrl,
  sftbyUrlMatchesLabel,
  isSftbyRejected,
} from "./ir-seed-sftby-match.ts";
import { TXN_KNOWN_QUARTER_DOCS, isTxnRejected } from "./ir-seed-txn-match.ts";

test("LVMUY Q1 2026 revenue deck; reject URD", () => {
  assert.match(LVMUY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides ?? "", /LVMHQ12026\.pdf/);
  assert.equal(LVMUY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? null, null);
  assert.equal(
    isLvmuyRejected("https://lvmh-com.cdn.prismic.io/lvmh-com/aczo-pGXnQHGZKQ5_UniversalRegistrationDocument2025.pdf"),
    true,
  );
});

test("LRLCY H1 2026 CB deck + EN press; reject RFS", () => {
  assert.match(LRLCY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /1H26_EN\.pdf/);
  assert.equal(isDirectEarningsPdfUrl(LRLCY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings ?? ""), true);
  assert.equal(LRLCY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides ?? null, null);
  assert.equal(
    isLrlcyRejected("https://www.loreal-finance.com/system/files/2026-07/LOREAL_RFS_2026_UK.pdf"),
    true,
  );
});

test("KLAC Jun FY: Jun 30 is Q4; reject infographic", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-06-30", KLAC_FY_END), { fq: 4, fy: 2026 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2025-12-31", KLAC_FY_END), { fq: 2, fy: 2026 });
  assert.match(KLAC_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides ?? "", /Q4\+FY26/);
  assert.equal(
    isKlacRejected(
      "https://d1io3yog0oux5.cloudfront.net/x/klatencor/db/1/1/earnings_infographic/KLA+Earnings+Infographic+-+Q4+FY26.pdf",
    ),
    true,
  );
});

test("TXN slides empty; filings static-files; reject 10-Q", () => {
  assert.equal(TXN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? null, null);
  assert.match(TXN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /82caba02-3b0a-4452-933e-5b97274b4db6/);
  assert.equal(isDirectEarningsPdfUrl(TXN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? ""), true);
  assert.equal(isTxnRejected("https://investor.ti.com/static-files/form-10-q-example"), true);
  assert.notEqual(
    TXN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings,
    "https://investor.ti.com/static-files/5ba0db09-a2a1-4227-bddd-5e979ff610ce",
  );
});

test("SFTBY Mar FY: Jun 30 is Q1 next year; jpFy is vault FY-1", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-06-30", SFTBY_FY_END), { fq: 1, fy: 2027 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-03-31", SFTBY_FY_END), { fq: 4, fy: 2026 });
  assert.equal(sftbyJpFy(2027), 2026);
  assert.match(sftbySlidesUrl(1, 2027) ?? "", /earnings-presentation_q1fy2026_01_en\.pdf/);
  assert.equal(
    sftbyUrlMatchesLabel(
      "https://group.softbank/media/Project/sbg/sbg/pdf/ir/presentations/2026/earnings-presentation_q1fy2026_01_en.pdf",
      "Q1 2026",
    ),
    false,
  );
  assert.equal(
    isSftbyRejected(
      "https://group.softbank/media/Project/sbg/sbg/pdf/ir/presentations/2026/investor-presentation_q1fy2026_01_en.pdf",
    ),
    true,
  );
});
