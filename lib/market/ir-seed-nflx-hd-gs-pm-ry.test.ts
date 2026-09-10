import assert from "node:assert/strict";
import test from "node:test";

import { gsSlidesUrl } from "./ir-seed-gs-match.ts";
import {
  hdIrQuarterFromPeriodEndYmd,
  hdPressReleaseUrl,
  isHdRejectedAsSlides,
  labelFromHdPressHref,
  parseHdQuarterlyEarningsHtml,
} from "./ir-seed-hd-match.ts";
import { nflxShareholderLetterCandidates } from "./ir-seed-nflx-match.ts";
import { isPmRejected, labelFromPmPageUrl, parsePmEarningsHtml } from "./ir-seed-pm-match.ts";
import { isRyRejected, rySlidesUrl } from "./ir-seed-ry-match.ts";

test("NFLX letter candidates cover FINAL and Q1 2023 Final", () => {
  assert.match(nflxShareholderLetterCandidates(2, 2026)[0] ?? "", /FINAL-Q2-26-Shareholder-Letter/);
  assert.ok(nflxShareholderLetterCandidates(1, 2023).some((u) => /Final-Q1-23-Shareholder-Letter/.test(u)));
});

test("HD press filename switches at FY2025; never treats 10-Q as slides", () => {
  assert.match(hdPressReleaseUrl(2, 2024), /q2-2024-earning-release/);
  assert.match(hdPressReleaseUrl(2, 2026), /q2-2026-earnings-release/);
  assert.equal(isHdRejectedAsSlides("/reports/hd-q2-2026-10q.pdf"), true);
});

test("HD IR quarter follows period-end, not Jan-FY labels", () => {
  assert.deepEqual(hdIrQuarterFromPeriodEndYmd("2026-07-31"), { fq: 2, fy: 2026 });
  assert.deepEqual(hdIrQuarterFromPeriodEndYmd("2026-01-31"), { fq: 4, fy: 2025 });
  assert.deepEqual(hdIrQuarterFromPeriodEndYmd("2026-04-30"), { fq: 1, fy: 2026 });
  assert.equal(labelFromHdPressHref("https://ir.homedepot.com/~/media/Files/H/HomeDepot-IR/press-release/q2-2026-earnings-release.pdf"), "Q2 2026");
});

test("HD HTML maps press release, not transcript or infographic", () => {
  const html = `
    <a href="/~/media/Files/H/HomeDepot-IR/press-release/q2-2026-earnings-release.pdf">Press</a>
    <a href="/~/media/Files/H/HomeDepot-IR/2026/hd-2q26-transcript.pdf">Transcript</a>
    <a href="/~/media/Files/H/HomeDepot-IR/reports-and-presentations/quarterly-earnings/2026/2026-q2-infographic.pdf">Infographic</a>
  `;
  const map = parseHdQuarterlyEarningsHtml(html, "https://ir.homedepot.com/financial-reports/quarterly-earnings/2026");
  assert.match(map.get("Q2 2026")?.filings ?? "", /q2-2026-earnings-release/);
  assert.equal(map.get("Q2 2026")?.slides, null);
});

test("GS CloudFront presentation URL is quarter-named", () => {
  assert.match(gsSlidesUrl(2, 2026), /2026-q2-earnings-results-presentation\.pdf/);
});

test("PMI HTML maps Presentation not Script; Q4 2025 stays uncatalogued", () => {
  assert.equal(labelFromPmPageUrl("https://www.pmi.com/2025Q3earnings"), "Q3 2025");
  const html = `
    <a href="https://philipmorrisinternational.gcs-web.com/static-files/60cbe6dd-3101-4893-b19d-355154ad8164" aria-label="Open Presentation PDF">Presentation</a>
    <a href="https://philipmorrisinternational.gcs-web.com/static-files/1413f36d-6ebf-4fc0-9fe3-d721a794ef1e">Press Release</a>
    <a href="https://philipmorrisinternational.gcs-web.com/static-files/4ad6c1b3-be1c-49ab-a242-c81e2ed5c8f3">Script</a>
  `;
  const map = parsePmEarningsHtml(
    html,
    "https://www.pmi.com/investor-relations/press-releases-and-events/2026-q2-results",
  );
  assert.match(map.get("Q2 2026")?.slides ?? "", /60cbe6dd/);
  assert.match(map.get("Q2 2026")?.filings ?? "", /1413f36d/);
  assert.equal(isPmRejected("", "Script"), true);
});

test("RY quarterly slides URL; reject speech and pillar 3", () => {
  assert.match(rySlidesUrl(3, 2026), /2026q3slides\.pdf/);
  assert.equal(isRyRejected("https://www.rbc.com/investor-relations/_assets-custom/pdf/2026q3speech.pdf"), true);
  assert.equal(isRyRejected("https://www.rbc.com/investor-relations/_assets-custom/pdf/2026q3pillar3.pdf"), true);
});
