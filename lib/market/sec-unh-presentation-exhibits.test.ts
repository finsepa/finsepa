import assert from "node:assert/strict";
import test from "node:test";

import {
  isEarningsSlidesPreviewUrl,
  isSecEdgarPresentationExhibitHtml,
} from "./earnings-document-url.ts";
import {
  pickExhibit99PresentationHtmlUrl,
  pickExhibit99PressReleaseHtmlUrl,
} from "./sec-exhibit-html-pick.ts";

const CIK = "731766";
const FLAT = "000073176626000191";

const Q2_INDEX = `
<tr><td>2</td><td><a href="/Archives/edgar/data/731766/${FLAT}/earningsrelease2q26_7152.htm">earningsrelease2q26_7152.htm</a></td><td>EX-99.1</td></tr>
<tr><td>3</td><td><a href="/Archives/edgar/data/731766/${FLAT}/uhgearnings_q22026vpower.htm">uhgearnings_q22026vpower.htm</a></td><td>EX-99.2</td></tr>
`;

const Q1_INDEX = `
<tr><td>2</td><td><a href="/Archives/edgar/data/731766/000073176626000121/earningsrelease1q26press.htm">earningsrelease1q26press.htm</a></td><td>EX-99.1</td></tr>
<tr><td>3</td><td><a href="/Archives/edgar/data/731766/000073176626000121/uhgearningsreleaseq12026.htm">uhgearningsreleaseq12026.htm</a></td><td>EX-99.2</td></tr>
`;

test("UNH Q2: picks vpower EX-99.2 as presentation HTML", () => {
  const slides = pickExhibit99PresentationHtmlUrl(Q2_INDEX, CIK, FLAT);
  assert.ok(slides);
  assert.match(slides, /uhgearnings_q22026vpower\.htm$/i);
  assert.equal(isSecEdgarPresentationExhibitHtml(slides), true);
  assert.equal(isEarningsSlidesPreviewUrl(slides), true);

  const filings = pickExhibit99PressReleaseHtmlUrl(Q2_INDEX, CIK, FLAT);
  assert.ok(filings);
  assert.match(filings, /earningsrelease2q26_7152\.htm$/i);
});

test("UNH Q1: picks uhgearningsreleaseq EX-99.2 despite earningsrelease in name", () => {
  const slides = pickExhibit99PresentationHtmlUrl(Q1_INDEX, CIK, "000073176626000121");
  assert.ok(slides);
  assert.match(slides, /uhgearningsreleaseq12026\.htm$/i);
  assert.equal(isEarningsSlidesPreviewUrl(slides), true);

  const filings = pickExhibit99PressReleaseHtmlUrl(Q1_INDEX, CIK, "000073176626000121");
  assert.ok(filings);
  assert.match(filings, /earningsrelease1q26press\.htm$/i);
});

test("Caterpillar EX-99.2 retail statistics is not an earnings deck", () => {
  const index = `
<tr><td>2</td><td><a href="/Archives/edgar/data/18230/x/ex991toformcat2q2026earnin.htm">ex991toformcat2q2026earnin.htm</a></td><td>EX-99.1</td></tr>
<tr><td>3</td><td><a href="/Archives/edgar/data/18230/x/ex992toformcat2q2026retail.htm">ex992toformcat2q2026retail.htm</a></td><td>EX-99.2</td></tr>
`;
  assert.equal(pickExhibit99PresentationHtmlUrl(index, "18230", "x"), null);
  const filings = pickExhibit99PressReleaseHtmlUrl(index, "18230", "x");
  assert.match(filings ?? "", /ex991toformcat2q2026earnin\.htm$/i);
});

test("Q4-style *992* filename still counts as slides preview", () => {
  const url = "https://www.sec.gov/Archives/edgar/data/731766/000073176626000025/q42025er992.htm";
  assert.equal(isSecEdgarPresentationExhibitHtml(url), true);
  assert.equal(isEarningsSlidesPreviewUrl(url), true);
});
