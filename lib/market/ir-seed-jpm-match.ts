/**
 * JPMorgan Chase IR quarterly-earnings URL builders + HTML classification.
 * Slides prefer `corp-q{n}-{year}.pdf`; filings come from labeled Press Release links
 * (never transcripts). Q4 often lacks corp-q — scrape Presentation / Press Release instead.
 */

export function jpmQuarterOrdinal(fq: number): "1st" | "2nd" | "3rd" | "4th" | null {
  if (fq === 1) return "1st";
  if (fq === 2) return "2nd";
  if (fq === 3) return "3rd";
  if (fq === 4) return "4th";
  return null;
}

const JPM_QE_BASE =
  "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings";

/** Canonical corp-q presentation/10-Q-style PDF path used as the Slides slot. */
export function buildJpmCorpQPdfUrl(fq: number, fy: number): string | null {
  const nth = jpmQuarterOrdinal(fq);
  if (!nth || !Number.isFinite(fy) || fy < 2000 || fy > 2100) return null;
  return `${JPM_QE_BASE}/${fy}/${nth}-quarter/corp-q${fq}-${fy}.pdf`;
}

export function parseJpmQuarterFromDamPath(url: string): { fq: number; fy: number } | null {
  const m = url.match(/\/quarterly-earnings\/(\d{4})\/(1st|2nd|3rd|4th)-quarter\//i);
  if (!m) return null;
  const fy = Number(m[1]);
  const ord = m[2]!.toLowerCase();
  const fq = ord === "1st" ? 1 : ord === "2nd" ? 2 : ord === "3rd" ? 3 : 4;
  if (!Number.isFinite(fy)) return null;
  return { fq, fy };
}

export type JpmDocKind = "slides" | "filings";

/**
 * Classify a JPM quarterly-earnings PDF from path + nearby label text.
 * Returns null for transcripts / supplements / 10-K / unusable docs.
 */
export function classifyJpmQuarterlyPdf(url: string, labelBlob: string): JpmDocKind | null {
  const lower = `${url} ${labelBlob}`.toLowerCase();
  if (!/\.pdf(?:$|[?#])/i.test(url)) return null;
  if (!/jpmorganchase\.com\/content\/dam\//i.test(url) && !url.startsWith("/content/dam/")) {
    return null;
  }
  if (/transcript/i.test(lower)) return null;
  if (/supplement|erf\s*exhibit|exhibit\s*99\.?2/i.test(lower)) return null;
  if (/corp-10k|10-k\b/i.test(lower) && !/press\s*release|presentation/i.test(labelBlob)) {
    return null;
  }
  // Prefer explicit IR labels over filename heuristics.
  if (/press\s*release|earnings\s*release/i.test(labelBlob)) return "filings";
  if (/earnings\s*presentation|presentation\b/i.test(labelBlob) && !/press/i.test(labelBlob)) {
    return "slides";
  }
  // User-preferred slides path when label is missing / generic (e.g. bare HEAD probe).
  if (/\/corp-q[1-4]-\d{4}\.pdf(?:$|[?#])/i.test(url)) return "slides";
  return null;
}

export type JpmQuarterDocs = { slides: string | null; filings: string | null };

export function isJpmTranscriptPdfUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && /transcript/i.test(url);
}


/**
 * Hashed DAM PDFs for quarters whose IR HTML is JS-only. Slides are presentations
 * (or corp-q when that file is the deck); filings are press releases — never transcripts.
 */
export const JPM_KNOWN_QUARTER_DOCS: Readonly<Record<string, JpmQuarterDocs>> = {
  "Q3 2022": {
    slides: `${JPM_QE_BASE}/2022/3rd-quarter/91bc85cd-5a7e-497b-8f89-4c4f2be658e8.pdf`,
    filings: `${JPM_QE_BASE}/2022/3rd-quarter/c363d5ac-0a3e-483e-88ec-89767a8e266e.pdf`,
  },
  "Q4 2022": {
    slides: `${JPM_QE_BASE}/2022/4th-quarter/3c8a3483-49bf-40df-bf72-60ed5f2f0037.pdf`,
    filings: `${JPM_QE_BASE}/2022/4th-quarter/3958ba8d-cf62-4c8e-a06b-b28ed286df8e.pdf`,
  },
  "Q3 2023": {
    slides: `${JPM_QE_BASE}/2023/3rd-quarter/201d7144-a3f5-448f-99f4-ba3ba761b7f1.pdf`,
    filings: `${JPM_QE_BASE}/2023/3rd-quarter/fa584ba1-9ee9-4b87-8ac4-eb9be0e9744b.pdf`,
  },
  "Q4 2023": {
    slides: `${JPM_QE_BASE}/2023/4th-quarter/038c2943-104d-4253-906a-7910c3706763.pdf`,
    filings: `${JPM_QE_BASE}/2023/4th-quarter/30e66a2f-5f41-4616-b831-fee985b61b8a.pdf`,
  },
  "Q3 2024": {
    slides: `${JPM_QE_BASE}/2024/3rd-quarter/corp-q3-2024.pdf`,
    filings: `${JPM_QE_BASE}/2024/3rd-quarter/66269bb6-ecc5-4172-b461-6b7e7cd47aab.pdf`,
  },
  "Q4 2024": {
    slides: `${JPM_QE_BASE}/2024/4th-quarter/9aff0e71-2b8c-4f41-ac93-8da74c263894.pdf`,
    filings: `${JPM_QE_BASE}/2024/4th-quarter/36b3c0a4-3ecd-422e-8167-0a31372f3438.pdf`,
  },
  "Q3 2025": {
    slides: `${JPM_QE_BASE}/2025/3rd-quarter/corp-q3-2025.pdf`,
    filings: `${JPM_QE_BASE}/2025/3rd-quarter/f24f154c-2653-4da3-b1b0-185586086d50.pdf`,
  },
  "Q4 2025": {
    slides: `${JPM_QE_BASE}/2025/4th-quarter/3f2030e7-c144-4ad8-92b8-57b36851ffb6.pdf`,
    filings: `${JPM_QE_BASE}/2025/4th-quarter/d868c7ef-1670-465d-ba75-c2b36ddbcc6b.pdf`,
  },
  "Q1 2026": {
    slides: `${JPM_QE_BASE}/2026/1st-quarter/corp-q1-2026.pdf`,
    filings: `${JPM_QE_BASE}/2026/1st-quarter/a5fd2d13-877b-43b2-8b58-81bad4399c87.pdf`,
  },
};

/** Live scrape wins; fill any missing slot from the known DAM overlay. */
export function mergeJpmKnownQuarterDocs(fromHtml: Map<string, JpmQuarterDocs>): Map<string, JpmQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(JPM_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

function absJpm(href: string): string | null {
  const t = href.replace(/&amp;/g, "&").trim();
  if (!t) return null;
  if (t.startsWith("https://")) return t.split("#")[0]!;
  if (t.startsWith("/content/dam/")) return `https://www.jpmorganchase.com${t.split("#")[0]}`;
  return null;
}

/**
 * Parse JPM IR HTML for quarterly-earnings PDF hrefs with aria-label / title / ctaTitle.
 */
export function parseJpmIrHtmlForQuarterDocs(html: string): Map<string, JpmQuarterDocs> {
  const out = new Map<string, JpmQuarterDocs>();
  const merge = (fq: number, fy: number, kind: JpmDocKind, url: string) => {
    const key = `Q${fq} ${fy}`;
    const cur = out.get(key) ?? { slides: null, filings: null };
    if (kind === "slides" && !cur.slides) cur.slides = url;
    if (kind === "filings" && !cur.filings) cur.filings = url;
    out.set(key, cur);
  };

  const anchorRe = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const href = absJpm(m[2] ?? "");
    if (!href || !/\/quarterly-earnings\/\d{4}\/(1st|2nd|3rd|4th)-quarter\//i.test(href)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(href)) continue;

    const aria = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const cta =
      attrs.match(/ctaTitle&quot;:&quot;([^&]+)&quot;/i)?.[1] ??
      attrs.match(/"ctaTitle"\s*:\s*"([^"]+)"/i)?.[1] ??
      "";
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const blob = `${aria} ${title} ${cta} ${inner}`;

    const q = parseJpmQuarterFromDamPath(href);
    if (!q) continue;
    const kind = classifyJpmQuarterlyPdf(href, blob);
    if (!kind) continue;
    merge(q.fq, q.fy, kind, href);
  }

  return out;
}
