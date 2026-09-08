/** Pure Lilly quarterly-results HTML parsing (unit-testable). */

export type LlyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

function absLilly(href: string): string | null {
  const t = href.trim();
  if (!t) return null;
  if (t.startsWith("https://")) return t.split("#")[0]!;
  if (t.startsWith("/static-files/")) return `https://investor.lilly.com${t.split("#")[0]}`;
  return null;
}

function labelFromText(text: string): string | null {
  // Avoid `\b` after YY — filenames like `Q226Lilly...` have no boundary between digits and letters.
  const m =
    text.match(/\bQ([1-4])\s*20(\d{2})(?!\d)/i) ??
    text.match(/\bQ([1-4])\s*['’]?(\d{2})(?!\d)/i) ??
    text.match(/\bQ([1-4])(\d{2})(?!\d)/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const yy = m[2]!.length === 2 ? m[2]! : m[2]!.slice(-2);
  return `Q${fq} 20${yy}`;
}

/**
 * GCS quarterly-results HTML is often JS-only; overlay known static-files UUIDs
 * so archived quarters (e.g. Q2/Q4 2025) still lock when the scrape returns nothing.
 */
export const LLY_KNOWN_QUARTER_DOCS: Readonly<Record<string, LlyQuarterDocs>> = {
  "Q2 2025": {
    slides: "https://investor.lilly.com/static-files/b7c7e82b-e667-42ba-827c-1faecba3e4c8",
    filings: "https://investor.lilly.com/static-files/afdc26aa-05ac-477a-ac41-9c414da09e2f",
  },
  "Q4 2025": {
    slides: "https://investor.lilly.com/static-files/45a92498-43d0-4e2d-a4e6-a9131841cfd6",
    filings: "https://investor.lilly.com/static-files/f087574c-4046-4711-8a56-402266f2d424",
  },
};

/** Live scrape wins; fill any missing slot from the known UUID overlay. */
export function mergeLillyKnownQuarterDocs(fromHtml: Map<string, LlyQuarterDocs>): Map<string, LlyQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(LLY_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

/**
 * Parse Lilly quarterly-results HTML into fiscal-label → slides/filings static-files URLs.
 * Anchors are titled e.g. "Press Release" / "Earnings Presentation".
 */
export function parseLillyQuarterlyResultsHtml(html: string): Map<string, LlyQuarterDocs> {
  const out = new Map<string, LlyQuarterDocs>();
  const anchorRe =
    /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const href = absLilly((m[2] ?? "").replace(/&amp;/g, "&"));
    if (!href || !/\/static-files\/[a-f0-9-]{36}/i.test(href)) continue;
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const blob = `${title} ${inner}`;
    const label = labelFromText(blob);
    if (!label) continue;

    const cur = out.get(label) ?? { slides: null, filings: null };
    if (/press\s*release|pressrelease|sales\s*and\s*earnings|salesandearnings/i.test(blob) && !cur.filings) {
      cur.filings = href;
    } else if (
      /earnings\s*(call\s*)?(presentation|slides?|deck)|earnings\s*call\s*slides/i.test(blob) &&
      !cur.slides
    ) {
      cur.slides = href;
    }
    out.set(label, cur);
  }
  return out;
}
