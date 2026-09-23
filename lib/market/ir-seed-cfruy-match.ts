/**
 * Richemont ADR (CFRUY) IR — calendar quarter keys (March FY mapped upstream).
 * Slides = EN results/sales presentation; Filings = ad-hoc press PDF.
 * Never transcript / annual report / FR duplicate / SEC HTML.
 */

export type CfruyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CFRUY_IR_PAGES = [
  "https://www.richemont.com/investors/results-reports-presentations/",
] as const;

/** Catalog Q1 2022 → Q2 2026 (calendar labels after March-FY mapping). */
export const CFRUY_KNOWN_QUARTER_DOCS: Readonly<Record<string, CfruyQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://www.richemont.com/media/h12nx3lz/richemont-fy27-q1-sales-presentation-en.pdf",
    filings: "https://www.richemont.com/media/xikaciqj/ad-hoc-announcement-pursuant-to-art-53-lr-fy27-q1-sales-en.pdf",
  },
  "Q1 2026": {
    slides: "https://www.richemont.com/media/ngtd2kgn/richemont-fy26-annual-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/ovfnkffy/ad-hoc-announcement-pursuant-to-art-53-lr-fy26-annual-results-en.pdf",
  },
  "Q4 2025": {
    slides: "https://www.richemont.com/media/n3hhsz50/richemont-fy26-q3-sales-presentation-en.pdf",
    filings: "https://www.richemont.com/media/ljtfis42/ad-hoc-announcement-pursuant-to-art-53-lr-fy26-q3-sales-en.pdf",
  },
  "Q3 2025": {
    slides: "https://www.richemont.com/media/2wgjx0p3/richemont-fy26-interim-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/ugsfheuv/ad-hoc-announcement-pursuant-to-art-53-lr-fy26-interim-results-en.pdf",
  },
  "Q2 2025": {
    slides: "https://www.richemont.com/media/npanhckb/richemont-fy26-q1-sales-presentation-en.pdf",
    filings: "https://www.richemont.com/media/0m0imznf/ad-hoc-announcement-pursuant-to-art-53-lr-fy26-q1-sales-for-the-first-quarter-ended-30-june-2025.pdf",
  },
  "Q1 2025": {
    slides: "https://www.richemont.com/media/nptj0zrk/richemont-fy25-annual-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/q2ugvbo1/ad-hoc-announcement-pursuant-to-art-53-lr-fy25-annual-results-en.pdf",
  },
  "Q4 2024": {
    slides: "https://www.richemont.com/media/p1zlvmwh/richemont-fy25-q3-sales-presentation-en.pdf",
    filings: "https://www.richemont.com/media/hqsguwxq/ad-hoc-announcement-pursuant-to-art-53-lr-fy25-q3-sales-en.pdf",
  },
  "Q3 2024": {
    slides: "https://www.richemont.com/media/d20d21h1/richemont-fy25-interim-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/5hibkj00/ad-hoc-announcement-pursuant-to-art-53-lr-fy25-interim-results-en.pdf",
  },
  "Q2 2024": {
    slides: "https://www.richemont.com/media/skuh20h5/richemont-fy25-q1-sales-presentation-en.pdf",
    filings: "https://www.richemont.com/media/iljbpjkt/ad-hoc-announcement-pursuant-to-art-53-lr-fy25-q1-sales-for-the-first-quarter-ended-30-june-2024.pdf",
  },
  "Q1 2024": {
    slides: "https://www.richemont.com/media/315psstb/richemont-fy24-annual-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/cjcf3n3c/ad-hoc-announcement-pursuant-to-art-53-lr-fy24-annual-results-en.pdf",
  },
  "Q4 2023": {
    slides: "https://www.richemont.com/media/mwtdoug3/richemont-fy24-q3-trading-update-presentation-en.pdf",
    filings: "https://www.richemont.com/media/a3qfsf55/ad-hoc-announcement-pursuant-to-art-53-lr-fy24-q3-trading-update-en.pdf",
  },
  "Q3 2023": {
    slides: "https://www.richemont.com/media/mugk3ieo/richemont-fy24-interim-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/elfp1h03/ad-hoc-announcement-pursuant-to-art-53-lr-fy24-interim-results-en.pdf",
  },
  "Q2 2023": {
    slides: "https://www.richemont.com/media/oxvnnygv/q1-24-trading-update-presentation.pdf",
    filings: "https://www.richemont.com/media/vlqpgz4b/ad-hoc-announcement-pursuant-to-art-53-lr-fy24-q1-trading-update-en.pdf",
  },
  "Q1 2023": {
    slides: "https://www.richemont.com/media/3jpfzwih/richemont-fy23-annual-results-presentation-en.pdf",
    filings: "https://www.richemont.com/media/5yyhfjqn/2023-05-12-en.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://www.richemont.com/media/uwlpckry/ad-hoc-announcement-pursuant-to-art-53-lr-trading-update-fy23-q3-en-2.pdf",
  },
  "Q3 2022": {
    slides: "https://www.richemont.com/media/auiekb3h/richemont-fy23-interim-results-presentation-en-1.pdf",
    filings: "https://www.richemont.com/media/jalk3tuv/ad-hoc-announcement-pursuant-to-art-53-lr-fy23-interim-results-en.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://www.richemont.com/media/fnzpraik/ad-hoc-announcement-pursuant-to-art-53-lr-trading-update-for-the-first-quarter-ended-30-june-2022-3-1.pdf",
  },
  "Q1 2022": {
    slides: "https://www.richemont.com/media/3tpjbsyy/richemont-fy22-annual-results-presentation-en-1.pdf",
    filings: "https://www.richemont.com/media/ehcjuas2/ad-hoc-announcement-pursuant-to-art-53-lr-fy22-annual-results-en-2.pdf",
  },
};

export function isCfruyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|proxy|transcript|annual[-_\s]*report|interim[-_\s]*report|group[-_\s]*snapshot|fr\.pdf|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isCfruyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.richemont.com" || host === "richemont.com" || host.endsWith(".richemont.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isCfruyRejected(url);
  } catch {
    return false;
  }
}

export function mergeCfruyKnownQuarterDocs(): Map<string, CfruyQuarterDocs> {
  return new Map(Object.entries(CFRUY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
