import assert from "node:assert/strict";
import test from "node:test";

import { parseCvxInvestorsHtml, CVX_KNOWN_QUARTER_DOCS, labelFromCvxPresentationContext } from "./ir-seed-cvx-match.ts";
import { parseHsbcResultsHtml, HSBC_KNOWN_QUARTER_DOCS, labelFromHsbcPresentationHref } from "./ir-seed-hsbc-match.ts";
import { earningsPdfHrefMatchesQuarterLabels } from "./gcs-web-earnings-presentations.ts";
import {
  lrcxFiscalLabelFromCalendarQuarter,
  mergeLrcxKnownQuarterDocs,
  parseLrcxQuarterlyResultsHtml,
  LRCX_KNOWN_QUARTER_DOCS,
} from "./ir-seed-lrcx-match.ts";
import { pltrSlidesUrlForLabel, PLTR_KNOWN_QUARTER_DOCS } from "./ir-seed-pltr-match.ts";
import { unhRejectsAsSlides } from "./ir-seed-unh-match.ts";

test("LRCX June FY maps calendar quarters to vault labels", () => {
  assert.equal(lrcxFiscalLabelFromCalendarQuarter("March", 2026), "Q3 2026");
  assert.equal(lrcxFiscalLabelFromCalendarQuarter("June", 2026), "Q4 2026");
  assert.equal(lrcxFiscalLabelFromCalendarQuarter("September", 2025), "Q1 2026");
  assert.equal(lrcxFiscalLabelFromCalendarQuarter("December", 2025), "Q2 2026");
});

test("LRCX quarterly-results HTML maps VIEW SLIDES, not Exhibit 99.1", () => {
  const html = `
    <a aria-label="Slides for March Quarter 2022" href="image/04-19+-+March+earnings_v5.pdf">VIEW SLIDES</a>
    <a aria-label="Press Release for June Quarter 2022" href="image/LRCX_Exhibit_99.1_Q4_2022.pdf">PRESS RELEASE</a>
    <a aria-label="Slides for June Quarter 2022" href="image/QJun22+Earnings+Slides+combined+v6+web.pdf">VIEW SLIDES</a>
  `;
  const map = parseLrcxQuarterlyResultsHtml(html, "https://investor.lamresearch.com/quarterly-results");
  assert.match(map.get("Q3 2022")?.slides ?? "", /04-19\+-\+March\+earnings_v5\.pdf/);
  assert.match(map.get("Q4 2022")?.slides ?? "", /QJun22/);
  assert.equal(map.get("Q4 2022")?.filings, null);
});

test("LRCX known catalog wins over HTML for the same quarter", () => {
  const html = `
    <a aria-label="Slides for December Quarter 2025" href="image/wrong-dec.pdf">VIEW SLIDES</a>
  `;
  const parsed = parseLrcxQuarterlyResultsHtml(html, "https://investor.lamresearch.com/quarterly-results");
  const merged = mergeLrcxKnownQuarterDocs(parsed);
  assert.match(merged.get("Q2 2026")?.slides ?? "", /DecQ25\+Earnings\+slides\+full\+FINAL\.pdf/);
});

test("LRCX catalog covers Q1 2022 through Q4 2026", () => {
  assert.ok(LRCX_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides);
  assert.ok(LRCX_KNOWN_QUARTER_DOCS["Q3 2022"]?.slides);
});

test("LRCX Q4_2026 filename must not lock on a Q2 row; Dec catalog URLs may", () => {
  const q4 = "https://filecache.investorroom.com/mr5ir_lamresearch2/1500/Q4_2026_slides_full_final.pdf";
  const dec = LRCX_KNOWN_QUARTER_DOCS["Q2 2026"]?.slides ?? "";
  assert.equal(earningsPdfHrefMatchesQuarterLabels(q4, ["Q2 2026"]), false);
  assert.match(dec, /DecQ25/);
  assert.equal(earningsPdfHrefMatchesQuarterLabels(dec, ["Q2 2026"]), true);
});

test("HSBC path buckets map to calendar quarters", () => {
  assert.equal(
    labelFromHsbcPresentationHref(
      "https://www.hsbc.com/-/files/hsbc/investors/hsbc-results/2026/interim/pdfs/hsbc-holdings-plc/x.pdf",
    ),
    "Q2 2026",
  );
  assert.equal(
    labelFromHsbcPresentationHref(
      "https://www.hsbc.com/-/files/hsbc/investors/hsbc-results/2025/annual/pdfs/hsbc-holdings-plc/x.pdf",
    ),
    "Q4 2025",
  );
});

test("HSBC HTML keeps investor presentations and drops transcripts", () => {
  const html = `
    <a href="/-/files/hsbc/investors/hsbc-results/2026/1q/pdfs/hsbc-holdings-plc/260505-1q-2026-presentation-to-investors-and-analysts.pdf">1Q</a>
    <a href="/-/files/hsbc/investors/hsbc-results/2026/1q/pdfs/hsbc-holdings-plc/260505-1q-2026-presentation-to-investors-and-analysts-transcript.pdf">transcript</a>
  `;
  const map = parseHsbcResultsHtml(html, "https://www.hsbc.com/investors/results-and-announcements");
  assert.match(map.get("Q1 2026")?.slides ?? "", /260505-1q-2026-presentation-to-investors-and-analysts\.pdf$/);
  assert.ok(HSBC_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides);
});

test("CVX investors HTML maps presentation CTA, not earnings release", () => {
  assert.equal(labelFromCvxPresentationContext("2026 2Q Earnings Conference Call Presentation with Prepared Remarks (PDF)"), "Q2 2026");
  const html = `
    <a href="https://chevroncorp.gcs-web.com/static-files/51f2eef1-9ded-40c8-8442-e643a173735c" title="2026 2Q Earnings Release (PDF)">Release</a>
    <a href="https://chevroncorp.gcs-web.com/static-files/d808dc3d-f0be-4b2c-b62b-095f75f1c461"><span>2026 2Q Earnings Conference Call Presentation with Prepared Remarks (PDF)</span></a>
  `;
  const map = parseCvxInvestorsHtml(html, "https://www.chevron.com/investors");
  assert.equal(
    map.get("Q2 2026")?.slides,
    "https://chevroncorp.gcs-web.com/static-files/d808dc3d-f0be-4b2c-b62b-095f75f1c461",
  );
  assert.ok(CVX_KNOWN_QUARTER_DOCS["Q1 2023"]?.slides);
  assert.equal(CVX_KNOWN_QUARTER_DOCS["Q1 2022"]?.slides, null);
});

test("PLTR Q3 2022 stays empty; other quarters use dash Business Update", () => {
  assert.equal(PLTR_KNOWN_QUARTER_DOCS["Q3 2022"]?.slides, null);
  assert.equal(pltrSlidesUrlForLabel("Q3 2022"), null);
  assert.match(pltrSlidesUrlForLabel("Q2 2026") ?? "", /Palantir%20-%20Q2%202026%20Business%20Update\.pdf/);
  assert.match(pltrSlidesUrlForLabel("Q3 2026") ?? "", /Q3%202026/);
});

test("UNH rejects remarks, SEC HTML, and 10-Q as slides", () => {
  assert.equal(unhRejectsAsSlides("https://www.unitedhealthgroup.com/content/dam/uhg/en/investors/unh-q2-2026-remarks.pdf"), true);
  assert.equal(
    unhRejectsAsSlides("https://www.sec.gov/Archives/edgar/data/731766/000073176626000191/uhgearnings_q22026vpower.htm"),
    true,
  );
});
