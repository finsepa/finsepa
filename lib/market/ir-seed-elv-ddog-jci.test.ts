import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { DDOG_KNOWN_QUARTER_DOCS, isDdogIrPdf } from "./ir-seed-ddog-match.ts";
import { ELV_KNOWN_QUARTER_DOCS, isElvIrPdf } from "./ir-seed-elv-match.ts";
import { JCI_KNOWN_QUARTER_DOCS, isJciIrPdf } from "./ir-seed-jci-match.ts";

test("JCI green Sept FY; ELV/DDOG yellow catalogs", () => {
  assert.equal(Object.keys(JCI_KNOWN_QUARTER_DOCS).length, 19);
  assert.ok(JCI_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides);
  assert.ok(JCI_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings);
  assert.equal(Object.keys(ELV_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(ELV_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(ELV_KNOWN_QUARTER_DOCS["Q1 2022"]?.filings);
  assert.ok(ELV_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.equal(Object.keys(DDOG_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(DDOG_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
  assert.ok(DDOG_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
  assert.ok(DDOG_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings);
});

test("IR PDF proxy + matchers cover ELV/DDOG/JCI hosts", () => {
  const elv = ELV_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const ddog = DDOG_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const ddogNode = DDOG_KNOWN_QUARTER_DOCS["Q1 2024"]!.filings!;
  const jci = JCI_KNOWN_QUARTER_DOCS["Q3 2026"]!;
  assert.equal(isElvIrPdf(elv.slides), true);
  assert.equal(isDdogIrPdf(ddog.slides), true);
  assert.equal(isDdogIrPdf(ddogNode), true);
  assert.equal(isJciIrPdf(jci.slides), true);
  assert.equal(isDirectEarningsPdfUrl(elv.slides), true);
  assert.equal(isDirectEarningsPdfUrl(ddogNode), true);
  assert.equal(isDirectEarningsPdfUrl(jci.filings), true);
  assert.equal(isIrPdfProxyUrlAllowed(elv.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(ddog.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(jci.slides!), true);
});
