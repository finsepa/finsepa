/** Dell Technologies IR: Performance Review as slides. Never transcripts, financial tables, 8-K HTML, or SEC. */

export type DellQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const STATIC = "https://investors.delltechnologies.com/static-files";

function staticFiles(uuid: string): string {
  return `${STATIC}/${uuid}`;
}

/**
 * GET/browser-verified Performance Review UUIDs. Dell FY ends ~late January
 * (Q1≈May, Q2≈Aug, Q3≈Oct/Nov, Q4≈Jan). Missing quarters were not found as
 * first-party Performance Review UUIDs — leave empty.
 */
export const DELL_KNOWN_QUARTER_DOCS: Readonly<Record<string, DellQuarterDocs>> = {
  "Q1 2027": { slides: staticFiles("a75bf8cc-b60f-4f72-8413-2e4090e46f93"), filings: null },
  "Q4 2026": { slides: staticFiles("433e7b1b-c749-4411-bcd7-2f23fbf7f112"), filings: null },
  "Q3 2026": { slides: staticFiles("b4c4b753-04b5-4ed8-aaf1-55b0e6026181"), filings: null },
  "Q2 2026": { slides: staticFiles("454d3647-eebb-410c-bde3-92056cdf569f"), filings: null },
  "Q1 2026": { slides: staticFiles("79e6823f-3f72-40b6-ba5d-0dd91342acff"), filings: null },
  "Q4 2025": { slides: staticFiles("5e2bb358-86b6-45e9-ba92-71cef8eb55a6"), filings: null },
  "Q3 2025": { slides: staticFiles("eabe5858-ad6c-48d5-b03c-a66540b726ce"), filings: null },
  "Q2 2025": { slides: null, filings: null },
  "Q1 2025": { slides: staticFiles("4839ec94-dcac-4567-9051-5216675ea60b"), filings: null },
  "Q4 2024": { slides: staticFiles("6f8ff62e-353a-4ef5-a098-77051581dcc7"), filings: null },
  "Q3 2024": { slides: staticFiles("2955f124-85bf-472f-8e02-5486f58eb281"), filings: null },
  "Q2 2024": { slides: null, filings: null },
  "Q1 2024": { slides: staticFiles("195c3ce8-cdb1-4e0a-ad49-0f7d3ccf017e"), filings: null },
  "Q4 2023": { slides: staticFiles("639f43ed-69c9-421a-a97f-26623d5d598a"), filings: null },
  "Q3 2023": { slides: null, filings: null },
  "Q2 2023": { slides: null, filings: null },
  "Q1 2023": { slides: null, filings: null },
  "Q4 2022": { slides: staticFiles("6370aa87-cf36-4975-a0df-444b78e70c00"), filings: null },
};

export const DELL_IR_PAGES = [
  "https://investors.delltechnologies.com/financial-information/quarterly-results",
  "https://delltechnologies.gcs-web.com/financial-information/quarterly-results",
] as const;

/** Dell FY-end month-day for period-end → Qn YYYY (issuer fiscal, not calendar). */
export const DELL_FY_END = "01-31";

export function mergeDellKnownQuarterDocs(fromHtml: Map<string, DellQuarterDocs>): Map<string, DellQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(DELL_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

export function labelFromDellContext(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const qFy = t.match(/\bQ([1-4])\s*FY\s*(\d{2,4})\b/i);
  if (qFy) {
    const fy = qFy[2]!.length === 2 ? `20${qFy[2]}` : qFy[2]!;
    return `Q${qFy[1]} ${fy}`;
  }
  const nqFy = t.match(/\b([1-4])Q\s*FY\s*(\d{2,4})\b/i);
  if (nqFy) {
    const fy = nqFy[2]!.length === 2 ? `20${nqFy[2]}` : nqFy[2]!;
    return `Q${nqFy[1]} ${fy}`;
  }
  return null;
}

function isDellRejected(context: string): boolean {
  return /transcript|financial\s*tables?|exhibit\s*99|form\s*8-k|prepared\s*remarks|10-q|10-k/i.test(
    context,
  );
}

function isDellSlides(context: string): boolean {
  if (isDellRejected(context)) return false;
  return /performance\s*review/i.test(context);
}

function isDellFilings(context: string): boolean {
  if (isDellRejected(context)) return false;
  return /press\s*release/i.test(context);
}

function absDell(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/** Parse Dell quarterly-results HTML for Performance Review (slides) vs press (filings). */
export function parseDellQuarterlyResultsHtml(html: string, pageUrl: string): Map<string, DellQuarterDocs> {
  const out = new Map<string, DellQuarterDocs>();
  const anchorRe = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const hrefRaw = (m[2] ?? "").replace(/&amp;/g, "&").trim();
    if (!hrefRaw || !/\/static-files\/[a-f0-9-]{36}/i.test(hrefRaw)) continue;
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const aria = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const context = `${title} ${aria} ${inner}`;
    const label = labelFromDellContext(context);
    if (!label) continue;
    const href = absDell(hrefRaw, pageUrl);
    if (!href) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides && isDellSlides(context)) cur.slides = href;
    else if (!cur.filings && isDellFilings(context)) cur.filings = href;
    out.set(label, cur);
  }
  return out;
}
