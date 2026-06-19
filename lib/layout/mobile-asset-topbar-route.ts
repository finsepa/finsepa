import { SCREENER_CRYPTO_HREF, SCREENER_INDICES_HREF } from "@/lib/screener/screener-market-url";

export type MobileAssetTopbarRoute =
  | { kind: "stock"; ticker: string; backHref: string }
  | { kind: "crypto"; symbol: string; backHref: string }
  | { kind: "index"; symbol: string; backHref: string };

function decodeRouteSegment(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/** `/stock/[ticker]`, `/crypto/[symbol]`, `/index/[symbol]` — mobile nested asset chrome. */
export function parseMobileAssetTopbarRoute(pathname: string): MobileAssetTopbarRoute | null {
  if (pathname.startsWith("/stock/")) {
    const ticker = decodeRouteSegment(pathname.slice("/stock/".length).split("/")[0] ?? "");
    if (!ticker) return null;
    return { kind: "stock", ticker: ticker.toUpperCase(), backHref: "/screener" };
  }
  if (pathname.startsWith("/crypto/")) {
    const symbol = decodeRouteSegment(pathname.slice("/crypto/".length).split("/")[0] ?? "");
    if (!symbol) return null;
    return { kind: "crypto", symbol: symbol.toUpperCase(), backHref: SCREENER_CRYPTO_HREF };
  }
  if (pathname.startsWith("/index/")) {
    const symbol = decodeRouteSegment(pathname.slice("/index/".length).split("/")[0] ?? "");
    if (!symbol) return null;
    return { kind: "index", symbol: symbol.toUpperCase(), backHref: SCREENER_INDICES_HREF };
  }
  return null;
}
