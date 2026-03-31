import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdScreenerCandidates } from "@/lib/market/eodhd-screener";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

type Ctx = { params: Promise<{ ticker: string }> };

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export async function GET(_request: Request, { params }: Ctx) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker: raw } = await params;

  let ticker: string;
  try {
    ticker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const root = await fetchEodhdFundamentalsJson(ticker);
  const general =
    root && typeof root === "object" && root.General && typeof root.General === "object"
      ? (root.General as Record<string, unknown>)
      : null;

  const industry = str(general?.Industry);
  const sector = str(general?.Sector);

  // Pull candidates from the same industry (fallback sector). Provider handles sorting by market cap desc.
  const candidates = await fetchEodhdScreenerCandidates({ q: { industry, sector }, limit: 40 });

  // Remove the main ticker; keep common-stock-like results only (best-effort).
  const cleaned = candidates.filter((c) => c.ticker !== ticker);

  // Prefer closest market cap among candidates if main cap exists.
  const mainCap =
    root && typeof root === "object" && root.Highlights && typeof root.Highlights === "object"
      ? (root.Highlights as Record<string, unknown>).MarketCapitalization
      : null;
  const mainCapNum = typeof mainCap === "number" && Number.isFinite(mainCap) ? mainCap : null;

  let peers = cleaned;
  if (mainCapNum != null) {
    peers = [...cleaned].sort((a, b) => {
      const da = Math.abs(a.marketCapUsd - mainCapNum);
      const db = Math.abs(b.marketCapUsd - mainCapNum);
      if (da !== db) return da - db;
      return b.marketCapUsd - a.marketCapUsd;
    });
  }

  const peerTickers = peers.slice(0, 5).map((p) => p.ticker);

  return NextResponse.json({
    ticker,
    sector,
    industry,
    peers: peerTickers,
  });
}

