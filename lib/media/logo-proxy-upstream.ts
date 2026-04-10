import "server-only";

import { unstable_cache } from "next/cache";

import { tryConsumeLogoDevUpstreamSlot } from "@/lib/market/logo-dev-upstream-budget";

function serverLogoDevToken(): string {
  return (
    process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim() || ""
  );
}

export type LogoProxyKind = "stock" | "crypto" | "domain";

export function buildLogoDevUpstreamUrl(kind: LogoProxyKind, id: string): string | null {
  const key = serverLogoDevToken();
  if (!key) return null;
  const tok = encodeURIComponent(key);
  if (kind === "stock") {
    const sym = id.trim().toLowerCase();
    if (!sym) return null;
    return `https://img.logo.dev/ticker/${encodeURIComponent(sym)}?token=${tok}&size=128`;
  }
  if (kind === "crypto") {
    const c = id.trim().toLowerCase();
    if (!c) return null;
    return `https://img.logo.dev/crypto/${encodeURIComponent(c)}?token=${tok}&size=128`;
  }
  const host = id.trim().toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  return `https://img.logo.dev/${encodeURIComponent(host)}?token=${tok}&size=128`;
}

async function fetchLogoUpstreamUncached(
  kind: LogoProxyKind,
  normId: string,
): Promise<{ contentType: string; base64: string } | null> {
  const url = buildLogoDevUpstreamUrl(kind, normId);
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
 * One Logo.dev fetch per (kind, id) per revalidate window — shared by all users (browser hits `/api/media/logo` only).
 */
export const getCachedLogoFromUpstream = unstable_cache(
  async (kind: LogoProxyKind, normId: string) => fetchLogoUpstreamUncached(kind, normId),
  ["finsepa-logo-proxy-upstream-v1"],
  { revalidate: 604800 },
);
