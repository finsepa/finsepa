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
    const rest = pathname.slice("/stock/".length);
    const [segment, ...subpath] = rest.split("/").filter(Boolean);
    const ticker = decodeRouteSegment(segment ?? "");
    if (!ticker) return null;
    const assetHref = `/stock/${encodeURIComponent(ticker)}`;
    return {
      kind: "stock",
      ticker: ticker.toUpperCase(),
      backHref: subpath.length > 0 ? assetHref : "/screener",
    };
  }
  if (pathname.startsWith("/crypto/")) {
    const rest = pathname.slice("/crypto/".length);
    const [segment, ...subpath] = rest.split("/").filter(Boolean);
    const symbol = decodeRouteSegment(segment ?? "");
    if (!symbol) return null;
    const assetHref = `/crypto/${encodeURIComponent(symbol)}`;
    return {
      kind: "crypto",
      symbol: symbol.toUpperCase(),
      backHref: subpath.length > 0 ? assetHref : SCREENER_CRYPTO_HREF,
    };
  }
  if (pathname.startsWith("/index/")) {
    const rest = pathname.slice("/index/".length);
    const [segment, ...subpath] = rest.split("/").filter(Boolean);
    const symbol = decodeRouteSegment(segment ?? "");
    if (!symbol) return null;
    const assetHref = `/index/${encodeURIComponent(symbol)}`;
    return {
      kind: "index",
      symbol: symbol.toUpperCase(),
      backHref: subpath.length > 0 ? assetHref : SCREENER_INDICES_HREF,
    };
  }
  return null;
}
