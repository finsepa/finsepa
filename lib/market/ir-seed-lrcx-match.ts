/** Lam Research IR: quarterly earnings slides under investor.lamresearch.com/image/. June FY. */

export type LrcxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const IMAGE = "https://investor.lamresearch.com/image";

function img(file: string): string {
  return `${IMAGE}/${file}`;
}

/**
 * Verified first-party slide PDFs from investor.lamresearch.com/quarterly-results.
 * Fiscal labels match the vault (June year-end: June = Q4, March = Q3, Dec = Q2, Sep = Q1).
 * Do not lock Exhibit 99.1 press PDFs, 10-Q/10-K QuoteMedia, or dilution notes.
 */
export const LRCX_KNOWN_QUARTER_DOCS: Readonly<Record<string, LrcxQuarterDocs>> = {
  "Q4 2026": { slides: img("Q4_2026_slides_full_final.pdf"), filings: null },
  "Q3 2026": { slides: img("MarQ26_slides_Full_Final.pdf"), filings: null },
  "Q2 2026": { slides: img("DecQ25+Earnings+slides+full+FINAL.pdf"), filings: null },
  "Q1 2026": { slides: img("QSep25+Earnings+Slides+full+FINAL.pdf"), filings: null },
  "Q4 2025": { slides: img("QJun25+Earnings+Slides+full+final.pdf"), filings: null },
  "Q3 2025": { slides: img("QMar+25+full+final+slides+4-22-25.pdf"), filings: null },
  "Q2 2025": { slides: img("QDec24+slide+full+1-29-25+full+FINAL.pdf"), filings: null },
  "Q1 2025": { slides: img("QSep24+slide+deck+full+.pdf"), filings: null },
  "Q4 2024": { slides: img("QJune24+slides+full+final+1.pdf"), filings: null },
  "Q3 2024": { slides: img("QMar24_slides_full_final.pdf"), filings: null },
  "Q2 2024": { slides: img("QDec23%20Earnings%20Slides%20full%20final.pdf"), filings: null },
  "Q1 2024": { slides: img("Sep%20Qtr%20slides%20full%20final.pdf"), filings: null },
  "Q4 2023": { slides: img("Final+Jun+23+slide+deck.pdf"), filings: null },
  "Q3 2023": { slides: img("04.19.23+full+deck+final+.pdf"), filings: null },
  "Q2 2023": { slides: img("QDec+earning+slides+FINAL_v2.pdf"), filings: null },
  "Q1 2023": { slides: "https://investor.lamresearch.com/image/QSep22-Earnings-Slides.pdf", filings: null },
  "Q4 2022": { slides: img("QJun22+Earnings+Slides+combined+v6+web.pdf"), filings: null },
  "Q3 2022": { slides: img("04-19+-+March+earnings_v5.pdf"), filings: null },
};

export const LRCX_IR_PAGES = ["https://investor.lamresearch.com/quarterly-results"] as const;

export function mergeLrcxKnownQuarterDocs(fromHtml: Map<string, LrcxQuarterDocs>): Map<string, LrcxQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(LRCX_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: known.slides ?? cur.slides,
      filings: known.filings ?? cur.filings,
    });
  }
  return out;
}

/** Map IR calendar quarter name + year to vault fiscal label (June FY-end). */
export function lrcxFiscalLabelFromCalendarQuarter(month: string, year: number): string | null {
  const m = month.trim().toLowerCase();
  if (m.startsWith("mar")) return `Q3 ${year}`;
  if (m.startsWith("jun")) return `Q4 ${year}`;
  if (m.startsWith("sep")) return `Q1 ${year + 1}`;
  if (m.startsWith("dec")) return `Q2 ${year + 1}`;
  return null;
}

function isLrcxRejectedPdf(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return (
    /exhibit_99|exhibit-99|press\s*release|10-q|10-k|quotemedia|dilution|sec\.gov/i.test(n)
  );
}

function isLrcxSlidesPdf(href: string, context: string): boolean {
  if (isLrcxRejectedPdf(href)) return false;
  const n = decodeURIComponent(href).replace(/\+/g, " ").toLowerCase();
  if (!/\.pdf(?:$|[?#])/i.test(n) && !/\.pdf(?:$|[?#])/i.test(href)) return false;
  return /slide|deck/i.test(n) || /slide/i.test(context);
}

function absLrcx(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/** Parse quarterly-results HTML: aria-label "Slides for March Quarter 2026". */
export function parseLrcxQuarterlyResultsHtml(html: string, pageUrl: string): Map<string, LrcxQuarterDocs> {
  const out = new Map<string, LrcxQuarterDocs>();
  const re =
    /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? "";
    const hrefRaw = (m[2] ?? "").replace(/&amp;/g, "&").trim();
    const aria = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const context = `${aria} ${inner}`;
    if (!/slide/i.test(context) && !/slide|deck/i.test(hrefRaw)) continue;
    const href = absLrcx(hrefRaw, pageUrl);
    if (!href || !isLrcxSlidesPdf(href, context)) continue;
    const cal = context.match(
      /\b(March|June|September|December)\s+Quarter\s+(\d{4})\b/i,
    );
    if (!cal) continue;
    const label = lrcxFiscalLabelFromCalendarQuarter(cal[1]!, Number(cal[2]));
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides) cur.slides = href;
    out.set(label, cur);
  }
  return out;
}
