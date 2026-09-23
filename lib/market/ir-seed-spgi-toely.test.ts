import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  SPGI_KNOWN_QUARTER_DOCS,
  isSpgiIrPdf,
  isSpgiRejected,
} from "./ir-seed-spgi-match.ts";
import {
  TOELY_KNOWN_QUARTER_DOCS,
  isToelyIrPdf,
  isToelyRejected,
} from "./ir-seed-toely-match.ts";
import {
  AIQUY_KNOWN_QUARTER_DOCS,
  isAiquyIrPdf,
  isAiquyRejected,
} from "./ir-seed-aiquy-match.ts";
import {
  HDB_KNOWN_QUARTER_DOCS,
  isHdbIrPdf,
  isHdbRejected,
} from "./ir-seed-hdb-match.ts";
import {
  PH_KNOWN_QUARTER_DOCS,
  isPhIrPdf,
  isPhRejected,
} from "./ir-seed-ph-match.ts";
import {
  MPC_KNOWN_QUARTER_DOCS,
  isMpcIrPdf,
  isMpcRejected,
} from "./ir-seed-mpc-match.ts";

test("SPGI/TOELY catalogs cover in-scope quarters", () => {
  assert.equal(Object.keys(SPGI_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(TOELY_KNOWN_QUARTER_DOCS).length, 21);
  assert.match(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /2Q-2026-Earnings-Call-Slides/);
  assert.match(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /2Q-2026-Earnings-Release/);
  assert.match(TOELY_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides ?? "", /fy27q1presentations-e/);
  assert.match(TOELY_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings ?? "", /fy27q1tanshin-e/);
});

test("SPGI green Q1 2022–Q2 2026; TOELY green March FY", () => {
  assert.ok(SPGI_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(SPGI_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(SPGI_KNOWN_QUARTER_DOCS["Q3 2026"], undefined);
  assert.ok(TOELY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(TOELY_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(TOELY_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides);
  assert.ok(TOELY_KNOWN_QUARTER_DOCS["Q4 2026"]?.filings);
});

test("IR PDF proxy + direct PDF cover SPGI q4cdn and TOELY tel.com", () => {
  assert.equal(isIrPdfProxyUrlAllowed(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(TOELY_KNOWN_QUARTER_DOCS["Q1 2027"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(TOELY_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isSpgiIrPdf(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isToelyIrPdf(TOELY_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
});

test("reject supplemental / transcript / QA; keep earnings PDFs", () => {
  assert.equal(
    isSpgiRejected(
      "https://s29.q4cdn.com/690959130/files/doc_financials/2026/q2/S-P-Global-2Q-2026-Earnings-Supplemental-Disclosure-7-27-2026.pdf",
    ),
    true,
  );
  assert.equal(isSpgiRejected(SPGI_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);

  assert.equal(
    isToelyRejected(
      "https://www.tel.com/ir/irta3a00000006g5-att/fy27q1transcript-e.pdf",
    ),
    true,
  );
  assert.equal(
    isToelyRejected(
      "https://www.tel.com/ir/irta3a00000006g5-att/FY27Q1_EarningCall_QA_E.pdf",
    ),
    true,
  );
  assert.equal(isToelyRejected(TOELY_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), false);
});

test("AIQUY catalog Q1 2022–Q2 2026 green", () => {
  assert.equal(Object.keys(AIQUY_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(AIQUY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(AIQUY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.ok(AIQUY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
  assert.ok(AIQUY_KNOWN_QUARTER_DOCS["Q1 2025"]?.slides);
  assert.ok(AIQUY_KNOWN_QUARTER_DOCS["Q3 2025"]?.slides);
  assert.ok(AIQUY_KNOWN_QUARTER_DOCS["Q1 2025"]?.filings);
  assert.equal(isIrPdfProxyUrlAllowed(AIQUY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(AIQUY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isAiquyIrPdf(AIQUY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(
    isAiquyRejected(
      "https://www.airliquide.com/sites/airliquide.com/files/2026-08/h1-2026-credit-investors-presentation.pdf",
    ),
    true,
  );
});


test("HDB/PH/MPC catalogs cover recent quarters", () => {
  assert.ok(Object.keys(HDB_KNOWN_QUARTER_DOCS).length >= 15);
  assert.equal(Object.keys(PH_KNOWN_QUARTER_DOCS).length, 20);
  assert.equal(Object.keys(MPC_KNOWN_QUARTER_DOCS).length, 18);
  assert.ok(HDB_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides);
  assert.ok(HDB_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings);
  assert.ok(PH_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(PH_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(PH_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides);
  assert.ok(MPC_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(MPC_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.ok(MPC_KNOWN_QUARTER_DOCS["Q4 2023"]?.filings);
  assert.ok(MPC_KNOWN_QUARTER_DOCS["Q1 2024"]?.filings);
  assert.ok(MPC_KNOWN_QUARTER_DOCS["Q4 2024"]?.filings);
  assert.equal(isIrPdfProxyUrlAllowed(HDB_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PH_KNOWN_QUARTER_DOCS["Q4 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(MPC_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isHdbIrPdf(HDB_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isPhIrPdf(PH_KNOWN_QUARTER_DOCS["Q4 2026"]!.slides!), true);
  assert.equal(isMpcIrPdf(MPC_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isHdbRejected("https://www.hdfc.bank.in/x/transcript-q1.pdf"), true);
  assert.equal(isPhRejected("https://d1io3yog0oux5.cloudfront.net/x/parker/db/1/2/pdf/Barclays.pdf"), true);
  assert.equal(isMpcRejected("https://s2.q4cdn.com/142437514/files/doc_financials/x/packet.pdf"), true);
});
