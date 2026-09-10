import assert from "node:assert/strict";
import test from "node:test";

import { isDirectEarningsPdfUrl } from "./earnings-pdf-url.ts";
import { fiscalQuarterFromPeriodEndYmd } from "./fiscal-quarter-label.ts";
import { isMufgRejected, mufgYmFromPeriodEndYmd, parseMufgIrIndexHtml } from "./ir-seed-mufg-match.ts";
import { NSRGY_KNOWN_QUARTER_DOCS, isNsrgyRejected } from "./ir-seed-nsrgy-match.ts";
import { nvsFilingsUrl, nvsSlidesUrl, isNvsRejected, nvsUrlMatchesLabel } from "./ir-seed-nvs-match.ts";
import { RTX_KNOWN_QUARTER_DOCS, isRtxRejected } from "./ir-seed-rtx-match.ts";
import { SNDK_FY_END, SNDK_KNOWN_QUARTER_DOCS, isSndkRejected } from "./ir-seed-sndk-match.ts";

test("NVS constructs presentation + EN press; Q1 2022 slides empty; reject Deutsch", () => {
  assert.match(nvsSlidesUrl(2, 2026) ?? "", /q2-2026-investor-presentation\.pdf/);
  assert.match(nvsFilingsUrl(2, 2026) ?? "", /q2-2026-media-release-en\.pdf/);
  assert.equal(nvsSlidesUrl(1, 2022), null);
  assert.match(nvsFilingsUrl(1, 2022) ?? "", /q1-2022-media-release-en\.pdf/);
  assert.equal(isNvsRejected("https://www.novartis.com/sites/novartis_com/files/q2-2026-media-release-de.pdf"), true);
  assert.equal(
    isNvsRejected("https://www.novartis.com/sites/novartis_com/files/novartis-q2-2025-impact-and-sustainability-update.pdf"),
    true,
  );
  assert.equal(
    nvsUrlMatchesLabel("https://www.novartis.com/sites/novartis_com/files/q1-2026-investor-presentation.pdf", "Q1 2025"),
    false,
  );
  assert.equal(
    nvsUrlMatchesLabel("https://www.novartis.com/sites/novartis_com/files/q1-2025-investor-presentation.pdf", "Q1 2025"),
    true,
  );
});

test("RTX catalog Q1 2026 webcast; reject Bernstein and 10-Q", () => {
  assert.match(RTX_KNOWN_QUARTER_DOCS["Q1 2026"]?.slides ?? "", /2c351bfe-d90c-4990-9910-a5dbd4e6b23b/);
  assert.match(RTX_KNOWN_QUARTER_DOCS["Q3 2024"]?.slides ?? "", /52d38337-ec8c-4e09-85b8-d75038197ca3/);
  assert.equal(isRtxRejected("https://investors.rtx.com/static-files/x-10-q"), true);
  assert.equal(isRtxRejected("https://investors.rtx.com/static-files/bernstein-strategic"), true);
});

test("SNDK July-ish FY: Jul 3 is Q4; node/pdf is a PDF; reject transcript", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-07-03", SNDK_FY_END), { fq: 4, fy: 2026 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2025-10-03", SNDK_FY_END), { fq: 1, fy: 2026 });
  assert.match(SNDK_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /1b7ca99b-f84a-4294-9f56-690b32fce69a/);
  assert.equal(isDirectEarningsPdfUrl("https://investor.sandisk.com/node/7716/pdf"), true);
  assert.equal(isSndkRejected("https://investor.sandisk.com/static-files/x-transcript"), true);
});

test("MUFG maps period-end YYMM; H1 slides only; reject speech", () => {
  assert.equal(mufgYmFromPeriodEndYmd("2026-03-31"), "2603");
  assert.equal(mufgYmFromPeriodEndYmd("2025-09-30"), "2509");
  const map = parseMufgIrIndexHtml(`
    <a href="/dam/ir/presentation/2025/pdf/slides2509_en.pdf">Presentation Material</a>
    <a href="/dam/ir/presentation/2025/pdf/speech2509_en.pdf">Speech Script</a>
    <a href="/dam/ir/fs/2025/pdf/highlights2509_en.pdf">Financial Highlights</a>
    <a href="/dam/ir/presentation/2026/pdf/slides260901_en.pdf">Other</a>
    <a href="/dam/ir/fs/2026/pdf/highlights2606_en.pdf">Q1 highlights</a>
  `);
  assert.match(map.get("2509")?.slides ?? "", /slides2509_en\.pdf/);
  assert.match(map.get("2509")?.filings ?? "", /highlights2509_en\.pdf/);
  assert.equal(map.get("2606")?.slides ?? null, null);
  assert.match(map.get("2606")?.filings ?? "", /highlights2606_en\.pdf/);
  assert.equal(map.has("260901"), false);
  assert.equal(isMufgRejected("https://www.mufg.jp/dam/ir/presentation/2025/pdf/speech2603_en.pdf"), true);
});

test("NSRGY HY 2026 catalog; reject prepared remarks and half-year report", () => {
  assert.match(NSRGY_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "", /half-year-results-investor-presentation-2026\.pdf/);
  assert.match(NSRGY_KNOWN_QUARTER_DOCS["Q1 2025"]?.slides ?? "", /three-month-sales-investor-presentation-2025\.pdf/);
  assert.equal(
    isNsrgyRejected("https://www.nestle.com/sites/default/files/2026-07/half-year-results-prepared-remarks-2026.pdf"),
    true,
  );
  assert.equal(
    isNsrgyRejected("https://www.nestle.com/sites/default/files/2023-07/2023-half-year-report-en.pdf"),
    true,
  );
});
