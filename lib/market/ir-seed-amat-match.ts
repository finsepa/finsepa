/** Applied Materials IR static-files: earnings presentation vs Exhibit 99.1 news release. */

export type AmatQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const IR = "https://ir.appliedmaterials.com";

function staticFiles(uuid: string): string {
  return `${IR}/static-files/${uuid}`;
}

const ORDINALS = ["first", "second", "third", "fourth"] as const;

export function amatNewsReleasePageUrls(fq: number, fy: number): string[] {
  const ord = ORDINALS[fq - 1];
  if (!ord) return [];
  const slugs = [
    `applied-materials-announces-${ord}-quarter-${fy}-results`,
    `applied-materials-announces-${ord}-quarter-fiscal-${fy}-results`,
  ];
  if (fq === 4) {
    slugs.push(`applied-materials-announces-fourth-quarter-and-fiscal-year-${fy}-results`);
    slugs.push(`applied-materials-announces-fourth-quarter-and-fiscal-year-${fy}-financial-results`);
  }
  const hosts = [IR, "https://investor.appliedmaterials.com"];
  return hosts.flatMap((host) => slugs.map((s) => `${host}/news-releases/news-release-details/${s}`));
}

/**
 * Exhibit 99.1 earnings-release PDFs on ir.appliedmaterials.com (not Form 8-K wrappers).
 * Slides stay on the quarterly-results GCS decks already locked in the vault.
 */
export const AMAT_KNOWN_QUARTER_DOCS: Readonly<Record<string, AmatQuarterDocs>> = {
  "Q3 2026": { slides: null, filings: staticFiles("425ac634-4ee7-4c41-a07f-fa9e3c42b797") },
  "Q2 2026": { slides: null, filings: staticFiles("c02d8253-7dc3-44d3-a9a9-29d07fb26f17") },
  "Q1 2026": { slides: null, filings: staticFiles("a14b7e94-2685-440a-a78a-c48055b00603") },
  "Q4 2025": { slides: null, filings: staticFiles("4d09885a-c580-4dc7-b04e-c9513ab03206") },
  "Q3 2025": { slides: null, filings: staticFiles("94d3e098-fe9d-4dbb-8156-b7d40bbc3886") },
  "Q2 2025": { slides: null, filings: staticFiles("922a36db-833e-4b7d-9000-ce2f24b247d3") },
  "Q1 2025": { slides: null, filings: staticFiles("990f4e72-eee7-489b-ab19-d6b53022da7c") },
  "Q4 2024": { slides: null, filings: staticFiles("73124a2b-0b7e-4bf0-a940-513593ab3f63") },
  "Q3 2024": { slides: null, filings: staticFiles("714b37fd-43cb-413a-afba-6c5eb678d1e6") },
  "Q2 2024": { slides: null, filings: staticFiles("04ab465b-af2f-4f03-a7f0-d313b7d84453") },
  "Q1 2024": { slides: null, filings: staticFiles("736393f3-a154-4e1b-a3c1-33bbfed1673c") },
  "Q4 2023": { slides: null, filings: staticFiles("cbc64d18-2424-458e-aff6-ef3f74926bff") },
  "Q3 2023": { slides: null, filings: staticFiles("526d2c55-cdbd-45bd-906a-43bc4f17b528") },
  "Q2 2023": { slides: null, filings: staticFiles("55fd56b6-e672-4bc1-9729-8457dc99aab4") },
  "Q1 2023": { slides: null, filings: staticFiles("6812cb49-57b2-40ed-b32e-11e16a31e7de") },
  "Q3 2022": { slides: null, filings: staticFiles("04a54b50-a4a3-449b-86a2-424c9b84f6cf") },
  "Q2 2022": { slides: null, filings: staticFiles("6166446d-9ce8-4594-bf93-57b6c715641e") },
  "Q1 2022": { slides: null, filings: staticFiles("df9d88ad-6457-4161-b3e0-9f51e598b0c5") },
};

export function mergeAmatKnownQuarterDocs(fromHtml: Map<string, AmatQuarterDocs>): Map<string, AmatQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(AMAT_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

function absAmat(href: string, pageUrl: string): string | null {
  try {
    return new URL(href, pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

function quarterFromAmatPageText(text: string): string | null {
  const t = text.replace(/\s+/g, " ");
  const m =
    t.match(/\b(first|second|third|fourth)\s+quarter(?:\s+and\s+fiscal\s+year)?\s+(\d{4})\b/i) ??
    t.match(/\bQ([1-4])\s+20(\d{2})\b/i);
  if (!m) return null;
  if (m[1]!.length === 1) return `Q${m[1]} 20${m[2]}`;
  const fq = { first: 1, second: 2, third: 3, fourth: 4 }[m[1]!.toLowerCase()];
  if (!fq) return null;
  return `Q${fq} ${m[2]}`;
}

function looksLikeAmatNewsRelease(context: string): boolean {
  const c = context.toLowerCase();
  if (/presentation|slides?|deck|script|form\s*8-k|8-k\b|10-q|10-k|snapshot|reconciliation/i.test(c)) {
    return false;
  }
  return /news\s*release|press\s*release|exhibit\s*99\.?\s*1|earnings\s*release/i.test(c);
}

function looksLikeAmatDeck(context: string): boolean {
  return /earnings\s*(call\s*)?(presentation|slides?|deck)/i.test(context);
}

/**
 * Parse a news-release detail page: page title names the quarter, Exhibit 99.1 is filings.
 */
export function parseAmatNewsReleaseHtml(html: string, pageUrl: string): Map<string, AmatQuarterDocs> {
  const out = new Map<string, AmatQuarterDocs>();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ") ?? "";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ") ?? "";
  const label = quarterFromAmatPageText(`${title} ${h1}`);
  if (!label) return out;

  const anchorRe = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const href = absAmat((m[2] ?? "").replace(/&amp;/g, "&"), pageUrl);
    if (!href || !/\/static-files\/[a-f0-9-]{36}/i.test(href)) continue;
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const linkTitle = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const context = `${linkTitle} ${inner}`;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.filings && looksLikeAmatNewsRelease(context)) cur.filings = href;
    else if (!cur.slides && looksLikeAmatDeck(context)) cur.slides = href;
    out.set(label, cur);
  }
  return out;
}

/** Quarterly-results GCS HTML: "News Release" / "Earnings Presentation" next to a quarter label. */
export function parseAmatQuarterlyResultsHtml(html: string, pageUrl: string): Map<string, AmatQuarterDocs> {
  const out = new Map<string, AmatQuarterDocs>();
  const anchorRe = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const href = absAmat((m[2] ?? "").replace(/&amp;/g, "&"), pageUrl);
    if (!href || !/\/static-files\/[a-f0-9-]{36}/i.test(href)) continue;
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const linkTitle = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const context = `${linkTitle} ${inner}`;
    const label = quarterFromAmatPageText(context);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.filings && looksLikeAmatNewsRelease(context)) cur.filings = href;
    else if (!cur.slides && looksLikeAmatDeck(context)) cur.slides = href;
    out.set(label, cur);
  }
  return out;
}
