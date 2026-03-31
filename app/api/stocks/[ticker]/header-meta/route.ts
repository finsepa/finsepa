import { NextResponse } from "next/server";

import { fetchEodhdFundamentalsJson, resolveEarningsDateDisplay } from "@/lib/market/eodhd-fundamentals";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { countWatchlistEntriesForStockTicker } from "@/lib/watchlist/stock-watchlist-count";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { ticker: raw } = await params;

  let routeTicker: string;
  try {
    routeTicker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const [root, watchlistCount] = await Promise.all([
    fetchEodhdFundamentalsJson(routeTicker),
    countWatchlistEntriesForStockTicker(routeTicker),
  ]);

  const general =
    root && typeof root === "object" && root.General && typeof root.General === "object"
      ? (root.General as Record<string, unknown>)
      : null;
  const highlights =
    root && typeof root === "object" && root.Highlights && typeof root.Highlights === "object"
      ? (root.Highlights as Record<string, unknown>)
      : null;

  const fullNameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName ?? null;
  const fullName = typeof fullNameRaw === "string" && fullNameRaw.trim() ? fullNameRaw.trim() : null;

  const websiteRaw = general?.WebURL ?? general?.Website ?? general?.URL ?? null;
  let logoUrl: string | null = null;
  if (typeof websiteRaw === "string" && websiteRaw.trim()) {
    try {
      const u = new URL(websiteRaw.includes("://") ? websiteRaw : `https://${websiteRaw}`);
      const host = u.hostname.replace(/^www\./, "").trim().toLowerCase();
      if (host) logoUrl = companyLogoUrlFromDomain(host);
    } catch {
      // ignore invalid website URL
    }
  }

  const sectorRaw = general?.Sector ?? null;
  const sector = typeof sectorRaw === "string" && sectorRaw.trim() ? sectorRaw.trim() : null;

  const industryRaw = general?.Industry ?? null;
  const industry = typeof industryRaw === "string" && industryRaw.trim() ? industryRaw.trim() : null;

  const earningsDateDisplay = root ? resolveEarningsDateDisplay(highlights, root) : null;

  return NextResponse.json({
    ticker: routeTicker,
    fullName,
    logoUrl,
    sector,
    industry,
    earningsDateDisplay,
    watchlistCount,
  });
}
