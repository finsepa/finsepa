import { NextResponse } from "next/server";

import {
  fetchEodhdInsiderTransactions,
  resolveInsiderQueryWindow,
} from "@/lib/market/eodhd-insider-transactions";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Ctx = { params: Promise<{ ticker: string }> };

function parseLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
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

  const sp = new URL(request.url).searchParams;
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  if (fromRaw && !YMD.test(fromRaw)) {
    return NextResponse.json({ error: "Invalid `from` — use YYYY-MM-DD." }, { status: 400 });
  }
  if (toRaw && !YMD.test(toRaw)) {
    return NextResponse.json({ error: "Invalid `to` — use YYYY-MM-DD." }, { status: 400 });
  }

  const limit = parseLimit(sp.get("limit"));
  if (limit != null && (!Number.isFinite(limit) || limit < 1 || limit > 1000)) {
    return NextResponse.json({ error: "Invalid `limit` — use 1–1000." }, { status: 400 });
  }

  const { from, to } = resolveInsiderQueryWindow({
    from: fromRaw ?? undefined,
    to: toRaw ?? undefined,
  });

  const rows = await fetchEodhdInsiderTransactions(routeTicker, {
    from,
    to,
    limit,
  });

  return NextResponse.json({ ticker: routeTicker, rows, windowFrom: from, windowTo: to });
}
