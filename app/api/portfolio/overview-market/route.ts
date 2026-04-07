import { NextResponse } from "next/server";

import { fetchEodhdOpenPriceOnOrBefore } from "@/lib/market/eodhd-eod";
import { fetchEodhdKeyStatsDividends } from "@/lib/market/eodhd-key-stats-dividends";
import { getStockPerformance } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SPY = "SPY";

function parseDividendYieldPctFromRows(rows: { label: string; value: string }[] | undefined): number | null {
  if (!rows?.length) return null;
  const row = rows.find((r) => r.label.toLowerCase().includes("yield"));
  if (!row?.value) return null;
  const m = row.value.match(/([\d.]+)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

type Body = {
  symbols?: unknown;
  inceptionYmd?: unknown;
  inceptionPriceTickers?: unknown;
};

/**
 * Single round-trip for portfolio overview: performance + dividend yields + inception open prices.
 * Replaces many sequential GETs from the client.
 */
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawSyms = Array.isArray(body.symbols) ? body.symbols.filter((s): s is string => typeof s === "string") : [];
    const symbols = [...new Set(rawSyms.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0))];

    const inceptionYmd =
      typeof body.inceptionYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.inceptionYmd)
        ? body.inceptionYmd
        : null;

    const rawPriceTk =
      Array.isArray(body.inceptionPriceTickers) ?
        body.inceptionPriceTickers.filter((s): s is string => typeof s === "string")
      : [];
    const inceptionPriceTickers = [
      ...new Set(rawPriceTk.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0)),
    ];

    const tickersPerf = [...new Set([SPY, ...symbols])];

    const [
      perfEntries,
      yieldEntries,
      priceEntries,
    ] = await Promise.all([
      Promise.all(
        tickersPerf.map(async (t) => {
          try {
            const p = await getStockPerformance(t);
            return [t, p] as const;
          } catch {
            return [t, null] as const;
          }
        }),
      ),
      Promise.all(
        symbols.map(async (t) => {
          try {
            const data = await fetchEodhdKeyStatsDividends(t);
            return [t, parseDividendYieldPctFromRows(data?.rows)] as const;
          } catch {
            return [t, null] as const;
          }
        }),
      ),
      inceptionYmd && inceptionPriceTickers.length > 0 ?
        Promise.all(
          inceptionPriceTickers.map(async (t) => {
            try {
              const r = await fetchEodhdOpenPriceOnOrBefore(t, inceptionYmd);
              return [t, r?.price ?? null] as const;
            } catch {
              return [t, null] as const;
            }
          }),
        )
      : Promise.resolve([] as (readonly [string, number | null])[]),
    ]);

    const performanceBySymbol: Record<string, StockPerformance | null> = {};
    let spyPerf: StockPerformance | null = null;
    for (const [t, p] of perfEntries) {
      if (t === SPY) spyPerf = p;
      if (symbols.includes(t)) performanceBySymbol[t] = p;
    }
    for (const s of symbols) {
      if (!(s in performanceBySymbol)) performanceBySymbol[s] = null;
    }

    const yieldBySymbol: Record<string, number | null> = Object.fromEntries(yieldEntries);

    const inceptionPriceByTicker: Record<string, number | null> = Object.fromEntries(priceEntries);

    return NextResponse.json(
      {
        spy: spyPerf,
        performanceBySymbol,
        yieldBySymbol,
        inceptionPriceByTicker,
        inceptionYmd,
      },
      {
        headers: {
          "Cache-Control": "private, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio overview-market]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
