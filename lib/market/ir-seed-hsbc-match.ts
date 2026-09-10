/**
 * HSBC Holdings: “Presentation to Investors and Analysts” as slides.
 * Q1/Q3 = trading updates; Q2 = Interim; Q4 = Annual. Never transcripts, data packs, media releases, or 6-K HTML.
 */

export type HsbcQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const FILES = "https://www.hsbc.com/-/files/hsbc/investors/hsbc-results";

function pres(year: number, bucket: "1q" | "3q" | "interim" | "annual", file: string): string {
  return `${FILES}/${year}/${bucket}/pdfs/hsbc-holdings-plc/${file}`;
}

export const HSBC_KNOWN_QUARTER_DOCS: Readonly<Record<string, HsbcQuarterDocs>> = {
  "Q2 2026": {
    slides: pres(
      2026,
      "interim",
      "260804-hsbc-holdings-plc-interim-results-2026-presentation-to-investors-and-analysts.pdf",
    ),
    filings: null,
  },
  "Q1 2026": {
    slides: pres(2026, "1q", "260505-1q-2026-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q4 2025": {
    slides: pres(2025, "annual", "260225-annual-results-2025-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q3 2025": {
    slides: pres(2025, "3q", "251028-3q-2025-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q2 2025": {
    slides: pres(
      2025,
      "interim",
      "250730-hsbc-holdings-plc-interim-results-2025-presentation-to-investors-and-analysts.pdf",
    ),
    filings: null,
  },
  "Q1 2025": {
    slides: pres(2025, "1q", "250429-1q-2025-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q4 2024": {
    slides: pres(2024, "annual", "250219-annual-results-2024-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q3 2024": {
    slides: pres(2024, "3q", "241029-3q-2024-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q2 2024": {
    slides: pres(2024, "interim", "240731-interim-results-2024-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q1 2024": {
    slides: pres(2024, "1q", "240430-1q-2024-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q4 2023": {
    slides: pres(2023, "annual", "240221-annual-results-2023-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q3 2023": {
    slides: pres(2023, "3q", "231030-3q-2023-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q2 2023": {
    slides: pres(2023, "interim", "230801-interim-results-2023-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q1 2023": {
    slides: pres(2023, "1q", "230502-1q-2023-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q4 2022": {
    slides: pres(2022, "annual", "230228-annual-results-2022-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q3 2022": {
    slides: pres(2022, "3q", "221025-3q-2022-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q2 2022": {
    slides: pres(2022, "interim", "220801-interim-results-2022-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
  "Q1 2022": {
    slides: pres(2022, "1q", "220426-1q-2022-presentation-to-investors-and-analysts.pdf"),
    filings: null,
  },
};

export const HSBC_IR_PAGES = [
  "https://www.hsbc.com/investors/results-and-announcements",
  "https://www.hsbc.com/investors/results-and-announcements/all-reporting/group",
] as const;

export function mergeHsbcKnownQuarterDocs(fromHtml: Map<string, HsbcQuarterDocs>): Map<string, HsbcQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(HSBC_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

export function labelFromHsbcPresentationHref(href: string): string | null {
  const n = decodeURIComponent(href);
  const m = n.match(/\/hsbc-results\/(\d{4})\/(1q|3q|interim|annual)\//i);
  if (!m) return null;
  const year = Number(m[1]);
  const bucket = m[2]!.toLowerCase();
  if (bucket === "1q") return `Q1 ${year}`;
  if (bucket === "3q") return `Q3 ${year}`;
  if (bucket === "interim") return `Q2 ${year}`;
  if (bucket === "annual") return `Q4 ${year}`;
  return null;
}

function isHsbcRejectedPdf(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return (
    /transcript|fixed-income|chinese|data-pack|media-release|earnings-release|6-k|sec\.gov/i.test(n)
  );
}

function isHsbcSlidesPdf(href: string): boolean {
  if (isHsbcRejectedPdf(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  return /presentation-to-investors-and-analysts\.pdf/i.test(n);
}

function absHsbc(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!.replace(/\?.*$/, "");
  } catch {
    return null;
  }
}

export function parseHsbcResultsHtml(html: string, pageUrl: string): Map<string, HsbcQuarterDocs> {
  const out = new Map<string, HsbcQuarterDocs>();
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = absHsbc((m[1] ?? "").trim(), pageUrl);
    if (!href || !isHsbcSlidesPdf(href)) continue;
    const label = labelFromHsbcPresentationHref(href);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides) cur.slides = href;
    out.set(label, cur);
  }
  return out;
}
