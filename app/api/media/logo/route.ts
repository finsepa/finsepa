import { NextResponse } from "next/server";

import { googleFaviconHostForCryptoSymbol } from "@/lib/crypto/crypto-logo-url";
import { LOGO_TILE_OVERRIDES } from "@/lib/media/logo-overrides";
import { encodeLogoTile, LOGO_TILE_CONTENT_TYPE, renderLogoTile } from "@/lib/media/logo-tile";
import {
  getCachedLogoFromUpstream,
  getCachedLogoTile,
  LOGO_PROXY_CACHE_MAX_AGE_SEC,
  LOGO_PROXY_STALE_WHILE_REVALIDATE_SEC,
  type LogoDevTheme,
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

function parseTheme(url: URL): LogoDevTheme {
  return url.searchParams.get("theme")?.trim().toLowerCase() === "dark" ? "dark" : "light";
}

function parseRequest(
  url: URL,
): { kind: LogoProxyKind; id: string; theme: LogoDevTheme; tile: boolean } | null {
  const theme = parseTheme(url);
  // Uniform tiles by default; `raw=1` keeps Logo.dev artwork (+ theme) for wordmark-style uses.
  const tile = url.searchParams.get("raw") !== "1";
  const kindRaw = url.searchParams.get("kind")?.trim().toLowerCase();
  if (kindRaw === "stock") {
    const t = url.searchParams.get("t")?.trim().toUpperCase() ?? "";
    if (!TICKER_RE.test(t)) return null;
    return { kind: "stock", id: t, theme, tile };
  }
  if (kindRaw === "crypto") {
    const c = url.searchParams.get("c")?.trim().toUpperCase() ?? "";
    if (!/^[A-Z0-9]{1,12}$/.test(c)) return null;
    return { kind: "crypto", id: c, theme, tile };
  }
  if (kindRaw === "domain") {
    const h = url.searchParams.get("h")?.trim().toLowerCase() ?? "";
    const host = h.replace(/^www\./, "");
    if (!host || !isReasonableHost(host)) return null;
    return { kind: "domain", id: host, theme, tile };
  }
  return null;
}

/**
 * Single logo source for every client: curated overrides, else Logo.dev normalized into a uniform
 * tile (same in light + dark), cached long on CDN/browser so one upstream fetch serves all users
 * (see `LOGO_PROXY_CACHE_MAX_AGE_SEC` in `lib/media/logo-proxy-upstream.ts`).
 * Query: `kind=stock&t=AAPL` | `kind=crypto&c=BTC` | `kind=domain&h=apple.com`
 * Optional: `raw=1&theme=light|dark` for untouched Logo.dev artwork; `v` is a cache-busting version.
 */
export async function GET(req: Request) {
  const parsed = parseRequest(new URL(req.url));
  if (!parsed) {
    return NextResponse.json({ error: "Invalid logo request." }, { status: 400 });
  }

  const normId = parsed.kind === "stock" || parsed.kind === "crypto" ? parsed.id : parsed.id.toLowerCase();
  const override = LOGO_TILE_OVERRIDES[`${parsed.kind}:${normId}`];
  if (override) {
    const tile = await encodeLogoTile(Buffer.from(override));
    return new NextResponse(new Uint8Array(tile), {
      status: 200,
      headers: { "Content-Type": LOGO_TILE_CONTENT_TYPE, "Cache-Control": LOGO_PROXY_CACHE_CONTROL },
    });
  }
  const row = parsed.tile
    ? await getCachedLogoTile(parsed.kind, normId)
    : await getCachedLogoFromUpstream(parsed.kind, normId, parsed.theme);
  if (row === "transient") {
    // Logo.dev rate limit / outage: don't let CDNs or browsers pin a fallback for 30 days.
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
  if (!row) {
    const fallbackUrl = googleFaviconFallback(parsed.kind, parsed.id);
    try {
      const fallbackRes = await fetch(fallbackUrl, { cache: "force-cache" });
      if (fallbackRes.ok) {
        const contentType =
          fallbackRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
        let bytes: Buffer = Buffer.from(await fallbackRes.arrayBuffer());
        let type = contentType.startsWith("image/") ? contentType : "image/png";
        if (parsed.tile && bytes.length >= 8) {
          const tiled = await renderLogoTile(bytes).catch(() => null);
          if (tiled) {
            bytes = tiled;
            type = LOGO_TILE_CONTENT_TYPE;
          }
        }
        // Tiny favicons can be <32 bytes; still usable for UI / export.
        if (bytes.length >= 8 && bytes.length <= 2_000_000) {
          return new NextResponse(new Uint8Array(bytes), {
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
