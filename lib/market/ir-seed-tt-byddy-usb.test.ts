import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { BYDDY_KNOWN_QUARTER_DOCS, isByddyIrPdf } from "./ir-seed-byddy-match.ts";
import { TT_KNOWN_QUARTER_DOCS, isTtIrPdf } from "./ir-seed-tt-match.ts";
import { USB_KNOWN_QUARTER_DOCS, isUsbIrPdf } from "./ir-seed-usb-match.ts";

test("TT/USB green pairs; BYDDY filings-only yellow", () => {
  assert.equal(Object.keys(TT_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(USB_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(BYDDY_KNOWN_QUARTER_DOCS).length, 18);
  for (const [lab, docs] of Object.entries(TT_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(USB_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides, lab);
    assert.ok(docs.filings, lab);
  }
  for (const [lab, docs] of Object.entries(BYDDY_KNOWN_QUARTER_DOCS)) {
    assert.equal(docs.slides, null, lab);
    assert.ok(docs.filings, lab);
  }
});

test("IR PDF proxy + matchers cover TT/BYDDY/USB hosts", () => {
  const tt = TT_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const usb = USB_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  const byd = BYDDY_KNOWN_QUARTER_DOCS["Q2 2026"]!;
  assert.equal(isTtIrPdf(tt.slides), true);
  assert.equal(isUsbIrPdf(usb.filings), true);
  assert.equal(isByddyIrPdf(byd.filings), true);
  assert.equal(isDirectEarningsPdfUrl(tt.slides), true);
  assert.equal(isIrPdfProxyUrlAllowed(tt.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(usb.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(byd.filings!), true);
  assert.match(tt.slides!, /950394465/);
  assert.match(usb.slides!, /711684571/);
  assert.match(byd.filings!, /hkexnews\.hk/);
});
