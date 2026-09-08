import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeLillyKnownQuarterDocs,
  parseLillyQuarterlyResultsHtml,
} from "./ir-seed-lilly-match.ts";

test("Lilly quarterly HTML maps press release + presentation by quarter", () => {
  const html = `
    <a href="/events/event-details/q2-2026-earnings-call">Earnings Call</a>
    <a href="/static-files/1ce8d384-21b5-45a4-bafb-b981dc2d5e04" type="application/pdf" title="Q226LillySalesandEarningsPressRelease FINAL.pdf">Press Release</a>
    <a href="/static-files/ab69001c-650b-44f6-b629-309ee33f2335" type="application/pdf" title="Q2 2026 Earnings Call Slides_Final.pdf">Earnings Presentation</a>
    <a href="/static-files/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" title="Q1 2025 Earnings Call Slides.pdf">Earnings Presentation</a>
    <a href="/static-files/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" title="Q125LillySalesandEarningsPressRelease.pdf">Press Release</a>
  `;
  const map = parseLillyQuarterlyResultsHtml(html);
  assert.equal(map.get("Q2 2026")?.filings, "https://investor.lilly.com/static-files/1ce8d384-21b5-45a4-bafb-b981dc2d5e04");
  assert.equal(map.get("Q2 2026")?.slides, "https://investor.lilly.com/static-files/ab69001c-650b-44f6-b629-309ee33f2335");
  assert.equal(map.get("Q1 2025")?.slides, "https://investor.lilly.com/static-files/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(map.get("Q1 2025")?.filings, "https://investor.lilly.com/static-files/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
});

test("Lilly known overlay fills Q2/Q4 2025 when scrape is empty", () => {
  const merged = mergeLillyKnownQuarterDocs(new Map());
  assert.equal(
    merged.get("Q2 2025")?.slides,
    "https://investor.lilly.com/static-files/b7c7e82b-e667-42ba-827c-1faecba3e4c8",
  );
  assert.equal(
    merged.get("Q4 2025")?.filings,
    "https://investor.lilly.com/static-files/f087574c-4046-4711-8a56-402266f2d424",
  );
});
