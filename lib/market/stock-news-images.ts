import "server-only";

/**
 * Known image-related keys from EODHD and common news APIs (NewsAPI, etc.).
 * Higher = prefer when multiple candidates exist.
 */
const FIELD_PRIORITY: Record<string, number> = {
  banner_image: 100,
  urlToImage: 96,
  image: 92,
  related_image: 88,
  og_image: 84,
  preview_image: 80,
  image_url: 76,
  imageUrl: 76,
  photo: 72,
  thumbnail: 58,
  thumb: 52,
  picture: 70,
  media_image: 78,
};

function normalizeMediaUrl(s: string, articleLink: string): string | null {
  const t = s.trim();
  if (!t || t.startsWith("data:") || t.startsWith("blob:")) return null;
  try {
    if (t.startsWith("//")) return new URL(`https:${t}`).href;
    if (/^https?:\/\//i.test(t)) return new URL(t).href;
    if (articleLink && (t.startsWith("/") || !t.includes("://"))) {
      return new URL(t, articleLink).href;
    }
  } catch {
    return null;
  }
  return null;
}

function isPlausibleImageUrl(url: string, articleLink: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const u = url.toLowerCase();
  if (u.includes("mailto:") || u.includes(".pdf") || u.includes(".zip")) return false;
  try {
    const a = new URL(articleLink).href;
    const b = new URL(url).href;
    if (a === b) return false;
  } catch {
    if (url.trim().toLowerCase() === articleLink.trim().toLowerCase()) return false;
  }
  return true;
}

/** Prefer URLs that look like full-size or hero assets over tiny thumbs/icons. */
function heuristicUrlScore(url: string): number {
  const u = url.toLowerCase();
  let s = 0;
  if (u.includes("thumb") || u.includes("thumbnail") || u.includes("/thumb/")) s -= 35;
  if (u.includes("icon") || u.includes("favicon") || u.includes("avatar")) s -= 45;
  if (u.includes("banner") || u.includes("hero") || u.includes("/large/") || u.includes("/xlarge/")) s += 28;
  const wParam = u.match(/[?&]w=(\d+)/i) ?? u.match(/[?&]width=(\d+)/i);
  if (wParam) {
    const w = parseInt(wParam[1]!, 10);
    if (Number.isFinite(w)) s += Math.min(w / 15, 40);
  }
  const dimPath = u.match(/\/(\d{2,4})x(\d{2,4})\//);
  if (dimPath) {
    const px = parseInt(dimPath[1]!, 10);
    if (Number.isFinite(px)) s += Math.min(px / 20, 35);
  }
  if (/\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(u)) s += 8;
  return s;
}

function fieldScoreForKey(key: string): number {
  if (key in FIELD_PRIORITY) return FIELD_PRIORITY[key]!;
  const lower = key.toLowerCase();
  if (lower in FIELD_PRIORITY) return FIELD_PRIORITY[lower]!;
  if (lower.includes("banner") || lower.includes("hero")) return 90;
  if (lower.includes("image") || lower.includes("photo") || lower.includes("picture")) return 65;
  if (lower.includes("thumb")) return 55;
  return 25;
}

type Candidate = { url: string; score: number };

function addCandidate(out: Map<string, Candidate>, url: string, key: string, articleLink: string) {
  if (!isPlausibleImageUrl(url, articleLink)) return;
  const fs = fieldScoreForKey(key);
  const total = fs + heuristicUrlScore(url);
  const prev = out.get(url);
  if (!prev || total > prev.score) out.set(url, { url, score: total });
}

const EXPLICIT_IMAGE_KEYS = [
  "banner_image",
  "image",
  "urlToImage",
  "related_image",
  "og_image",
  "preview_image",
  "image_url",
  "imageUrl",
  "thumbnail",
  "thumb",
  "photo",
  "picture",
  "media_image",
] as const;

function extractMetaImageFromHtml(html: string, articleLink: string, out: Map<string, Candidate>) {
  if (!html.includes("og:image") && !html.includes("twitter:image") && !html.includes("twitter:image:src")) return;
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image(?:|:src)["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image(?:|:src)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const u = normalizeMediaUrl(m[1].trim(), articleLink);
      if (u) addCandidate(out, u, "og_image", articleLink);
    }
  }
}

function walkForImages(
  value: unknown,
  articleLink: string,
  depth: number,
  keyPath: string,
  out: Map<string, Candidate>,
) {
  if (depth > 5) return;

  if (typeof value === "string") {
    const u = normalizeMediaUrl(value, articleLink);
    if (u) addCandidate(out, u, keyPath || "string", articleLink);
    return;
  }

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkForImages(value[i], articleLink, depth + 1, `${keyPath}[${i}]`, out);
    }
    return;
  }

  const rec = value as Record<string, unknown>;

  for (const [k, v] of Object.entries(rec)) {
    const path = keyPath ? `${keyPath}.${k}` : k;

    if (typeof v === "string") {
      const lower = k.toLowerCase();
      const looksLikePathToImage =
        /\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i.test(v) || /\/image\/|\/images\/|\/photos\//i.test(v);
      const looksImageKey =
        lower.includes("image") ||
        lower.includes("thumb") ||
        lower.includes("photo") ||
        lower.includes("picture") ||
        lower.includes("banner") ||
        lower === "url" ||
        lower === "href" ||
        lower === "src" ||
        lower === "urltoimage" ||
        (lower === "link" && looksLikePathToImage);

      if (looksImageKey || k in FIELD_PRIORITY) {
        const u = normalizeMediaUrl(v, articleLink);
        if (u) addCandidate(out, u, k, articleLink);
      }
      continue;
    }

    if (v && typeof v === "object") {
      walkForImages(v, articleLink, depth + 1, path, out);
    }
  }
}

/**
 * Picks the best available image URL from a raw news article object.
 * Resolves protocol-relative and article-relative URLs using `articleLink`.
 * Pass `htmlContent` when the API embeds article HTML in `content` — may contain og:image / twitter:image.
 */
/** Pull a direct image URL if the article body mentions one (plain-text APIs). */
export function extractImageUrlFromPlainText(text: string): string | null {
  if (!text || text.length < 12) return null;
  const re = /https?:\/\/[^\s"'<>\\\]]+?\.(?:jpe?g|png|gif|webp|avif)(?:\?[^\s"'<>\\\]]*)?/gi;
  const m = text.match(re);
  if (!m?.[0]) return null;
  return m[0].replace(/[),.;:]+$/g, "");
}

export function pickBestImageUrl(
  raw: Record<string, unknown>,
  articleLink: string,
  htmlContent?: string,
): string | null {
  const candidates = new Map<string, Candidate>();

  for (const k of EXPLICIT_IMAGE_KEYS) {
    const v = raw[k];
    if (typeof v === "string") {
      const u = normalizeMediaUrl(v, articleLink);
      if (u) addCandidate(candidates, u, k, articleLink);
    }
  }

  walkForImages(raw, articleLink, 0, "", candidates);

  if (htmlContent) {
    extractMetaImageFromHtml(htmlContent, articleLink, candidates);
  }

  if (candidates.size === 0) return null;

  let best: Candidate | null = null;
  for (const c of candidates.values()) {
    if (!best || c.score > best.score) best = c;
  }
  return best?.url ?? null;
}
