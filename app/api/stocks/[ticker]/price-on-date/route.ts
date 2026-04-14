import { NextResponse } from "next/server";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { ticker: raw } = await params;
  const date = new URL(request.url).searchParams.get("date");

  let routeTicker: string;
  try {
    routeTicker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (use YYYY-MM-DD)." }, { status: 400 });
  }

  // Use EOD adjusted close (split-adjusted) so portfolio transactions match the chart scale.
  // EODHD provides `adjusted_close` for US equities; our fetcher prefers it when present.
  const from = (() => {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 28);
    return d.toISOString().slice(0, 10);
  })();
  const bars = await fetchEodhdEodDaily(routeTicker, from, date);
  const pick = bars && bars.length ? bars[bars.length - 1]! : null;
  if (!pick || !Number.isFinite(pick.close) || pick.close <= 0) {
    return NextResponse.json({ price: null, barDate: null, source: null }, { status: 404 });
  }

  return NextResponse.json({
    price: pick.close,
    barDate: pick.date,
    source: "adjusted_close",
  });
}
