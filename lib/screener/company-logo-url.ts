/**
 * Brand images are served via **`/api/media/logo`** (same-origin proxy). The route uses Next `unstable_cache`
 * plus long `Cache-Control` (see `LOGO_PROXY_CACHE_MAX_AGE_SEC` in `lib/media/logo-proxy-upstream.ts`) so
 * many users share one Logo.dev upstream fetch per symbol and repeat visits hit the browser/CDN cache first.
 *
 * Server holds `LOGO_DEV_PUBLISHABLE_KEY`; the browser never sees the token. Do not point `<img>` at
 * `img.logo.dev` directly — always use these URL builders.
 */

const TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/i;

function isReasonableHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^www\./, "");
  if (h.length < 3 || h.length > 200) return false;
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(h)) return false;
  if (h.includes("..") || h.startsWith(".") || h.endsWith(".")) return false;
  return true;
}

/** @returns Same-origin path; never exposes Logo.dev token to the client. */
export function logoDevDomainLogoUrl(domain: string): string | null {
  const host = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!isReasonableHost(host)) return null;
  return `/api/media/logo?kind=domain&h=${encodeURIComponent(host)}`;
}

/** @returns Same-origin path for ticker-based Logo.dev artwork. */
export function logoDevStockLogoUrl(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!TICKER_RE.test(t)) return null;
  return `/api/media/logo?kind=stock&t=${encodeURIComponent(t)}`;
}

/** @returns Same-origin path for crypto Logo.dev artwork. */
export function logoDevCryptoLogoUrl(symbol: string): string | null {
  const c = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(c)) return null;
  return `/api/media/logo?kind=crypto&c=${encodeURIComponent(c)}`;
}

/** Stable domain-based favicon (no API key). */
export function companyLogoUrlFromDomain(domain: string): string {
  const d = domain.trim().toLowerCase();
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`;
}

/**
 * Prefer Logo.dev **domain** when we have a brand host (Top 10, picker, search), then ticker, then favicon.
 * Logo.dev’s `/ticker/…` route can occasionally return the wrong mark; domain matches curated sites like
 * `apple.com`. Page-2 screener rows stay ticker-only via {@link resolveEquityLogoUrlFromTicker}.
 */
export function companyLogoUrlForTicker(ticker: string, domain: string): string {
  return logoDevDomainLogoUrl(domain) ?? logoDevStockLogoUrl(ticker) ?? companyLogoUrlFromDomain(domain);
}
