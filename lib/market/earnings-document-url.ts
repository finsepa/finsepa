import { isDirectEarningsPdfUrl, isKnownEarningsSlideDeckUrl } from "@/lib/market/earnings-pdf-url";

export { isDirectEarningsPdfUrl, isKnownEarningsSlideDeckUrl };

/** SEC exhibit HTML that is not an earnings release / interim report (e.g. Ferrari `prcov` notices). */
export function isLowQualitySecEarningsExhibitHtml(href: string): boolean {
  const file = decodeURIComponent(href.split("/").pop()?.split("?")[0] ?? "").toLowerCase();
  return /prcov|bbcov|tranchebb|postagm|renewalcl/i.test(file);
}

/** SEC Exhibit 99.1 earnings press release HTML (no separate slide deck), e.g. Marriott `*earningsrel.htm`. */
export function isSecEdgarEarningsReleaseExhibitHtml(href: string | null | undefined): href is string {
  if (!isSecEdgarExhibitHtmlUrl(href)) return false;
  const file = decodeURIComponent(href.split("/").pop()?.split("?")[0] ?? "").toLowerCase();
  if (/shareholder\s*letter|shareholderletter/i.test(file)) return false;
  if (/slide|slides|slidesfin|presentation|deck|992|ex[-_.]?99[-_.]?2/i.test(file)) return false;
  return /earningsrel|earningsrelease|earningsreleaseex|earnings[-_.]?release|ex99.*earn|ex-\d+.*earn|ex991pressrelease|ex991earningsrelease|q[1-4]\d{2,3}ex991(?:press|earnings)release/i.test(
    file,
  );
}

/** SEC exhibit HTML that looks like an earnings slide deck (Exhibit 99.2), not the press release. */
export function isSecEdgarPresentationExhibitHtml(href: string | null | undefined): href is string {
  if (!isSecEdgarExhibitHtmlUrl(href)) return false;
  if (isSecEdgarEarningsReleaseExhibitHtml(href)) return false;
  const file = decodeURIComponent(href.split("/").pop()?.split("?")[0] ?? "").toLowerCase();
  if (/slide|slides|slidesfin|presentation|deck|992|ex[-_.]?99[-_.]?2/i.test(file)) return true;
  if (/shareholder\s*letter|shareholderletter/i.test(file)) return true;
  return false;
}

/** Slides preview: PDF, SEC Exhibit 99.2 HTML, or known issuer deck URLs (e.g. MSFT PPTX). */
export function isEarningsSlidesPreviewUrl(href: string | null | undefined): href is string {
  return (
    isDirectEarningsPdfUrl(href) ||
    isSecEdgarPresentationExhibitHtml(href) ||
    isSecEdgarEarningsReleaseExhibitHtml(href) ||
    isKnownEarningsSlideDeckUrl(href)
  );
}

/** SEC Form 8-K / 6-K earnings release or interim report HTML. */
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
    if (!/\.htm(?:l)?(?:$|[?#])/i.test(p)) return false;
    return !isLowQualitySecEarningsExhibitHtml(t);
  } catch {
    return false;
  }
}

export function isEarningsFilingsPreviewUrl(href: string | null | undefined): href is string {
  if (isDirectEarningsPdfUrl(href)) return true;
  if (isSecEdgarPresentationExhibitHtml(href)) return false;
  return isSecEdgarExhibitHtmlUrl(href);
}

export type EarningsDocumentPreviewKind = "pdf" | "sec-html" | "external";

export function earningsDocumentPreviewKind(
  url: string,
): EarningsDocumentPreviewKind | null {
  if (isDirectEarningsPdfUrl(url)) return "pdf";
  if (isKnownEarningsSlideDeckUrl(url)) return "external";
  if (isSecEdgarExhibitHtmlUrl(url)) return "sec-html";
  return null;
}

/** True when a released quarter still needs Slides PDF and/or Filings document resolution. */
export function reportedRowMissingEarningsDocuments(row: {
  reported: boolean;
  secSlidesUrl: string | null;
  secFilingsUrl: string | null;
}): boolean {
  if (!row.reported) return false;
  if (!isEarningsSlidesPreviewUrl(row.secSlidesUrl)) return true;
  if (!isEarningsFilingsPreviewUrl(row.secFilingsUrl)) return true;
  return false;
}

/** True when IR scraping should still run (e.g. upgrade SEC HTML releases to issuer PDF decks). */
export function reportedRowNeedsIrDocumentSeed(row: {
  reported: boolean;
  secSlidesUrl: string | null;
  secFilingsUrl: string | null;
}): boolean {
  if (reportedRowMissingEarningsDocuments(row)) return true;
  if (!row.reported) return false;
  if (isSecEdgarEarningsReleaseExhibitHtml(row.secSlidesUrl) && !isDirectEarningsPdfUrl(row.secSlidesUrl)) {
    return true;
  }
  if (isSecEdgarEarningsReleaseExhibitHtml(row.secFilingsUrl) && !isDirectEarningsPdfUrl(row.secFilingsUrl)) {
    return true;
  }
  return false;
}
