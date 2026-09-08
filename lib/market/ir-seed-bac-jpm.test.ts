import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyBacCloudfrontUrl,
  extractBacCloudfrontPdfUrls,
  parseBacQuarterFromFilename,
} from "./ir-seed-bac-match.ts";
import {
  buildJpmCorpQPdfUrl,
  classifyJpmQuarterlyPdf,
  isJpmTranscriptPdfUrl,
  jpmQuarterOrdinal,
  mergeJpmKnownQuarterDocs,
  parseJpmIrHtmlForQuarterDocs,
  parseJpmQuarterFromDamPath,
} from "./ir-seed-jpm-match.ts";
import { mergeTcehyKnownQuarterDocs, parseTencentResultsHtml } from "./ir-seed-tcehy-match.ts";

test("parseBacQuarterFromFilename reads 1Q22 / 2Q26", () => {
  assert.deepEqual(
    parseBacQuarterFromFilename(
      "https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/presentation/1Q22+Presentation+Materials.pdf",
    ),
    { fq: 1, fy: 2022 },
  );
  assert.deepEqual(
    parseBacQuarterFromFilename(
      "https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/earnings_release/2Q26+Press+Release.pdf",
    ),
    { fq: 2, fy: 2026 },
  );
});

test("classifyBacCloudfrontUrl separates presentation vs earnings_release", () => {
  assert.equal(
    classifyBacCloudfrontUrl(
      "https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/presentation/1Q22+Presentation+Materials.pdf",
    ),
    "slides",
  );
  assert.equal(
    classifyBacCloudfrontUrl(
      "https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/earnings_release/1Q22+Press+Release.pdf",
    ),
    "filings",
  );
  assert.equal(
    classifyBacCloudfrontUrl(
      "https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/presentation/1Q22+Transcript.pdf",
    ),
    null,
  );
});

test("extractBacCloudfrontPdfUrls dedupes bankofamerica cloudfront PDFs", () => {
  const html = `
    <a href="https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/presentation/1Q22+Presentation+Materials.pdf">a</a>
    <a href="https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/presentation/1Q22+Presentation+Materials.pdf">b</a>
    <a href="https://example.com/other.pdf">c</a>`;
  assert.deepEqual(extractBacCloudfrontPdfUrls(html), [
    "https://d1io3yog0oux5.cloudfront.net/bankofamerica/files/presentation/1Q22+Presentation+Materials.pdf",
  ]);
});

test("buildJpmCorpQPdfUrl uses Nth-quarter + corp-q path", () => {
  assert.equal(jpmQuarterOrdinal(3), "3rd");
  assert.equal(
    buildJpmCorpQPdfUrl(1, 2026),
    "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/1st-quarter/corp-q1-2026.pdf",
  );
  assert.equal(
    buildJpmCorpQPdfUrl(3, 2025),
    "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2025/3rd-quarter/corp-q3-2025.pdf",
  );
  assert.equal(buildJpmCorpQPdfUrl(5, 2025), null);
});

test("parseJpmQuarterFromDamPath + classify never treats transcript as docs", () => {
  const path =
    "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/2Q26-earnings-transcript.pdf";
  assert.deepEqual(parseJpmQuarterFromDamPath(path), { fq: 2, fy: 2026 });
  assert.equal(classifyJpmQuarterlyPdf(path, "2Q26 Earnings Transcript"), null);
  assert.equal(
    classifyJpmQuarterlyPdf(
      "https://www.jpmorganchase.com/content/dam/jpmc/.../6cded9fd.pdf",
      "2Q26 Earnings Press Release",
    ),
    "filings",
  );
  assert.equal(
    classifyJpmQuarterlyPdf(
      "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/corp-q2-2026.pdf",
      "",
    ),
    "slides",
  );
});

test("parseJpmIrHtmlForQuarterDocs maps press release + presentation by FY", () => {
  const html = `
    <a aria-label="2Q26 Earnings Press Release View document"
       href="/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/press.pdf">x</a>
    <a aria-label="2Q26 Earnings Presentation View document"
       href="/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/deck.pdf">y</a>
    <a aria-label="2Q22 Earnings Presentation View document"
       href="/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2022/2nd-quarter/old.pdf">z</a>`;
  const map = parseJpmIrHtmlForQuarterDocs(html);
  assert.equal(
    map.get("Q2 2026")?.filings,
    "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/press.pdf",
  );
  assert.equal(
    map.get("Q2 2026")?.slides,
    "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/deck.pdf",
  );
  // Year must come from path — 2022 deck stays on 2022.
  assert.equal(
    map.get("Q2 2022")?.slides?.includes("/2022/2nd-quarter/"),
    true,
  );
});

test("parseTencentResultsHtml maps presentation + releases by quarter heading", () => {
  const html = `
    <h2>Tencent Announces 2026 Second Quarter Results</h2>
    <a href="https://www.tencent.com/wp-content/uploads/2026/08/Tencent-Announces-2026-Second-Quarter-Results.pdf">
      <span class="link-text">Earnings Releases</span>
    </a>
    <a href="https://static.www.tencent.com/website-2026-upload/2Q26-earnings-PPT.pdf">
      <span class="link-text">Earnings Presentation</span>
    </a>
    <h3>Tencent Announces 2025 Annual and Fourth Quarter Results</h3>
    <a href="https://static.www.tencent.com/uploads/2026/03/18/release.pdf">
      <span class="link-text">Earnings Releases</span>
    </a>
    <a href="https://static.www.tencent.com/uploads/2026/03/18/ppt.pdf">
      <span class="link-text">Earnings Presentation</span>
    </a>`;
  const map = parseTencentResultsHtml(html);
  assert.equal(
    map.get("Q2 2026")?.slides,
    "https://static.www.tencent.com/website-2026-upload/2Q26-earnings-PPT.pdf",
  );
  assert.equal(
    map.get("Q2 2026")?.filings,
    "https://www.tencent.com/wp-content/uploads/2026/08/Tencent-Announces-2026-Second-Quarter-Results.pdf",
  );
  assert.equal(map.get("Q4 2025")?.slides, "https://static.www.tencent.com/uploads/2026/03/18/ppt.pdf");
});

test("JPM known overlay fills hashed DAM docs and merge does not overwrite scrape", () => {
  assert.equal(isJpmTranscriptPdfUrl("https://example.com/1q26-earnings-transcript.pdf"), true);
  assert.equal(isJpmTranscriptPdfUrl("https://example.com/corp-q1-2026.pdf"), false);

  const scraped = new Map([
    ["Q3 2024", { slides: "https://example.com/scraped-slides.pdf", filings: null }],
  ]);
  const merged = mergeJpmKnownQuarterDocs(scraped);
  assert.equal(merged.get("Q3 2024")?.slides, "https://example.com/scraped-slides.pdf");
  assert.ok(merged.get("Q3 2024")?.filings?.includes("66269bb6-ecc5-4172-b461-6b7e7cd47aab.pdf"));
  assert.ok(merged.get("Q1 2026")?.slides?.endsWith("corp-q1-2026.pdf"));
});

test("Tencent known overlay fills 2022–2024 when scrape is empty", () => {
  const merged = mergeTcehyKnownQuarterDocs(new Map());
  assert.ok(merged.get("Q1 2022")?.slides?.includes("1501a739addd20a382dadeda55b3a7aa.pdf"));
  assert.ok(merged.get("Q4 2024")?.filings?.includes("81cb1f36bec218d27d6e0b24eec012b6.pdf"));
  assert.equal(merged.get("Q2 2024")?.slides, null);
});
