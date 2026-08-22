import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_WARM } from "@/lib/data/cache-policy";
import { loadSuperinvestorsListRows } from "@/lib/superinvestors/load-superinvestors-list-rows";

export const runtime = "nodejs";

const MAX_LIMIT = 100;

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
 * Optional `?limit=N` (max 100). Omit limit to return the full snapshot (web parity).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const allRows = await loadSuperinvestorsListRows();
    const limitParam = url.searchParams.get("limit");
    let rows = allRows;
    if (limitParam != null && limitParam !== "") {
      const rawLimit = Number(limitParam);
      if (Number.isFinite(rawLimit) && rawLimit > 0) {
        rows = allRows.slice(0, Math.min(MAX_LIMIT, Math.floor(rawLimit)));
      }
    }

    const origin = appOrigin();
    const payload = rows.map((row) => ({
      href: row.href,
      displayName: row.displayName,
      avatarSrc: absoluteAvatarSrc(row.avatarSrc, origin),
      totalValueUsd: row.totalValueUsd,
      positionCount: row.positionCount,
      filingDate: row.filingDate,
      activityCount: row.activityCount ?? 0,
    }));

    return NextResponse.json(
      { rows: payload },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_WARM } },
    );
  } catch {
    return NextResponse.json({ error: "Could not load superinvestors" }, { status: 502 });
  }
}
