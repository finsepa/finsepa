import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { ABNB_KNOWN_QUARTER_DOCS, isAbnbIrPdf, isAbnbRejected } from "./ir-seed-abnb-match.ts";
import { AEM_KNOWN_QUARTER_DOCS, isAemIrPdf } from "./ir-seed-aem-match.ts";
import { TKOMY_KNOWN_QUARTER_DOCS, isTkomyIrPdf, isTkomyRejected } from "./ir-seed-tkomy-match.ts";

test("TKOMY/AEM/ABNB catalogs cover Q1 2022 → latest", () => {
  assert.ok(Object.keys(TKOMY_KNOWN_QUARTER_DOCS).length >= 17);
  assert.equal(Object.keys(AEM_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(ABNB_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(TKOMY_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides ?? "", /tokiomarinehd\.com/);
  assert.match(AEM_KNOWN_QUARTER_DOCS["Q4 2024"]?.slides ?? "", /agnicoeagle/);
  assert.match(ABNB_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /656283129/);
});

test("TKOMY green pairs; AEM through Q4 2024; ABNB slides-only", () => {
  for (const [lab, docs] of Object.entries(TKOMY_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  assert.ok(AEM_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.ok(AEM_KNOWN_QUARTER_DOCS["Q4 2024"]?.filings);
  assert.equal(AEM_KNOWN_QUARTER_DOCS["Q1 2025"]?.slides, null);
  assert.ok(ABNB_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
  assert.equal(ABNB_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings, null);
});

test("IR PDF proxy + direct PDF cover TKOMY/AEM/ABNB hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(TKOMY_KNOWN_QUARTER_DOCS["Q1 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(AEM_KNOWN_QUARTER_DOCS["Q4 2024"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ABNB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(ABNB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isTkomyIrPdf(TKOMY_KNOWN_QUARTER_DOCS["Q3 2023"]!.filings!), true);
  assert.equal(isAemIrPdf(AEM_KNOWN_QUARTER_DOCS["Q4 2024"]!.slides!), true);
  assert.equal(isAbnbIrPdf(ABNB_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});

test("reject transcript noise; 8-K not false-positive on path ids", () => {
  assert.equal(isTkomyRejected("https://www.tokiomarinehd.com/x/transcript.pdf"), true);
  assert.equal(isAbnbRejected("https://s26.q4cdn.com/656283129/x/10-q.pdf"), true);
  assert.equal(
    isTkomyIrPdf(
      "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/qsbph400000008ko-att/Overview_of_3Q_FY2023_Results_e.pdf",
    ),
    true,
  );
});
