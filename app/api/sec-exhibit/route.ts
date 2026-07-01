import { getSecEdgarUserAgent } from "@/lib/env/server";
import { isSecExhibitProxyUrlAllowed } from "@/lib/market/sec-exhibit-proxy-allowlist";

export const dynamic = "force-dynamic";

function exhibitBaseHref(absoluteUrl: string): string {
  try {
    const u = new URL(absoluteUrl);
    const dir = u.pathname.replace(/[^/]+$/, "");
    return `${u.origin}${dir}`;
  } catch {
    return absoluteUrl;
  }
}

function injectBaseTag(html: string, baseHref: string): string {
  const base = `<base href="${baseHref}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${base}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${base}</head>`);
  }
  return `<!DOCTYPE html><html><head>${base}</head><body>${html}</body></html>`;
}

/**
 * Stream a whitelisted SEC Exhibit HTML document for in-app preview.
 */
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get("u");
  if (!u?.trim()) {
    return new Response("Missing u", { status: 400 });
  }
  if (!isSecExhibitProxyUrlAllowed(u)) {
    return new Response("URL not allowed", { status: 403 });
  }

  let res: Response;
  try {
    res = await fetch(u, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": getSecEdgarUserAgent(),
      },
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }
  if (!res.ok) {
    return new Response("Upstream not OK", { status: 502, statusText: res.statusText });
  }

  const raw = await res.text();
  const body = injectBaseTag(raw, exhibitBaseHref(u));

  const outHeaders = new Headers();
  outHeaders.set("Content-Type", "text/html; charset=utf-8");
  outHeaders.set("Cache-Control", "private, max-age=300");
  outHeaders.set("X-Content-Type-Options", "nosniff");

  return new Response(body, { status: 200, headers: outHeaders });
}
