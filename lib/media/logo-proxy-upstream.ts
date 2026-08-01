import "server-only";

import { unstable_cache } from "next/cache";

import { tryConsumeLogoDevUpstreamSlot } from "@/lib/market/logo-dev-upstream-budget";

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
): string | null {
  const key = serverLogoDevToken();
  if (!key) return null;
  const tok = encodeURIComponent(key);
  const themeQ = `&format=png&theme=${theme === "dark" ? "dark" : "light"}`;
  if (kind === "stock") {
    const sym = id.trim().toLowerCase().replace(/\./g, "-");
    if (!sym) return null;
    return `https://img.logo.dev/ticker/${encodeURIComponent(sym)}?token=${tok}&size=128${themeQ}`;
  }
  if (kind === "crypto") {
    const c = id.trim().toLowerCase();
    if (!c) return null;
    return `https://img.logo.dev/crypto/${encodeURIComponent(c)}?token=${tok}&size=128${themeQ}`;
  }
  const host = id.trim().toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  return `https://img.logo.dev/${encodeURIComponent(host)}?token=${tok}&size=128${themeQ}`;
}

async function fetchLogoUpstreamUncached(
  kind: LogoProxyKind,
  normId: string,
  theme: LogoDevTheme,
): Promise<{ contentType: string; base64: string } | null> {
  const url = buildLogoDevUpstreamUrl(kind, normId, theme);
  if (!url) return null;
  if (!tryConsumeLogoDevUpstreamSlot()) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 2_000_000) return null;
    return { contentType, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}

/**
 * One Logo.dev fetch per (kind, id, theme) per revalidate window — shared by all users
 * (browser hits `/api/media/logo` only).
 */
export const getCachedLogoFromUpstream = unstable_cache(
  async (kind: LogoProxyKind, normId: string, theme: LogoDevTheme = "light") =>
    fetchLogoUpstreamUncached(kind, normId, theme),
  [LOGO_PROXY_UNSTABLE_CACHE_KEY],
  { revalidate: LOGO_PROXY_CACHE_MAX_AGE_SEC },
);
