import "server-only";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_HTML_BYTES = 240_000;
const FETCH_MS = 9_000;

function isSafePublicHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) return false;
    if (h === "0.0.0.0") return false;
    // block obvious private / loopback (best-effort)
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlAttr(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseOgImageFromHtml(html: string, pageUrl: string): string | null {
  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const raw = decodeHtmlAttr(m[1].trim());
      try {
        if (raw.startsWith("//")) return new URL(`https:${raw}`).href;
        if (/^https?:\/\//i.test(raw)) return new URL(raw).href;
        return new URL(raw, pageUrl).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function readHtmlPrefix(res: Response, maxBytes: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let out = "";
  try {
    while (out.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
      if (out.length >= maxBytes) break;
    }
  } catch {
    return null;
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  return out.slice(0, maxBytes);
}

/**
 * Loads the article HTML and reads og:image / twitter:image (first ~240KB only).
 * EODHD news items do not include image URLs; this is the reliable fallback.
 */
export async function fetchOgImageFromArticleUrl(articleUrl: string): Promise<string | null> {
  if (!isSafePublicHttpUrl(articleUrl)) return null;

  let res: Response;
  try {
    res = await fetch(articleUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  const ct = res.headers.get("content-type") ?? "";
  if (/application\/json|application\/pdf|image\//i.test(ct)) return null;

  const html = await readHtmlPrefix(res, MAX_HTML_BYTES);
  if (!html) return null;

  const img = parseOgImageFromHtml(html, articleUrl);
  if (!img || !isSafePublicHttpUrl(img)) return null;
  return img;
}
