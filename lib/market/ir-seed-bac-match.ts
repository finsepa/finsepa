/**
 * Bank of America IR PDFs on d1io3yog0oux5.cloudfront.net
 * (`/presentation/` = slides, `/earnings_release/` = filings).
 * Filenames encode quarter as `1Q22`, `2Q26`, etc.
 */

export function parseBacQuarterFromFilename(url: string): { fq: number; fy: number } | null {
  const file = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "");
  const m =
    file.match(/(?:^|[_\s+.-])([1-4])Q(\d{2})(?:[_\s+.-]|$)/i) ??
    file.match(/\b([1-4])Q(\d{2})\b/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const yy = Number(m[2]);
  if (!fq || !Number.isFinite(yy)) return null;
  const fy = yy >= 70 ? 1900 + yy : 2000 + yy;
  return { fq, fy };
}

export function classifyBacCloudfrontUrl(url: string): "slides" | "filings" | null {
  const lower = decodeURIComponent(url).toLowerCase();
  if (!lower.includes("d1io3yog0oux5.cloudfront.net")) return null;
  if (!/\.pdf(?:$|[?#])/i.test(lower)) return null;
  if (/transcript|supplement|xlsx|proxy|8-k|revised/i.test(lower)) return null;
  if (/\/presentation\//i.test(lower) || /presentation[+_\s-]*materials/i.test(lower)) {
    return "slides";
  }
  if (/\/earnings_release\//i.test(lower) || /press[+_\s-]*release/i.test(lower)) {
    return "filings";
  }
  return null;
}

export function extractBacCloudfrontPdfUrls(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/https?:\/\/d1io3yog0oux5\.cloudfront\.net\/[^"'\\\s>]+/gi)) {
    const u = m[0]!.replace(/&amp;/g, "&").split("#")[0]!;
    if (/\.pdf(?:$|[?#])/i.test(u) && /bankofamerica/i.test(u)) out.push(u);
  }
  return [...new Set(out)];
}
