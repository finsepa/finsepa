import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { isIrPdfProxyUrlAllowed } from "./ir-pdf-proxy-allowlist.ts";
import { NET_KNOWN_QUARTER_DOCS, isNetIrPdf, isNetRejected } from "./ir-seed-net-match.ts";
import { PGR_KNOWN_QUARTER_DOCS, isPgrIrPdf, isPgrRejected } from "./ir-seed-pgr-match.ts";

test("NET/PGR catalogs span 18 quarters (Q1 2022 → Q2 2026)", () => {
  assert.equal(Object.keys(NET_KNOWN_QUARTER_DOCS).length, 18);
  assert.equal(Object.keys(PGR_KNOWN_QUARTER_DOCS).length, 18);
  assert.match(NET_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /Supplemental/);
  assert.match(NET_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /Exhibit-99/);
  assert.match(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /605347829/);
  assert.match(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]?.filings ?? "", /globenewswire/);
});

test("NET is green (both docs); PGR is yellow (Q1/Q3 often filings-only)", () => {
  for (const docs of Object.values(NET_KNOWN_QUARTER_DOCS)) {
    assert.ok(docs.slides);
    assert.ok(docs.filings);
  }
  assert.equal(PGR_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides, null);
  assert.ok(PGR_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings);
  assert.match(PGR_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings ?? "", /globenewswire/);
  assert.ok(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides);
});

test("IR PDF proxy allowlist covers NET + PGR hosts", () => {
  assert.equal(isIrPdfProxyUrlAllowed(NET_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(NET_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isIrPdfProxyUrlAllowed(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);
});

test("reject transcript / 10-Q; keep earnings PDFs", () => {
  assert.equal(
    isNetRejected(
      "https://cloudflare.net/files/doc_financials/2026/q2/NET-US-CORRECTED-TRANSCRIPT-Cloudflare.pdf",
    ),
    true,
  );
  assert.equal(isNetRejected(NET_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), false);
  assert.equal(isNetIrPdf(NET_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
  assert.equal(isDirectEarningsPdfUrl(NET_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), true);

  assert.equal(
    isPgrRejected(
      "https://s202.q4cdn.com/605347829/files/doc_financials/2026/q2/some-10-Q.pdf",
    ),
    true,
  );
  assert.equal(isPgrRejected(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.filings!), false);
  assert.equal(isPgrIrPdf(PGR_KNOWN_QUARTER_DOCS["Q2 2026"]!.slides!), true);
});
