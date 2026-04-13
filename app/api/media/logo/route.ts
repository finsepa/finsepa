import { NextResponse } from "next/server";

import { googleFaviconHostForCryptoSymbol } from "@/lib/crypto/crypto-logo-url";
import { getCachedLogoFromUpstream, type LogoProxyKind } from "@/lib/media/logo-proxy-upstream";

export const runtime = "nodejs";

const TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/i;
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
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(`${t.toLowerCase()}.com`)}&sz=128`;
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
 * Proxies Logo.dev images with long CDN/browser caching so 100+ users share one upstream fetch per symbol.
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
    return NextResponse.redirect(googleFaviconFallback(parsed.kind, parsed.id), 302);
  }

  const bytes = Buffer.from(row.base64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
