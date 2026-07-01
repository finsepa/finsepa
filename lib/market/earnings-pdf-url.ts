/** True when `href` is a direct PDF suitable for inline preview (Slides / Filings). */
export function isDirectEarningsPdfUrl(href: string | null | undefined): boolean {
  if (!href || typeof href !== "string") return false;
  const t = href.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) return true;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(t);
  } catch {
    return /\.pdf(?:$|[?#])/i.test(t) || /\/static-files\/[a-f0-9-]{36}/i.test(t);
  }
}

/** Known issuer slide-deck URLs without a `.pdf` suffix (e.g. Microsoft PPTX on dynmedia CDN). */
export function isKnownEarningsSlideDeckUrl(href: string | null | undefined): boolean {
  if (!href || typeof href !== "string") return false;
  const t = href.trim();
  if (!t.startsWith("https://")) return false;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (host === "cdn-dynmedia-1.microsoft.com" && /\/SlidesFY\d{2}[qQ][1-4]\/?$/i.test(u.pathname)) {
      return true;
    }
    if (/\.pptx?(?:$|[?#])/i.test(u.pathname)) return true;
    return false;
  } catch {
    return /cdn-dynmedia-1\.microsoft\.com\/is\/content\/microsoftcorp\/SlidesFY\d{2}[qQ][1-4]/i.test(t);
  }
}
