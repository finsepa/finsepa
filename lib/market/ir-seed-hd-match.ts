/** Home Depot IR: earnings-release PDF as filings. No public quarterly slide deck. Never 10-Q, transcripts, infographics, or conference decks. */

export type HdQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const HD_PRESS = "https://ir.homedepot.com/~/media/Files/H/HomeDepot-IR/press-release";

/** Issuer FY ends ~late January (Q1≈May, Q2≈Aug, Q3≈Nov, Q4≈Jan). */
export const HD_FY_END = "01-31";

/**
 * Home Depot IR filenames use the fiscal year that contains the period
 * (Q2 2026 reported Aug 2026), not Jan-FY labels like Q2 2027.
 * Jan period-end → prior calendar year's Q4.
 */
export function hdIrQuarterFromPeriodEndYmd(
  ymd: string | null | undefined,
): { fq: number; fy: number } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  if (m <= 1) return { fq: 4, fy: y - 1 };
  if (m <= 4) return { fq: 1, fy: y };
  if (m <= 7) return { fq: 2, fy: y };
  if (m <= 10) return { fq: 3, fy: y };
  return { fq: 4, fy: y };
}

/** 2022–2024 IR files use `earning-release`; 2025+ use `earnings-release`. */
export function hdPressReleaseUrl(fq: number, fy: number): string {
  const stem = fy >= 2025 ? "earnings-release" : "earning-release";
  return `${HD_PRESS}/q${fq}-${fy}-${stem}.pdf`;
}

export const HD_IR_PAGES = [
  "https://ir.homedepot.com/financial-reports/quarterly-earnings/2026",
  "https://ir.homedepot.com/financial-reports/quarterly-earnings/2025",
  "https://ir.homedepot.com/financial-reports/quarterly-earnings/2024",
  "https://ir.homedepot.com/financial-reports/quarterly-earnings/2023",
  "https://ir.homedepot.com/financial-reports/quarterly-earnings/2022",
] as const;

export function isHdRejectedAsSlides(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|transcript|infographic|non-gaap|investor[-_\s]*conference|webcast/i.test(n)
  );
}

function absHd(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

export function labelFromHdPressHref(href: string): string | null {
  const n = decodeURIComponent(href).toLowerCase();
  const m = n.match(/\/q([1-4])-(\d{4})-earnings?-release\.pdf/i);
  if (!m) return null;
  return `Q${m[1]} ${m[2]}`;
}

/** Parse quarterly-earnings HTML for press-release PDFs only. */
export function parseHdQuarterlyEarningsHtml(html: string, pageUrl: string): Map<string, HdQuarterDocs> {
  const out = new Map<string, HdQuarterDocs>();
  const hrefRe = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = absHd((m[1] ?? "").trim(), pageUrl);
    if (!href || !/homedepot\.com/i.test(href)) continue;
    if (isHdRejectedAsSlides(href)) continue;
    const label = labelFromHdPressHref(href);
    if (!label) continue;
    if (!/press-release\/q[1-4]-\d{4}-earnings?-release\.pdf/i.test(href)) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.filings) cur.filings = href;
    out.set(label, cur);
  }
  return out;
}

export function mergeHdConstructedQuarterDocs(
  fromHtml: Map<string, HdQuarterDocs>,
  labels: readonly string[],
): Map<string, HdQuarterDocs> {
  const out = new Map(fromHtml);
  for (const label of labels) {
    const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: null,
      filings: cur.filings ?? hdPressReleaseUrl(fq, fy),
    });
  }
  return out;
}
