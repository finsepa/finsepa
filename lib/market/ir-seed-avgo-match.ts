/**
 * Parse Broadcom quarterly-results news titles → fiscal quarter.
 * Titles look like: "Broadcom Inc. Announces Second Quarter Fiscal Year 2026 Financial Results…"
 * or "…Fourth Quarter and Fiscal Year 2025…"
 */

const ORDINAL_Q: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
};

export function parseAvgoEarningsTitle(title: string): { fq: number; fy: number } | null {
  const t = title.replace(/\s+/g, " ").trim();
  const m = t.match(
    /\b(First|Second|Third|Fourth)\s+Quarter(?:\s+and)?(?:\s+Fiscal\s+Year)?\s+(?:Fiscal\s+Year\s+)?(20\d{2})\b/i,
  );
  if (!m) return null;
  const fq = ORDINAL_Q[m[1]!.toLowerCase()];
  const fy = Number(m[2]);
  if (!fq || !Number.isFinite(fy)) return null;
  return { fq, fy };
}

/** Extract news-release paths + titles from the quarterly-results HTML. */
export function parseAvgoQuarterlyResultsHtml(
  html: string,
): Map<string, { href: string; title: string }> {
  const out = new Map<string, { href: string; title: string }>();
  const re =
    /<a[^>]+href="(\/news-releases\/news-release-details\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const href = m[1] ?? "";
    const title = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/broadcom-inc-announces/i.test(href)) continue;
    const q = parseAvgoEarningsTitle(title);
    if (!q) continue;
    const key = `Q${q.fq} ${q.fy}`;
    if (!out.has(key)) out.set(key, { href, title });
  }
  return out;
}

/** Find `/node/{id}/pdf` print URL on a news-release detail page. */
export function extractAvgoNodePdfPath(html: string): string | null {
  const m = html.match(/\/node\/(\d+)\/pdf/i);
  return m ? `/node/${m[1]}/pdf` : null;
}

const AVGO_IR = "https://investors.broadcom.com";

/** Browser-verified `/node/N/pdf` when the quarterly-results scrape is Cloudflare-walled. */
export const AVGO_KNOWN_FILINGS: Readonly<Record<string, string>> = {
  "Q3 2026": `${AVGO_IR}/node/64671/pdf`,
};

export function avgoKnownFilingUrl(label: string): string | undefined {
  return AVGO_KNOWN_FILINGS[label];
}
