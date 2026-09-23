/**
 * GSK IR seed — 12-31.
 * GSK calendar FY. Slides=results-slides/presentation; Filings=results-announcement. FY→Q4. Skip transcript/infographic/pipeline/aide-memoire. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type GskQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const GSK_IR_PAGES = [
  "https://www.gsk.com/en-gb/investors/financial-results/",
] as const;

export const GSK_KNOWN_QUARTER_DOCS: Readonly<Record<string, GskQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.gsk.com/media/dxknqpm0/q1-2022-results-slides.pdf",
    filings: "https://www.gsk.com/media/lpjdko1c/q1-2022-announcement.pdf",
  },
  "Q2 2022": {
    slides: "https://www.gsk.com/media/nphn3hkq/gsk-q2-2022-results-presentation.pdf",
    filings: "https://www.gsk.com/media/xmvkaasv/q2-2022-results-announcement.pdf",
  },
  "Q3 2022": {
    slides: "https://www.gsk.com/media/vjqn3bva/q3-2022-results-slides.pdf",
    filings: "https://www.gsk.com/media/ccsbzkzu/q3-2022-results-announcement.pdf",
  },
  "Q4 2022": {
    slides: "https://www.gsk.com/media/hi5lpxae/fy-2022-results-slides.pdf",
    filings: "https://www.gsk.com/media/vhklmn0j/fy-2022-results-announcement.pdf",
  },
  "Q1 2023": {
    slides: "https://www.gsk.com/media/t2ybdfty/q1-2023-slides.pdf",
    filings: "https://www.gsk.com/media/s3mfopyo/q1-2023-results-announcement.pdf",
  },
  "Q2 2023": {
    slides: "https://www.gsk.com/media/qj3jkaxb/q2-2023-results-slides.pdf",
    filings: "https://www.gsk.com/media/zxeosnt1/q2-2023-results-announcement.pdf",
  },
  "Q3 2023": {
    slides: "https://www.gsk.com/media/fh4lufpq/q3-2023-results-slides.pdf",
    filings: "https://www.gsk.com/media/zi5n51yc/q3-2023_31-october_final.pdf",
  },
  "Q4 2023": {
    slides: "https://www.gsk.com/media/afnjlfik/fy-2023-results-slides.pdf",
    filings: "https://www.gsk.com/media/ojjdqldk/fy-2023-results-announcement.pdf",
  },
  "Q1 2024": {
    slides: "https://www.gsk.com/media/eocnf2ev/q1-2024-results-slides.pdf",
    filings: "https://www.gsk.com/media/2r3hmcsz/q1-2024-results-announcement.pdf",
  },
  "Q2 2024": {
    slides: "https://www.gsk.com/media/415hf5nq/q2-2024-results-slides.pdf",
    filings: "https://www.gsk.com/media/3l1n3kdv/q2-2024-results-announcement.pdf",
  },
  "Q3 2024": {
    slides: "https://www.gsk.com/media/yuxiujyf/q3-2024-results-slides.pdf",
    filings: "https://www.gsk.com/media/ymchlx2f/q3-2024-results-announcement.pdf",
  },
  "Q4 2024": {
    slides: "https://www.gsk.com/media/asvfvwfb/fy-2024-results-slides.pdf",
    filings: "https://www.gsk.com/media/slrhnzie/fy-2024-results-announcement.pdf",
  },
  "Q1 2025": {
    slides: "https://www.gsk.com/media/2wbbvd1o/q1-2025-results-slides.pdf",
    filings: "https://www.gsk.com/media/lwfjtr0d/q1-2025-results-announcement.pdf",
  },
  "Q2 2025": {
    slides: "https://www.gsk.com/media/fonb14xu/q2-2025-results-slides.pdf",
    filings: "https://www.gsk.com/media/zhfdbsly/q2-2025-results-announcement.pdf",
  },
  "Q3 2025": {
    slides: "https://www.gsk.com/media/0qfjbtd3/q3-2025-results-slides.pdf",
    filings: "https://www.gsk.com/media/snycbnpn/q3-2025-results-announcement.pdf",
  },
  "Q4 2025": {
    slides: "https://www.gsk.com/media/dw1naofi/fy-2025-results-slides.pdf",
    filings: "https://www.gsk.com/media/g0lnid23/fy-2025-results-announcement.pdf",
  },
  "Q1 2026": {
    slides: "https://www.gsk.com/media/5qjlbu5u/q1-2026-results-slides.pdf",
    filings: "https://www.gsk.com/media/hpgfxwxv/q1-2026-results-announcement.pdf",
  },
  "Q2 2026": {
    slides: "https://www.gsk.com/media/nr3p1a3f/q2-2026-results-and-accelerate-growth-slides.pdf",
    filings: "https://www.gsk.com/media/jayh41pz/q2-2026-results-announcement.pdf",
  },
};

export function isGskRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|infographic|pipeline|aide.?memoire|usd.?translation/i.test(n);
}

export function isGskIrPdf(href: string | null | undefined): boolean {
  if (!href || isGskRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.gsk.com" || host.endsWith(".gsk.com"))) return false;
    if (!(u.pathname.includes("/media/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeGskKnownQuarterDocs(): Map<string, GskQuarterDocs> {
  return new Map(Object.entries(GSK_KNOWN_QUARTER_DOCS));
}
