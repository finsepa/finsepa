/** Morgan Stanley IR: financial supplement as slides (Q4 Strategic Update when present), earnings release as filings. */

export type MsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const MS_IR = "https://www.morganstanley.com/content/dam/msdotcom/en/about-us-ir";

export function msEarningsReleaseUrl(fq: number, fy: number): string {
  return `${MS_IR}/shareholder/${fq}q${fy}.pdf`;
}

export function msFinancialSupplementUrl(fq: number, fy: number): string {
  return `${MS_IR}/finsup${fq}q${fy}/finsup${fq}q${fy}.pdf`;
}

export function msStrategicUpdateUrl(fy: number): string {
  return `${MS_IR}/shareholder/4q${fy}-strategic-update.pdf`;
}

/** Q4 uses the year-end Strategic Update deck when published; otherwise the financial supplement. */
export function msSlidesUrl(fq: number, fy: number): string {
  return fq === 4 ? msStrategicUpdateUrl(fy) : msFinancialSupplementUrl(fq, fy);
}

export function labelFromMsPdfHref(href: string): string | null {
  const n = decodeURIComponent(href).toLowerCase();
  const m = n.match(/([1-4])q(20\d{2})(?!\d)/i);
  if (!m) return null;
  return `Q${m[1]} ${m[2]}`;
}

export const MS_IR_PAGES = ["https://www.morganstanley.com/about-us-ir/earnings-releases"] as const;

function absMs(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

function isMsRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /\.xls|\.xlsx|fixed[-_\s]*income|transcript|sec\.gov/i.test(n);
}

function isMsSlides(href: string): boolean {
  if (isMsRejected(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  return /strategic-update/i.test(n) || /\/finsup[1-4]q20\d{2}\//i.test(n);
}

function isMsFilings(href: string): boolean {
  if (isMsRejected(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  return /\/shareholder\/[1-4]q20\d{2}\.pdf/i.test(n) && !/strategic-update/i.test(n);
}

/** Parse MS earnings-releases HTML. Prefer Strategic Update over financial supplement for the same quarter. */
export function parseMsEarningsHtml(html: string, pageUrl: string): Map<string, MsQuarterDocs> {
  const out = new Map<string, MsQuarterDocs>();
  const hrefRe = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = absMs((m[1] ?? "").trim(), pageUrl);
    if (!href || !/morganstanley\.com/i.test(href)) continue;
    const label = labelFromMsPdfHref(href);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (isMsSlides(href)) {
      const preferUpdate = /strategic-update/i.test(href);
      if (!cur.slides || (preferUpdate && !/strategic-update/i.test(cur.slides))) cur.slides = href;
    } else if (!cur.filings && isMsFilings(href)) {
      cur.filings = href;
    }
    out.set(label, cur);
  }
  return out;
}

export function mergeMsConstructedQuarterDocs(
  fromHtml: Map<string, MsQuarterDocs>,
  labels: readonly string[],
): Map<string, MsQuarterDocs> {
  const out = new Map(fromHtml);
  for (const label of labels) {
    const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? msSlidesUrl(fq, fy),
      filings: cur.filings ?? msEarningsReleaseUrl(fq, fy),
    });
  }
  return out;
}
