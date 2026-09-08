/** Meta q4cdn earnings presentation + Exhibit 99.1 / press-release filename variants. */

const META_Q4 = "https://s21.q4cdn.com/399680738/files";
const META_FINANCIALS = `${META_Q4}/doc_financials`;
const META_EARNINGS = `${META_Q4}/doc_earnings`;
const META_NEWS = `${META_Q4}/doc_news`;
const META_DOWNLOADS = `${META_Q4}/doc_downloads`;

function quarterOrdinalWord(fq: 1 | 2 | 3 | 4): "First" | "Second" | "Third" | "Fourth" {
  return fq === 1 ? "First" : fq === 2 ? "Second" : fq === 3 ? "Third" : "Fourth";
}

/** Older decks: `Qn-YYYY_Earnings-Presentation*.pdf`; later: `Earnings-Presentation-Qn-YYYY.pdf`. */
export function metaSlidesCandidates(calendarYear: number, fq: 1 | 2 | 3 | 4): string[] {
  const fin = `${META_FINANCIALS}/${calendarYear}/q${fq}`;
  const earnPres = `${META_EARNINGS}/${calendarYear}/q${fq}/presentation`;
  return [
    `${fin}/Q${fq}-${calendarYear}_Earnings-Presentation_Final.pdf`,
    `${fin}/Q${fq}-${calendarYear}_Earnings-Presentation.pdf`,
    `${fin}/Earnings-Presentation-Q${fq}-${calendarYear}.pdf`,
    `${fin}/Earnings-Presentation-Q${fq}-${calendarYear}-FINAL.pdf`,
    `${fin}/Earnings-Presentation-Q${fq}-${calendarYear}-Final.pdf`,
    `${earnPres}/Earnings-Presentation-Q${fq}-${calendarYear}.pdf`,
  ];
}

/**
 * Filings: Exhibit 99.1 under doc_financials, plus older `doc_news/Meta-Reports-…-Results-….pdf`.
 * Q4 press titles often include “and Full Year” and publish in the next calendar year.
 */
export function metaFilingCandidates(calendarYear: number, fq: 1 | 2 | 3 | 4): string[] {
  const mmdd = fq === 1 ? "03-31" : fq === 2 ? "06-30" : fq === 3 ? "09-30" : "12-31";
  const core = `Meta-${mmdd}-${calendarYear}-Exhibit-99-1`;
  const exhibitDirs = [
    `${META_FINANCIALS}/${calendarYear}/q${fq}`,
    META_DOWNLOADS,
    META_NEWS,
  ];
  const exhibitNames = [
    `${core}-FINAL.pdf`,
    `${core}-Final.pdf`,
    `${core}_final.pdf`,
    `${core}.pdf`,
    `${core}_FINAL.pdf`,
    `${core}_Final.pdf`,
    `${core.replace(/^Meta-/, "META-")}-FINAL.pdf`,
    `${core.replace(/^Meta-/, "META-")}_FINAL.pdf`,
  ];
  const exhibitUrls = exhibitDirs.flatMap((dir) => exhibitNames.map((n) => `${dir}/${n}`));

  const ord = quarterOrdinalWord(fq);
  const newsNames = [
    `Meta-Reports-${ord}-Quarter-${calendarYear}-Results-${calendarYear}.pdf`,
    `Meta-Reports-${ord}-Quarter-${calendarYear}-Results-${calendarYear + 1}.pdf`,
  ];
  if (fq === 4) {
    newsNames.push(
      `Meta-Reports-Fourth-Quarter-and-Full-Year-${calendarYear}-Results-${calendarYear}.pdf`,
      `Meta-Reports-Fourth-Quarter-and-Full-Year-${calendarYear}-Results-${calendarYear + 1}.pdf`,
    );
  }
  const newsUrls = newsNames.map((n) => `${META_NEWS}/${n}`);
  return [...exhibitUrls, ...newsUrls];
}
