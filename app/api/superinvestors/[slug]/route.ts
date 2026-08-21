import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_WARM } from "@/lib/data/cache-policy";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";
import { readSuperinvestor13fProfileSnapshotLatest } from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import type { Berkshire13fComparisonRow } from "@/lib/superinvestors/types";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

type Ctx = { params: Promise<{ slug: string }> };

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

/** Match web profile subtitle — title case, strip trailing Inc. */
function fundDisplayName(filerDisplayName: string): string {
  const words = filerDisplayName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  const joined = words.join(" ");
  return joined.replace(/\s+Inc\.?$/i, "").trim() || joined;
}

function mapHolding(row: Berkshire13fComparisonRow) {
  return {
    ticker: row.ticker?.trim().toUpperCase() || null,
    companyName: row.companyName,
    weight: row.weight,
    valueUsd: row.valueUsd,
    cusip: row.cusip,
  };
}

/** Top 9 by weight + Other — matches iOS / portfolio donut. */
function buildAllocation(rows: Berkshire13fComparisonRow[]) {
  const sorted = rows
    .filter((r) => Number.isFinite(r.weight) && r.weight > 0)
    .slice()
    .sort((a, b) => b.weight - a.weight);
  const top = sorted.slice(0, 9).map(mapHolding);
  const rest = sorted.slice(9);
  const otherWeight = rest.reduce((sum, r) => sum + r.weight, 0);
  const otherValue = rest.reduce((sum, r) => sum + r.valueUsd, 0);
  if (otherWeight > 0.001) {
    top.push({
      ticker: null,
      companyName: "Other",
      weight: otherWeight,
      valueUsd: otherValue,
      cusip: null,
    });
  }
  return top;
}

/**
 * Snapshot-only Superinvestor profile for iOS.
 * Query: `offset` (default 0), `limit` (default 25, max 50).
 */
export async function GET(request: Request, { params }: Ctx) {
  const { slug } = await params;
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) {
    return NextResponse.json({ error: "Unknown superinvestor" }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const rawOffset = Number(url.searchParams.get("offset") ?? 0);
    const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
      : DEFAULT_LIMIT;

    const cikPadded = cikPad10(SUPERINVESTOR_SLUG_CIK[slug] ?? "");
    if (!cikPadded) {
      return NextResponse.json({ error: "Unknown superinvestor" }, { status: 404 });
    }

    const snap = await readSuperinvestor13fProfileSnapshotLatest(cikPadded);
    if (!snap) {
      return NextResponse.json({ error: "Profile not ready" }, { status: 503 });
    }

    const { comparison } = snap;
    const allRows = comparison.rows;
    const holdings = allRows.slice(offset, offset + limit).map(mapHolding);
    const total = comparison.positionCount || allRows.length;
    const allocation = offset === 0 ? buildAllocation(allRows) : undefined;

    const origin = appOrigin();
    return NextResponse.json(
      {
        slug,
        managerName: item.managerName,
        fundName: fundDisplayName(comparison.filerDisplayName),
        avatarSrc: absoluteAvatarSrc(item.avatarSrc, origin),
        totalValueUsd: comparison.totalValueUsd,
        positionCount: total,
        filingDate: comparison.current.filingDate ?? comparison.current.reportDate,
        holdings,
        holdingsOffset: offset,
        holdingsLimit: limit,
        holdingsTotal: total,
        hasMoreHoldings: offset + holdings.length < total,
        ...(allocation ? { allocation } : {}),
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_WARM } },
    );
  } catch {
    return NextResponse.json({ error: "Could not load profile" }, { status: 502 });
  }
}
