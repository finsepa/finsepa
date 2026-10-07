import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import { isUsEquityExchangeHolidayYmd } from "@/lib/market/us-equity-exchange-holidays";
import { loadPortfolioEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { nyCalendarYmd, previousNyTradingDayYmd } from "@/lib/screener/screener-us-market-cache";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";

const MAX_SYMBOLS = 200;
const WEEK_DAYS = 7;
/** Extra lookback so a start on a weekend / holiday still finds the prior session close. */
const LOOKBACK_PAD_DAYS = 10;

type Period = "1d" | "7d";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function addDaysYmd(ymd: string, days: number): string {
  return ymdUtc(addDaysUtc(new Date(`${ymd}T00:00:00Z`), days));
}

/** Current US session date — the last trading day on weekends / holidays (so 1D shows that session's move). */
function usSessionYmd(now: Date): string {
  const ymd = nyCalendarYmd(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
  const tradingDay = weekday !== "Sat" && weekday !== "Sun" && !isUsEquityExchangeHolidayYmd(ymd);
  return tradingDay ? ymd : previousNyTradingDayYmd(now);
}

/**
 * POST `{ symbols, period? }` → per-symbol start close for Home's biggest contributors.
 * - `7d` (default): last daily close on or before 7 days ago.
 * - `1d`: last daily close before the current session (crypto: before today UTC).
 * `startYmds[symbol]` is the close's date — trades after it count as in-period.
 */
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
    const period: Period = (body as { period?: unknown }).period === "1d" ? "1d" : "7d";
    const symbols = [
      ...new Set(
        raw
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ),
    ].slice(0, MAX_SYMBOLS);

    const now = new Date();
    const weekStartYmd = ymdUtc(addDaysUtc(now, -WEEK_DAYS));
    const usSession = usSessionYmd(now);
    const cryptoSession = ymdUtc(now);
    const fromYmd = ymdUtc(addDaysUtc(now, -(WEEK_DAYS + LOOKBACK_PAD_DAYS)));
    const toYmd = ymdUtc(now);

    const barsBySymbol = await loadPortfolioEodBars(symbols, fromYmd, toYmd);
    const closes: Record<string, number | null> = {};
    const startYmds: Record<string, string> = {};
    for (const sym of symbols) {
      const bars = barsBySymbol.get(sym) ?? [];
      let close: number | null = null;
      let closeYmd: string | null = null;
      if (period === "7d") {
        for (const b of bars) {
          if (b.date > weekStartYmd) break;
          close = b.close;
        }
        closeYmd = weekStartYmd;
      } else {
        const session = toEodhdCryptoSymbol(sym) != null ? cryptoSession : usSession;
        for (const b of bars) {
          if (b.date >= session) break;
          close = b.close;
          closeYmd = b.date;
        }
        closeYmd ??= addDaysYmd(session, -1);
      }
      closes[sym] = close;
      startYmds[sym] = closeYmd;
    }

    return NextResponse.json(
      { period, closes, startYmds },
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
