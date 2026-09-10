import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { fiscalQuarterFromPeriodEndYmd } from "./fiscal-quarter-label.ts";
import { ANET_KNOWN_QUARTER_DOCS, isAnetIrPdf, isAnetRejected } from "./ir-seed-anet-match.ts";
import { AZN_KNOWN_QUARTER_DOCS, aznUrlMatchesLabel, isAznRejected } from "./ir-seed-azn-match.ts";
import { GEV_KNOWN_QUARTER_DOCS, isGevRejected } from "./ir-seed-gev-match.ts";
import { sapFilingsUrl, sapSlidesUrl, isSapRejected, sapUrlMatchesLabel } from "./ir-seed-sap-match.ts";
import { SIEGY_FY_END, SIEGY_KNOWN_QUARTER_DOCS, isSiegyRejected } from "./ir-seed-siegy-match.ts";

test("GEV catalog Q1 2024 standalone; reject transcript and Investor Update", () => {
  assert.match(GEV_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /gev_webcast_presentation_07222026\.pdf/);
  assert.match(GEV_KNOWN_QUARTER_DOCS["Q1 2024"]?.slides ?? "", /gev_webcast_presentation_04252024\.pdf/);
  assert.equal(
    isGevRejected("https://www.gevernova.com/sites/default/files/gev_webcast_transcript_10232024.pdf"),
    true,
  );
  assert.equal(
    isGevRejected("https://www.gevernova.com/sites/default/files/gev_webcast_presentation_12092025.pdf"),
    true,
  );
});

test("AZN catalog Q1 2025 uses /q1/; reject aide-memoire", () => {
  assert.match(AZN_KNOWN_QUARTER_DOCS["Q1 2025"]?.slides ?? "", /2025\/q1\/Q1-2025-results-presentation\.pdf/);
  assert.match(AZN_KNOWN_QUARTER_DOCS["Q3 2024"]?.slides ?? "", /2024\/9mq3\//);
  assert.equal(
    aznUrlMatchesLabel(
      "https://www.astrazeneca.com/content/dam/az/PDF/2026/eq1/Q1-2026-results-presentation.pdf",
      "Q1 2025",
    ),
    false,
  );
  assert.equal(
    isAznRejected("https://www.astrazeneca.com/content/dam/az/PDF/2026/AZN-PostQ4-Aide-memoire-March.pdf"),
    true,
  );
});

test("ANET Highlights are decks; hashed 10-Q and Technical IR rejected", () => {
  assert.match(ANET_KNOWN_QUARTER_DOCS["Q1 2025"]?.slides ?? "", /Arista-2025-Q1-Highlights\.pdf/);
  assert.match(ANET_KNOWN_QUARTER_DOCS["Q3 2024"]?.slides ?? "", /ANET_Financial_Q324_FINAL\.pdf/);
  assert.equal(ANET_KNOWN_QUARTER_DOCS["Q1 2025"]?.filings ?? null, null);
  assert.equal(
    isAnetIrPdf("https://s21.q4cdn.com/861911615/files/doc_financials/2025/q1/ce4f8d95-941f-4838-93a8-7171109c35fb.pdf"),
    false,
  );
  assert.equal(
    isAnetRejected("https://s21.q4cdn.com/861911615/files/doc_financials/2024/q3/Technical_IR_ANET_Q3-24_FINAL.pdf"),
    true,
  );
});

test("SIEGY Sep FY: Jun 30 is Q3; reject shareholder letter", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-06-30", SIEGY_FY_END), { fq: 3, fy: 2026 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2025-09-30", SIEGY_FY_END), { fq: 4, fy: 2025 });
  assert.match(SIEGY_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /2026-q3-presentation-en\.pdf/);
  assert.equal(isDirectEarningsPdfUrl(SIEGY_KNOWN_QUARTER_DOCS["Q1 2026"]?.filings ?? ""), true);
  assert.equal(
    isSiegyRejected("https://assets.new.siemens.com/siemens/assets/api/uuid:x/shareholderletter-q1-fy25.pdf"),
    true,
  );
});

test("SAP constructs presentation + EN statement; Q2 2026 slides empty; reject mitteilung", () => {
  assert.match(sapSlidesUrl(1, 2026) ?? "", /sap-2026-q1-presentation\.pdf/);
  assert.match(sapFilingsUrl(2, 2026) ?? "", /sap-2026-q2-statement\.pdf/);
  assert.equal(sapSlidesUrl(2, 2026), null);
  assert.equal(isSapRejected("https://www.sap.com/docs/download/investors/2026/sap-2026-q2-mitteilung.pdf"), true);
  assert.equal(
    sapUrlMatchesLabel("https://www.sap.com/docs/download/investors/2026/sap-2026-q1-presentation.pdf", "Q1 2025"),
    false,
  );
});
