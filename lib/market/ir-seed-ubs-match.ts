/**
 * UBS Group (UBS) IR — calendar FY.
 * Slides = results presentation; Filings = media-release-en (quarterlies DAM)
 * or mr-results-*-en under /content/dam/assets/news/ when quarterlies path 404s.
 * Never fixed-income presentation / quarterly report / transcript / SEC HTML.
 */

export type UbsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const UBS_Q =
  "https://www.ubs.com/content/dam/assets/cc/investor-relations/quarterlies";
const UBS_NEWS = "https://www.ubs.com/content/dam/assets/news";

function qPath(fy: number, fq: number, file: string): string {
  const yy = String(fy).slice(2);
  return `${UBS_Q}/${fy}/${fq}q${yy}/${file}`;
}

export const UBS_IR_PAGES = [
  "https://www.ubs.com/global/en/investor-relations/financial-information/quarterly-reporting.html",
] as const;

/**
 * Catalog: slides + filings for Q1'22–Q2'26.
 * Q3/Q4'22 + Q2'24 filings live under news DAM (verified Range 206).
 */
export const UBS_KNOWN_QUARTER_DOCS: Readonly<Record<string, UbsQuarterDocs>> = {
  "Q2 2026": {
    slides: qPath(2026, 2, "2q26-results-presentation.pdf"),
    filings: qPath(2026, 2, "2q26-media-release-en.pdf"),
  },
  "Q1 2026": {
    slides: qPath(2026, 1, "1q26-results-presentation.pdf"),
    filings: qPath(2026, 1, "1q26-media-release-en.pdf"),
  },
  "Q4 2025": {
    slides: qPath(2025, 4, "4q25-results-presentation.pdf"),
    filings: qPath(2025, 4, "4q25-media-release-en.pdf"),
  },
  "Q3 2025": {
    slides: qPath(2025, 3, "3q25-results-presentation.pdf"),
    filings: qPath(2025, 3, "3q25-media-release-en.pdf"),
  },
  "Q2 2025": {
    slides: qPath(2025, 2, "2q25-results-presentation.pdf"),
    filings: qPath(2025, 2, "2q25-media-release-en.pdf"),
  },
  "Q1 2025": {
    slides: qPath(2025, 1, "1q25-results-presentation.pdf"),
    filings: qPath(2025, 1, "1q25-media-release-en.pdf"),
  },
  "Q4 2024": {
    slides: qPath(2024, 4, "4q24-results-presentation.pdf"),
    filings: qPath(2024, 4, "4q24-media-release-en.pdf"),
  },
  "Q3 2024": {
    slides: qPath(2024, 3, "3q24-results-presentation.pdf"),
    filings: qPath(2024, 3, "3q24-media-release-en.pdf"),
  },
  "Q2 2024": {
    slides: qPath(2024, 2, "2q24-results-presentation.pdf"),
    filings: `${UBS_NEWS}/2024/08/14/20240814-mr-results-2Q24-en.pdf`,
  },
  "Q1 2024": {
    slides: qPath(2024, 1, "1q24-results-presentation.pdf"),
    filings: qPath(2024, 1, "1q24-media-release-en.pdf"),
  },
  "Q4 2023": {
    slides: qPath(2023, 4, "4q23-results-presentation.pdf"),
    filings: qPath(2023, 4, "4q23-media-release-en.pdf"),
  },
  "Q3 2023": {
    slides: qPath(2023, 3, "3q23-results-presentation.pdf"),
    filings: qPath(2023, 3, "3q23-media-release-en.pdf"),
  },
  "Q2 2023": {
    slides: qPath(2023, 2, "2q23-results-presentation.pdf"),
    filings: qPath(2023, 2, "2q23-media-release-en.pdf"),
  },
  "Q1 2023": {
    slides: qPath(2023, 1, "1q23-results-presentation.pdf"),
    filings: qPath(2023, 1, "1q23-media-release-en.pdf"),
  },
  "Q4 2022": {
    slides: qPath(2022, 4, "4q22-results-presentation.pdf"),
    filings: `${UBS_NEWS}/2023/01/31/20230131-mr-results-4q22-en.pdf`,
  },
  "Q3 2022": {
    slides: qPath(2022, 3, "3q22-results-presentation.pdf"),
    filings: `${UBS_NEWS}/2022/10/25/20221025-mr-results-3q22-en.pdf`,
  },
  "Q2 2022": {
    slides: qPath(2022, 2, "2q22-results-presentation.pdf"),
    filings: qPath(2022, 2, "2q22-media-release-en.pdf"),
  },
  "Q1 2022": {
    slides: qPath(2022, 1, "1q22-results-presentation.pdf"),
    filings: qPath(2022, 1, "1q22-media-release-en.pdf"),
  },
};

export function isUbsRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|20-?f|6-?k|fixed[-_\s]*income|quarterly[-_\s]*report|full[-_\s]?report|transcript|webcast|standalone|investor[-_\s]*day|\.xls/i.test(
    n,
  );
}

export function isUbsIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.ubs.com" || host === "ubs.com" || host.endsWith(".ubs.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    const path = u.pathname;
    const pathLower = path.toLowerCase();
    const onQuarterlies = pathLower.includes("/investor-relations/quarterlies/");
    const onNews = pathLower.includes("/assets/news/");
    if (!onQuarterlies && !onNews) return false;
    const ok =
      /results-presentation\.pdf$/i.test(path) ||
      /media-release(?:-en)?\.pdf$/i.test(path) ||
      /mr-results-[^/]*-en\.pdf$/i.test(path);
    return ok && !isUbsRejected(url);
  } catch {
    return false;
  }
}

export function mergeUbsKnownQuarterDocs(): Map<string, UbsQuarterDocs> {
  return new Map(Object.entries(UBS_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
