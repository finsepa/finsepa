/**
 * Parse ASML quarterly financial-results HTML for presentation + press-release PDFs.
 */

export function parseAsmlQuarterResultsHtml(html: string): {
  slides: string | null;
  filings: string | null;
} {
  const pdfs = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.pdf/gi)].map((m) =>
    m[0]!.replace(/&amp;/g, "&").split("#")[0]!,
  );
  const uniq = [...new Set(pdfs)];

  const scoreSlides = (u: string): number => {
    const n = decodeURIComponent(u).toLowerCase();
    if (!n.endsWith(".pdf")) return -1;
    if (/presentation-investor-relations|presentation.?investor.?relations|investor-relations-q/i.test(n)) {
      return 900;
    }
    if (/presentation/i.test(n) && !/press.?conference|transcript|video/i.test(n)) return 700;
    return -1;
  };

  const scoreFilings = (u: string): number => {
    const n = decodeURIComponent(u).toLowerCase();
    if (!n.endsWith(".pdf")) return -1;
    if (/press[-_ ]?release/i.test(n)) return 900;
    if (/financial[-_ ]?statements[-_ ]?us[-_ ]?gaap/i.test(n)) return 600;
    return -1;
  };

  let bestSlides: string | null = null;
  let bestSlidesScore = 0;
  let bestFilings: string | null = null;
  let bestFilingsScore = 0;
  for (const u of uniq) {
    const s = scoreSlides(u);
    if (s > bestSlidesScore) {
      bestSlidesScore = s;
      bestSlides = u;
    }
    const f = scoreFilings(u);
    if (f > bestFilingsScore) {
      bestFilingsScore = f;
      bestFilings = u;
    }
  }
  return { slides: bestSlides, filings: bestFilings };
}

export function asmlQuarterResultsPageUrl(fq: number, fy: number): string {
  return `https://www.asml.com/en/investors/financial-results/q${fq}-${fy}`;
}
