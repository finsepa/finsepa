import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { loadPortfolioEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";

const MAX_SYMBOLS = 200;
const WEEK_DAYS = 7;
/** Extra lookback so a week start on a weekend / holiday still finds the prior session close. */
const LOOKBACK_PAD_DAYS = 10;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** POST `{ symbols }` → last daily close on or before 7 days ago, per symbol (for weekly P/L on Home). */
export async function POST(request: Request) {
  try {
    await requireAuthUserFromRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const raw = (body as { symbols?: unknown })?.symbols;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const symbols = [
      ...new Set(
        raw
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ),
    ].slice(0, MAX_SYMBOLS);

    const today = new Date();
    const weekStartYmd = ymdUtc(addDaysUtc(today, -WEEK_DAYS));
    const fromYmd = ymdUtc(addDaysUtc(today, -(WEEK_DAYS + LOOKBACK_PAD_DAYS)));
    const toYmd = ymdUtc(today);

    const barsBySymbol = await loadPortfolioEodBars(symbols, fromYmd, toYmd);
    const closes: Record<string, number | null> = {};
    for (const sym of symbols) {
      const bars = barsBySymbol.get(sym) ?? [];
      let close: number | null = null;
      for (const b of bars) {
        if (b.date <= weekStartYmd) close = b.close;
        else break;
      }
      closes[sym] = close;
    }

    return NextResponse.json(
      { weekStartYmd, closes },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM } },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio week-start-closes]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
