/** Broadcom IR print URLs are PDFs without a `.pdf` suffix (`/node/123/pdf`). */
function isBroadcomNodePdfPath(host: string, pathname: string): boolean {
  const h = host.toLowerCase();
  if (h !== "investors.broadcom.com" && h !== "broadcom.gcs-web.com") return false;
  return /\/node\/\d+\/pdf\/?$/i.test(pathname);
}

/** True when `href` is a direct PDF suitable for inline preview (Slides / Filings). */
export function isDirectEarningsPdfUrl(href: string | null | undefined): boolean {
  if (!href || typeof href !== "string") return false;
  const t = href.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) {
      const host = u.hostname.toLowerCase();
      // Micron Q4 `static-files` 403s through `/api/ir-pdf` (bot/WAF). Prefer s25.q4cdn `.pdf` decks.
      if (host === "investors.micron.com" || host.endsWith(".micron.com")) return false;
      return true;
    }
    if (isBroadcomNodePdfPath(u.hostname, u.pathname)) return true;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(t);
  } catch {
    if (/investors\.micron\.com\/static-files\//i.test(t)) return false;
    return (
      /\.pdf(?:$|[?#])/i.test(t) ||
      /\/static-files\/[a-f0-9-]{36}/i.test(t) ||
      /(?:investors\.broadcom\.com|broadcom\.gcs-web\.com)\/node\/\d+\/pdf/i.test(t)
    );
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

/**
 * Microsoft earnings press release DOCX on dynmedia (no `.pdf` suffix) — Filings slot.
 * Office Online can embed these the same way as PPTX decks.
 */
export function isKnownEarningsFilingDocUrl(href: string | null | undefined): boolean {
  if (!href || typeof href !== "string") return false;
  const t = href.trim();
  if (!t.startsWith("https://")) return false;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (host === "cdn-dynmedia-1.microsoft.com" && /\/PressReleaseFY\d{2}_?[qQ][1-4]\/?$/i.test(u.pathname)) {
      return true;
    }
    if (/\.docx?(?:$|[?#])/i.test(u.pathname)) return true;
    return false;
  } catch {
    return /cdn-dynmedia-1\.microsoft\.com\/is\/content\/microsoftcorp\/PressReleaseFY\d{2}_?[qQ][1-4]/i.test(t);
  }
}
