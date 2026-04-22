import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { fetchEodhdSplitsHistory } from "@/lib/market/eodhd-splits-dividends";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Ctx = { params: Promise<{ ticker: string }> };

function parseRange(searchParams: URLSearchParams) {
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  if (fromRaw && !YMD.test(fromRaw)) return { error: "Invalid `from` — use YYYY-MM-DD." } as const;
  if (toRaw && !YMD.test(toRaw)) return { error: "Invalid `to` — use YYYY-MM-DD." } as const;
  return {
    range: {
      ...(fromRaw ? { from: fromRaw } : {}),
      ...(toRaw ? { to: toRaw } : {}),
    },
  } as const;
}

export async function GET(request: Request, { params }: Ctx) {
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

  const parsed = parseRange(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const rows = await fetchEodhdSplitsHistory(routeTicker, parsed.range);
  return NextResponse.json(
    { ticker: routeTicker, rows },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM } },
  );
}
