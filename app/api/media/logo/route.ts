import { NextResponse } from "next/server";

import { googleFaviconHostForCryptoSymbol } from "@/lib/crypto/crypto-logo-url";
import {
  getCachedLogoFromUpstream,
  LOGO_PROXY_CACHE_MAX_AGE_SEC,
  LOGO_PROXY_STALE_WHILE_REVALIDATE_SEC,
  type LogoProxyKind,
} from "@/lib/media/logo-proxy-upstream";

const LOGO_PROXY_CACHE_CONTROL = `public, max-age=${LOGO_PROXY_CACHE_MAX_AGE_SEC}, s-maxage=${LOGO_PROXY_CACHE_MAX_AGE_SEC}, stale-while-revalidate=${LOGO_PROXY_STALE_WHILE_REVALIDATE_SEC}`;

export const runtime = "nodejs";

const TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/i;

/** When `${ticker}.com` is not the brand host (e.g. NFLX → netflix.com). */
const STOCK_FAVICON_DOMAIN: Partial<Record<string, string>> = {
  NFLX: "netflix.com",
};

function isReasonableHost(h: string): boolean {
  if (h.length < 3 || h.length > 200) return false;
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(h)) return false;
  if (h.includes("..") || h.startsWith(".") || h.endsWith(".")) return false;
  return true;
}

function googleFaviconFallback(kind: LogoProxyKind, raw: string): string {
  const t = raw.trim();
  if (kind === "domain" && t) {
    const host = t.toLowerCase().replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  }
  if (kind === "crypto" && t) {
    const host = googleFaviconHostForCryptoSymbol(t);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  }
  if (kind === "stock" && t) {
    const sym = t.toUpperCase();
    const host = STOCK_FAVICON_DOMAIN[sym] ?? `${t.toLowerCase()}.com`;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  }
  return "https://www.google.com/s2/favicons?domain=example.com&sz=128";
}

function parseRequest(url: URL): { kind: LogoProxyKind; id: string } | null {
  const kindRaw = url.searchParams.get("kind")?.trim().toLowerCase();
  if (kindRaw === "stock") {
    const t = url.searchParams.get("t")?.trim().toUpperCase() ?? "";
    if (!TICKER_RE.test(t)) return null;
    return { kind: "stock", id: t };
  }
  if (kindRaw === "crypto") {
    const c = url.searchParams.get("c")?.trim().toUpperCase() ?? "";
    if (!/^[A-Z0-9]{1,12}$/.test(c)) return null;
    return { kind: "crypto", id: c };
  }
  if (kindRaw === "domain") {
    const h = url.searchParams.get("h")?.trim().toLowerCase() ?? "";
    const host = h.replace(/^www\./, "");
    if (!host || !isReasonableHost(host)) return null;
    return { kind: "domain", id: host };
  }
  return null;
}

/**
 * Proxies Logo.dev images with long CDN/browser caching so many users share one upstream fetch per symbol
 * (see `LOGO_PROXY_CACHE_MAX_AGE_SEC` in `lib/media/logo-proxy-upstream.ts`).
 * Query: `kind=stock&t=AAPL` | `kind=crypto&c=BTC` | `kind=domain&h=apple.com`
 */
export async function GET(req: Request) {
  const parsed = parseRequest(new URL(req.url));
  if (!parsed) {
    return NextResponse.json({ error: "Invalid logo request." }, { status: 400 });
  }

  const normId = parsed.kind === "stock" || parsed.kind === "crypto" ? parsed.id : parsed.id.toLowerCase();
  const row = await getCachedLogoFromUpstream(parsed.kind, normId);
  if (!row) {
    const fallbackUrl = googleFaviconFallback(parsed.kind, parsed.id);
    try {
      const fallbackRes = await fetch(fallbackUrl, { cache: "force-cache" });
      if (fallbackRes.ok) {
        const contentType =
          fallbackRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
        const bytes = Buffer.from(await fallbackRes.arrayBuffer());
        // Tiny favicons can be <32 bytes; still usable for UI / export.
        if (bytes.length >= 8 && bytes.length <= 2_000_000) {
          const type = contentType.startsWith("image/") ? contentType : "image/png";
          return new NextResponse(bytes, {
            status: 200,
            headers: {
              "Content-Type": type,
              "Cache-Control": LOGO_PROXY_CACHE_CONTROL,
            },
          });
        }
      }
    } catch {
      // fall through
    }
    // Never 302 to a cross-origin URL — html-to-image / export inlining cannot follow
    // those redirects and paints an empty logo tile. Let <img onError> show initials.
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const bytes = Buffer.from(row.base64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": LOGO_PROXY_CACHE_CONTROL,
    },
  });
}
