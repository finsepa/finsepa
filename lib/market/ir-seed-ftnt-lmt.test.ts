import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  FTNT_KNOWN_QUARTER_DOCS,
  isFtntIrPdf,
  isFtntRejected,
} from "./ir-seed-ftnt-match.ts";
import {
  LMT_KNOWN_QUARTER_DOCS,
  isLmtIrPdf,
  isLmtRejected,
} from "./ir-seed-lmt-match.ts";

test("FTNT/LMT catalogs span 18 quarters (Q1 2022 → Q2 2026)", () => {
  assert.equal(Object.keys(FTNT_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(LMT_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(FTNT_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /static-files\/657dfcda/);
  assert.match(FTNT_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /static-files\/e4ffcc79/);
  assert.match(LMT_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /mediaroom/);
  assert.match(LMT_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /Earnings-Release/);
});

test("FTNT/LMT yellow gaps preserved", () => {
  assert.equal(FTNT_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings, null);
  assert.ok(FTNT_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.equal(LMT_KNOWN_QUARTER_DOCS["Q4 2024"]?.slides, null);
  assert.equal(LMT_KNOWN_QUARTER_DOCS["Q4 2024"]?.filings, null);
  assert.ok(LMT_KNOWN_QUARTER_DOCS["Q4 2025"]?.filings);
  assert.match(LMT_KNOWN_QUARTER_DOCS["Q4 2025"]?.filings ?? "", /Earnings-Release|static-files/);
});

test("IR PDF proxy allowlist covers FTNT static-files + LMT MediaRoom", () => {
  assert.equal(isIrPdfProxyUrlAllowed(FTNT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(LMT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(LMT_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isDirectEarningsPdfUrl(FTNT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(LMT_KNOWN_QUARTER_DOCS["Q4 2025"]!.filings!), true);
});

test("reject prepared remarks / tables; keep earnings-release 8-K PDF", () => {
  assert.equal(
    isFtntRejected("https://investor.fortinet.com/static-files/x", "Prepared Remarks"),
    true,
  );
  assert.equal(isFtntIrPdf(FTNT_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(
    isLmtRejected(LMT_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!),
    false,
  );
  assert.equal(isLmtIrPdf(LMT_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(
    isLmtRejected(
      "https://filecache.mediaroom.com/mr5mr_lockheedmartin/1/download/Financial-Tables.pdf",
      "Financial Tables",
    ),
    true,
  );
});
