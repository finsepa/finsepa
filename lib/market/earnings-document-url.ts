import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-pdf-url";

export { isDirectEarningsPdfUrl };

/** SEC Form 8-K Exhibit 99.1 press release HTML (earnings release when no PDF). */
export function isSecEdgarExhibitHtmlUrl(href: string | null | undefined): href is string {
  if (!href || typeof href !== "string") return false;
  const t = href.trim();
  if (!t.startsWith("https://")) return false;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (host !== "sec.gov" && host !== "www.sec.gov") return false;
    const p = u.pathname.toLowerCase();
    if (!p.includes("/archives/edgar/")) return false;
    return /\.htm(?:l)?(?:$|[?#])/i.test(p);
  } catch {
    return false;
  }
}

export function isEarningsFilingsPreviewUrl(href: string | null | undefined): href is string {
  return isDirectEarningsPdfUrl(href) || isSecEdgarExhibitHtmlUrl(href);
}

export type EarningsDocumentPreviewKind = "pdf" | "sec-html";

export function earningsDocumentPreviewKind(
  url: string,
): EarningsDocumentPreviewKind | null {
  if (isDirectEarningsPdfUrl(url)) return "pdf";
  if (isSecEdgarExhibitHtmlUrl(url)) return "sec-html";
  return null;
}
