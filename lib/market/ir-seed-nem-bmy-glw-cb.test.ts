import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  BMY_KNOWN_QUARTER_DOCS,
  isBmyRejected,
  isBmyIrPdf,
} from "./ir-seed-bmy-match.ts";
import { CB_KNOWN_QUARTER_DOCS, isCbRejected } from "./ir-seed-cb-match.ts";
import {
  GLW_KNOWN_QUARTER_DOCS,
  isGlwRejected,
  isGlwIrPdf,
} from "./ir-seed-glw-match.ts";
import {
  NEM_KNOWN_QUARTER_DOCS,
  isNemRejected,
  isNemIrPdf,
} from "./ir-seed-nem-match.ts";

test("NEM/BMY/GLW/CB catalogs span 18 quarters (Q1 2022 → Q2 2026)", () => {
  assert.equal(Object.keys(NEM_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(BMY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(GLW_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(CB_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(NEM_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /382246808/);
  assert.match(BMY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /104148044/);
  assert.match(GLW_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /212458750/);
  assert.match(CB_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings ?? "", /471466897/);
});

test("CB catalogs include Corporate Presentation slides where published", () => {
  assert.match(CB_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /Corporate-Presentation/);
  assert.match(CB_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides ?? "", /Corporate-Presentation/);
  assert.equal(CB_KNOWN_QUARTER_DOCS["Q1 2024"]?.slides, null);
  assert.equal(CB_KNOWN_QUARTER_DOCS["Q4 2022"]?.slides, null);
  for (const docs of Object.values(CB_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.filings?.includes("/471466897/"));
  }
});

test("IR PDF proxy allowlist covers issuer hosts", () => {
  assert.equal(
    isIrPdfProxyUrlAllowed(NEM_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!),
    true,
  );
  assert.equal(
    isIrPdfProxyUrlAllowed(BMY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!),
    true,
  );
  assert.equal(
    isIrPdfProxyUrlAllowed(BMY_KNOWN_QUARTER_DOCS["Q1 2022"]!.slides!),
    true,
  );
  assert.equal(
    isIrPdfProxyUrlAllowed(GLW_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!),
    true,
  );
  assert.equal(
    isIrPdfProxyUrlAllowed(CB_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!),
    true,
  );
  assert.equal(
    isIrPdfProxyUrlAllowed(CB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!),
    true,
  );
});

test("reject 10-Q / statistics / preliminary schedules; keep earnings PDFs", () => {
  assert.equal(
    isNemRejected(
      "https://s24.q4cdn.com/382246808/files/doc_earnings/2026/q2/generic/Newmont-Q2-2026-Operating-Statistics_Final.pdf",
    ),
    true,
  );
  assert.equal(isNemRejected(NEM_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isNemIrPdf(NEM_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);

  assert.equal(
    isBmyRejected(
      "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2026/Preliminary-Q2-2026-acquired-IPRD-and-licensing-income-schedule.pdf",
    ),
    true,
  );
  assert.equal(isBmyIrPdf(BMY_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);

  assert.equal(
    isGlwRejected(
      "https://s203.q4cdn.com/212458750/files/doc_financials/2026/q2/Corning-Incorporated-Second-Quarter-2026-Financials-2026-07-28.pdf",
    ),
    true,
  );
  assert.equal(isGlwRejected(GLW_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), false);
  assert.equal(isGlwIrPdf(GLW_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(GLW_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);

  assert.equal(
    isCbRejected("https://s201.q4cdn.com/471466897/files/doc_financials/2025/q3/Chubb-Limited-Q3-2025-Form-10-Q-Filed.pdf"),
    true,
  );
  assert.equal(isCbRejected(CB_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), false);
  assert.equal(isCbRejected(CB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isDirectEarningsPdfUrl(CB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});
