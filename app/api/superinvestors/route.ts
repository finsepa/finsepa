import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_WARM } from "@/lib/data/cache-policy";
import { loadSuperinvestorsListRows } from "@/lib/superinvestors/load-superinvestors-list-rows";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

function appOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://app.finsepa.com";
  return raw.replace(/\/$/, "");
}

function absoluteAvatarSrc(src: string | null | undefined, origin: string): string | null {
  if (!src?.trim()) return null;
  const trimmed = src.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
}

/**
 * Superinvestors list for iOS / clients — snapshot-only (same rows as web table).
 * Query: `?limit=5` (default 5, max 50). Sorted by AUM desc in the snapshot.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
      : DEFAULT_LIMIT;

    const origin = appOrigin();
    const rows = (await loadSuperinvestorsListRows()).slice(0, limit).map((row) => ({
      href: row.href,
      displayName: row.displayName,
      avatarSrc: absoluteAvatarSrc(row.avatarSrc, origin),
      totalValueUsd: row.totalValueUsd,
      positionCount: row.positionCount,
      filingDate: row.filingDate,
    }));

    return NextResponse.json(
      { rows },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_WARM } },
    );
  } catch {
    return NextResponse.json({ error: "Could not load superinvestors" }, { status: 502 });
  }
}
