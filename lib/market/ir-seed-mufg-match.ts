/** MUFG IR: H1/FY slidesYYMM as slides, quarterly highlights as filings. Never speech / databook / Q&A / summary. */

export type MufgQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const ORIGIN = "https://www.mufg.jp";

export const MUFG_IR_PAGES = [
  "https://www.mufg.jp/english/ir/presentation/index.html",
  "https://www.mufg.jp/english/ir/fs/index.html",
] as const;

export function mufgPresentationIndexUrl(jpFyStartYear: number): string {
  return `https://www.mufg.jp/english/ir/presentation/${jpFyStartYear}/index.html`;
}

export function mufgFsIndexUrl(jpFyStartYear: number): string {
  return `https://www.mufg.jp/english/ir/fs/${jpFyStartYear}/index.html`;
}

/** Period-end 2026-03-31 → `2603`. */
export function mufgYmFromPeriodEndYmd(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return `${ymd.slice(2, 4)}${ymd.slice(5, 7)}`;
}

function absMufg(href: string): string {
  if (href.startsWith("http")) return href;
  return `${ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

export function isMufgRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|speech|databook|main_qa|summary\d|risk-adjusted|pressrelease|news-\d|slides\d{5,}/i.test(
    n,
  );
}

export function isMufgIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /mufg\.jp\/dam\/ir\/.+\.pdf/i.test(url) && !isMufgRejected(url);
}

/** H1 (09) and FY (03) only — Q1/Q3 usually have no investor meeting. */
function isMufgSlidesYm(yymm: string): boolean {
  return /^(?:03|09)$/.test(yymm.slice(2));
}

export function parseMufgIrIndexHtml(html: string): Map<string, MufgQuarterDocs> {
  const out = new Map<string, MufgQuarterDocs>();
  const ensure = (yymm: string): MufgQuarterDocs => {
    const cur = out.get(yymm) ?? { slides: null, filings: null };
    out.set(yymm, cur);
    return cur;
  };
  for (const m of html.matchAll(/href="([^"]+slides(\d{4})_en\.pdf)"/gi)) {
    const yymm = m[2] ?? "";
    if (!isMufgSlidesYm(yymm)) continue;
    const url = absMufg(m[1] ?? "");
    if (isMufgRejected(url)) continue;
    ensure(yymm).slides = url;
  }
  for (const m of html.matchAll(/href="([^"]+highlights(\d{4})_en\.pdf)"/gi)) {
    const yymm = m[2] ?? "";
    const url = absMufg(m[1] ?? "");
    if (isMufgRejected(url)) continue;
    ensure(yymm).filings = url;
  }
  return out;
}

export function mergeMufgIndexMaps(maps: readonly Map<string, MufgQuarterDocs>[]): Map<string, MufgQuarterDocs> {
  const out = new Map<string, MufgQuarterDocs>();
  for (const map of maps) {
    for (const [yymm, docs] of map) {
      const cur = out.get(yymm) ?? { slides: null, filings: null };
      if (docs.slides && !cur.slides) cur.slides = docs.slides;
      if (docs.filings && !cur.filings) cur.filings = docs.filings;
      out.set(yymm, cur);
    }
  }
  return out;
}
