import "server-only";

import { unstable_cache } from "next/cache";

import { tryConsumeLogoDevUpstreamSlot } from "@/lib/market/logo-dev-upstream-budget";
import { LOGO_TILE_VERSION, renderLogoTile } from "@/lib/media/logo-tile";

/**
 * Logos change rarely — long TTLs mean one Logo.dev fetch per symbol benefits all users (Next Data Cache +
 * CDN/browser `Cache-Control`). Keep in sync with `app/api/media/logo/route.ts` (same constants).
 */
export const LOGO_PROXY_CACHE_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30d
/** After `max-age`, CDNs may serve stale bytes while revalidating in the background (reduces stampedes). */
export const LOGO_PROXY_STALE_WHILE_REVALIDATE_SEC = 7 * 24 * 60 * 60; // 7d

/** Bump when changing cache policy so old Data Cache entries are not reused. */
const LOGO_PROXY_UNSTABLE_CACHE_KEY = "finsepa-logo-proxy-upstream-v4" as const;

function serverLogoDevToken(): string {
  return (
    process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim() || ""
  );
}

export type LogoProxyKind = "stock" | "crypto" | "domain";

/** Logo.dev `theme` — adjusts mark colors for light/dark UI surfaces (`format=png` required). */
export type LogoDevTheme = "light" | "dark";

export function buildLogoDevUpstreamUrl(
  kind: LogoProxyKind,
  id: string,
  theme: LogoDevTheme = "light",
  size = 128,
): string | null {
  const key = serverLogoDevToken();
  if (!key) return null;
  const tok = encodeURIComponent(key);
  const themeQ = `&size=${size}&format=png&theme=${theme === "dark" ? "dark" : "light"}`;
  if (kind === "stock") {
    const sym = id.trim().toLowerCase().replace(/\./g, "-");
    if (!sym) return null;
    return `https://img.logo.dev/ticker/${encodeURIComponent(sym)}?token=${tok}${themeQ}`;
  }
  if (kind === "crypto") {
    const c = id.trim().toLowerCase();
    if (!c) return null;
    return `https://img.logo.dev/crypto/${encodeURIComponent(c)}?token=${tok}${themeQ}`;
  }
  const host = id.trim().toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  return `https://img.logo.dev/${encodeURIComponent(host)}?token=${tok}${themeQ}`;
}

async function fetchLogoUpstreamUncached(
  kind: LogoProxyKind,
  normId: string,
  theme: LogoDevTheme,
  size = 128,
): Promise<{ contentType: string; base64: string } | null> {
  const url = buildLogoDevUpstreamUrl(kind, normId, theme, size);
  if (!url) return null;
  if (!tryConsumeLogoDevUpstreamSlot()) throw new LogoUpstreamTransientError("budget");
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new LogoUpstreamTransientError("network");
  }
  if (res.status === 429 || res.status >= 500) throw new LogoUpstreamTransientError(String(res.status));
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!contentType.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > 2_000_000) return null;
  return { contentType, base64: buf.toString("base64") };
}

/**
 * Rate limits / outages must not be cached as "no logo" for 30 days — throwing keeps
 * `unstable_cache` from storing the miss, so the next request retries.
 */
class LogoUpstreamTransientError extends Error {
  constructor(reason: string) {
    super(`logo upstream transient: ${reason}`);
  }
}

/** `null` = definite miss (cached); `"transient"` = rate limit / outage (not cached — caller should not long-cache). */
async function uncachedOnTransient<T>(load: () => Promise<T | null>): Promise<T | null | "transient"> {
  try {
    return await load();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("logo upstream transient")) return "transient";
    throw e;
  }
}

/**
 * One Logo.dev fetch per (kind, id, theme) per revalidate window — shared by all users
 * (browser hits `/api/media/logo` only).
 */
const getCachedLogoFromUpstreamInner = unstable_cache(
  async (kind: LogoProxyKind, normId: string, theme: LogoDevTheme = "light") =>
    fetchLogoUpstreamUncached(kind, normId, theme),
  [LOGO_PROXY_UNSTABLE_CACHE_KEY],
  { revalidate: LOGO_PROXY_CACHE_MAX_AGE_SEC },
);

export function getCachedLogoFromUpstream(kind: LogoProxyKind, normId: string, theme: LogoDevTheme = "light") {
  return uncachedOnTransient(() => getCachedLogoFromUpstreamInner(kind, normId, theme));
}

/**
 * Uniform tile (same in light + dark): light-theme artwork at 256px, normalized by
 * {@link renderLogoTile}. Falls back to the untouched upstream bytes if rendering fails.
 */
const getCachedLogoTileInner = unstable_cache(
  async (kind: LogoProxyKind, normId: string): Promise<{ contentType: string; base64: string } | null> => {
    const src = await fetchLogoUpstreamUncached(kind, normId, "light", 256);
    if (!src) return null;
    try {
      const tile = await renderLogoTile(Buffer.from(src.base64, "base64"));
      return tile ? { contentType: "image/png", base64: tile.toString("base64") } : null;
    } catch {
      return src;
    }
  },
  [`finsepa-logo-tile-v${LOGO_TILE_VERSION}`],
  { revalidate: LOGO_PROXY_CACHE_MAX_AGE_SEC },
);

export function getCachedLogoTile(kind: LogoProxyKind, normId: string) {
  return uncachedOnTransient(() => getCachedLogoTileInner(kind, normId));
}
