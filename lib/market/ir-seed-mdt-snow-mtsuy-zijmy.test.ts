import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import {
  MDT_KNOWN_QUARTER_DOCS,
  isMdtIrPdf,
  isMdtRejected,
} from "./ir-seed-mdt-match.ts";
import {
  SNOW_KNOWN_QUARTER_DOCS,
  isSnowIrPdf,
  isSnowRejected,
} from "./ir-seed-snow-match.ts";
import {
  MTSUY_KNOWN_QUARTER_DOCS,
  isMtsuyIrPdf,
  isMtsuyRejected,
} from "./ir-seed-mtsuy-match.ts";
import {
  ZIJMY_KNOWN_QUARTER_DOCS,
  isZijmyIrPdf,
  isZijmyRejected,
} from "./ir-seed-zijmy-match.ts";

test("MDT green late-April FY Q1 2022–Q1 2027", () => {
  assert.equal(Object.keys(MDT_KNOWN_QUARTER_DOCS).length, 21);
  assert.ok(MDT_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(MDT_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(MDT_KNOWN_QUARTER_DOCS["Q1 2027"]?.slides);
  assert.ok(MDT_KNOWN_QUARTER_DOCS["Q1 2027"]?.filings);
  assert.equal(isIrPdfProxyUrlAllowed(MDT_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(MDT_KNOWN_QUARTER_DOCS["Q1 2027"]!.filings!), true);
  assert.equal(isMdtIrPdf(MDT_KNOWN_QUARTER_DOCS["Q1 2027"]!.slides!), true);
  assert.equal(isMdtRejected("https://investorrelations.medtronic.com/x/transcript.pdf"), true);
});

test("SNOW yellow Jan FY slides-only; filings null", () => {
  assert.equal(Object.keys(SNOW_KNOWN_QUARTER_DOCS).length, 22);
  assert.ok(SNOW_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.equal(SNOW_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings, null);
  assert.ok(SNOW_KNOWN_QUARTER_DOCS["Q2 2027"]?.slides);
  assert.equal(SNOW_KNOWN_QUARTER_DOCS["Q2 2027"]?.filings, null);
  assert.equal(isIrPdfProxyUrlAllowed(SNOW_KNOWN_QUARTER_DOCS["Q2 2027"]!.slides!), true);
  assert.equal(isSnowIrPdf(SNOW_KNOWN_QUARTER_DOCS["Q2 2027"]!.slides!), true);
  assert.equal(
    isSnowRejected("https://investors.snowflake.com/news/news-details/2026/x/default.aspx"),
    true,
  );
});

test("MTSUY yellow March FY; recent both", () => {
  assert.ok(Object.keys(MTSUY_KNOWN_QUARTER_DOCS).length >= 15);
  assert.equal(MTSUY_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(MTSUY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides);
  assert.ok(MTSUY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
  assert.equal(isIrPdfProxyUrlAllowed(MTSUY_KNOWN_QUARTER_DOCS["Q1 2026"]!.slides!), true);
  assert.equal(isMtsuyIrPdf(MTSUY_KNOWN_QUARTER_DOCS["Q1 2026"]!.filings!), true);
  assert.equal(isMtsuyRejected("https://www.mitsubishicorp.com/jp/en/ir/x/transcript.pdf"), true);
});

test("ZIJMY yellow filings-only English results", () => {
  assert.equal(Object.keys(ZIJMY_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(ZIJMY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides, null);
  assert.ok(ZIJMY_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
  assert.equal(isIrPdfProxyUrlAllowed(ZIJMY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isZijmyIrPdf(ZIJMY_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isZijmyRejected("https://www.zijinmining.com/x/transcript.pdf"), true);
});
