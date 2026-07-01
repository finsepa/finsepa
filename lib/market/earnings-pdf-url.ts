/** True when `href` is a direct PDF suitable for inline preview (Slides / Filings). */
export function isDirectEarningsPdfUrl(href: string | null | undefined): href is string {
  if (!href || typeof href !== "string") return false;
  const t = href.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(t);
  } catch {
    return /\.pdf(?:$|[?#])/i.test(t);
  }
}
