/** Chevron GCS: quarterly earnings conference call presentation as slides. Never transcripts, 8-K, XLS supplements, or Investor Day. */

export type CvxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const GCS = "https://chevroncorp.gcs-web.com/static-files";

function staticFiles(uuid: string): string {
  return `${GCS}/${uuid}`;
}

/**
 * Verified earnings-call presentation static-files (not transcripts, EX-99.1, or data supplements).
 * 2022 call decks were not captured as first-party presentation UUIDs — leave those empty.
 */
export const CVX_KNOWN_QUARTER_DOCS: Readonly<Record<string, CvxQuarterDocs>> = {
  "Q2 2026": { slides: staticFiles("d808dc3d-f0be-4b2c-b62b-095f75f1c461"), filings: null },
  "Q1 2026": { slides: staticFiles("31faf3bb-166d-42c8-832b-0094de83149c"), filings: null },
  "Q4 2025": { slides: staticFiles("e343663d-4660-404a-b99c-86c33b543bd7"), filings: null },
  "Q3 2025": { slides: staticFiles("37ef13d5-5534-4bd0-9cef-37f31848bcf0"), filings: null },
  "Q2 2025": { slides: staticFiles("c350b9cd-898b-47ee-bf12-e4873bc883db"), filings: null },
  "Q1 2025": { slides: staticFiles("3b7ba281-e370-4a3c-842e-138d8f153f96"), filings: null },
  "Q4 2024": { slides: staticFiles("550c696d-e1b3-42b4-bb5a-e6949906d251"), filings: null },
  "Q3 2024": { slides: staticFiles("5ad10f9e-2380-4d9e-9c96-5fb8b77b37e1"), filings: null },
  "Q2 2024": { slides: staticFiles("0713a291-b3d1-4337-b649-1f164aa3038a"), filings: null },
  "Q1 2024": { slides: staticFiles("f0334da1-ca3f-462a-b8d5-6879146bc122"), filings: null },
  "Q4 2023": { slides: staticFiles("e56babae-795b-4ea7-96a9-df4485962606"), filings: null },
  "Q3 2023": { slides: staticFiles("1f105193-abbf-4315-81a7-45958fc9cd16"), filings: null },
  "Q2 2023": { slides: staticFiles("a90b2c20-236d-4f3e-8b67-660b1c9fb2cb"), filings: null },
  "Q1 2023": { slides: staticFiles("6cffc6b0-2cb3-46e6-a54e-d11ee7491737"), filings: null },
  "Q4 2022": { slides: null, filings: null },
  "Q3 2022": { slides: null, filings: null },
  "Q2 2022": { slides: null, filings: null },
  "Q1 2022": { slides: null, filings: null },
};

export const CVX_IR_PAGES = [
  "https://www.chevron.com/investors",
  "https://chevroncorp.gcs-web.com/financial-information/quarterly-results",
] as const;

export function mergeCvxKnownQuarterDocs(fromHtml: Map<string, CvxQuarterDocs>): Map<string, CvxQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(CVX_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

export function labelFromCvxPresentationContext(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  const a = t.match(/\b(20\d{2})\s+([1-4])Q\b/i);
  if (a) return `Q${a[2]} ${a[1]}`;
  const b = t.match(/\b([1-4])Q\s+(20\d{2})\b/i);
  if (b) return `Q${b[1]} ${b[2]}`;
  const c = t.match(/\bQ([1-4])\s+(20\d{2})\b/i);
  if (c) return `Q${c[1]} ${c[2]}`;
  return null;
}

function isCvxRejectedContext(text: string): boolean {
  const n = text.toLowerCase();
  return (
    /transcript|data supplement|\.xls|investor day|sensitivit|8-k|ex[- ]?99\.?1|earnings release/i.test(
      n,
    ) && !/presentation/i.test(n)
  );
}

function isCvxSlidesContext(text: string): boolean {
  const n = text.toLowerCase();
  if (/transcript|investor day|sensitivit|data supplement|\.xls/i.test(n)) return false;
  if (/earnings release/i.test(n) && !/presentation/i.test(n)) return false;
  return /earnings conference call presentation|earnings call presentation/i.test(n);
}

function absCvx(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/** Parse chevron.com/investors (or GCS HTML) for earnings conference call presentation static-files. */
export function parseCvxInvestorsHtml(html: string, pageUrl: string): Map<string, CvxQuarterDocs> {
  const out = new Map<string, CvxQuarterDocs>();
  const re = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? "";
    const hrefRaw = (m[2] ?? "").replace(/&amp;/g, "&").trim();
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(hrefRaw)) continue;
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const context = `${title} ${inner}`;
    if (isCvxRejectedContext(context) && !isCvxSlidesContext(context)) continue;
    if (!isCvxSlidesContext(context)) continue;
    const href = absCvx(hrefRaw, pageUrl);
    if (!href) continue;
    const label = labelFromCvxPresentationContext(context);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides) cur.slides = href.replace(/\?.*$/, "");
    out.set(label, cur);
  }
  return out;
}
