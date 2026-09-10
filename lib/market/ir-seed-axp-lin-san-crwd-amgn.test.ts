import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { fiscalQuarterFromPeriodEndYmd } from "./fiscal-quarter-label.ts";
import { AMGN_KNOWN_QUARTER_DOCS, isAmgnRejected } from "./ir-seed-amgn-match.ts";
import { AXP_KNOWN_QUARTER_DOCS, isAxpRejected } from "./ir-seed-axp-match.ts";
import { CRWD_FY_END, CRWD_KNOWN_QUARTER_DOCS, isCrwdRejected } from "./ir-seed-crwd-match.ts";
import { LIN_KNOWN_QUARTER_DOCS, isLinRejected } from "./ir-seed-lin-match.ts";
import { SAN_KNOWN_QUARTER_DOCS, isSanRejected } from "./ir-seed-san-match.ts";

test("AXP Q2 2026 presentation + press; reject tables", () => {
  assert.match(AXP_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /Q2-2026-Earnings-Presentation\.pdf/);
  assert.match(AXP_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /Q2-2026-Earnings-Press-Release\.pdf/);
  assert.equal(isDirectEarningsPdfUrl(AXP_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? ""), true);
  assert.equal(
    isAxpRejected(
      "https://s26.q4cdn.com/747928648/files/doc_earnings/2026/q2/supplemental-info/Q2-2026-Earnings-Tables.pdf",
    ),
    true,
  );
});

test("LIN teleconference slides + release tables; reject 10-Q", () => {
  assert.match(LIN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /linde2q26teleconferenceslides\.pdf/);
  assert.match(LIN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /linde-2q26-earnings-release-tables\.pdf/);
  assert.equal(LIN_KNOWN_QUARTER_DOCS["Q4 2023"]?.slides ?? null, null);
  assert.equal(
    isLinRejected(
      "https://assets.linde.com/-/media/global/corporate/corporate/documents/investors/10q/10q-lin---q3-2025.pdf",
    ),
    true,
  );
});

test("SAN privilegiada EN presentation + press; reject institutional", () => {
  assert.match(
    SAN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "",
    /hr-2026-07-22-second-quarter-2026-results-earnings-presentation-en\.pdf/,
  );
  assert.equal(SAN_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? null, null);
  assert.equal(
    isSanRejected(
      "https://www.santander.com/content/dam/santander-com/en/documentos/presentacion-institucional/2026/07/pi-2026-institutional-presentation-h126-en.pdf",
    ),
    true,
  );
});

test("CRWD Jan FY: Jul 31 is Q2 next year; reject 8-K", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-07-31", CRWD_FY_END), { fq: 2, fy: 2027 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-01-31", CRWD_FY_END), { fq: 4, fy: 2026 });
  assert.match(CRWD_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? "", /f774ef12-cf94-48bf-ace2-c7f3dcf8ec97/);
  assert.equal(CRWD_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings ?? null, null);
  assert.equal(isDirectEarningsPdfUrl(CRWD_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? ""), true);
  assert.equal(
    isCrwdRejected("https://ir.crowdstrike.com/static-files/aad9615c-cb35-40f0-b619-67eb24bb0c6b", "Form 8-K"),
    true,
  );
});

test("AMGN Q2 2026 slides; filings empty; reject 8-K", () => {
  assert.match(AMGN_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /6214ad8a-4a21-4f66-8571-165e8cbb4681/);
  assert.equal(AMGN_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? null, null);
  assert.equal(isDirectEarningsPdfUrl(AMGN_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings ?? ""), true);
  assert.equal(
    isAmgnRejected("https://investors.amgen.com/static-files/d67d7c8f-3959-4757-acbc-0862c1ec10ff", "Form 8-K"),
    true,
  );
});
