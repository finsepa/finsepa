import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM_CHART } from "@/lib/data/cache-policy";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import {
  earningsDateDisplayToYmd,
  earningsDaysLeftFromYmd,
} from "@/lib/market/earnings-countdown";
import {
  getStockHeaderEarningsLineForTicker,
  getStockHeaderIdentityForTicker,
} from "@/lib/market/stock-header-meta-server";
import type { PortfolioEarningsDateEntry } from "@/lib/portfolio/portfolio-earnings-dates";
import { isStockDetailEtf } from "@/lib/stock/stock-etf";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";

type Body = { symbols?: unknown };

function naEntry(): PortfolioEarningsDateEntry {
  return {
    earningsDateDisplay: null,
    fiscalQuarter: null,
    earningsDateYmd: null,
    daysLeft: null,
    notApplicable: true,
  };
}

function emptyEntry(): PortfolioEarningsDateEntry {
  return {
    earningsDateDisplay: null,
    fiscalQuarter: null,
    earningsDateYmd: null,
    daysLeft: null,
    notApplicable: false,
  };
}

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

    const raw = Array.isArray(body.symbols) ? body.symbols.filter((s): s is string => typeof s === "string") : [];
    const symbols = [...new Set(raw.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 80);

    const entries = await Promise.all(
      symbols.map(async (sym) => {
        const cryptoKey = cryptoRouteBase(sym);
        if (isSupportedCryptoAssetSymbol(cryptoKey)) {
          return [sym, naEntry()] as const;
        }

        try {
          // Both slices share the same cached fundamentals payload. Start them together so
          // uncached portfolios avoid a per-symbol identity → earnings waterfall.
          const [identity, earningsLine] = await Promise.all([
            getStockHeaderIdentityForTicker(sym),
            getStockHeaderEarningsLineForTicker(sym),
          ]);
          if (
            isStockDetailEtf(sym, {
              ...identity,
              earningsDateDisplay: null,
              watchlistCount: null,
              screenerRank: null,
            })
          ) {
            return [sym, naEntry()] as const;
          }

          const { earningsDateDisplay, fiscalQuarter } = earningsLine;
          const display = earningsDateDisplay?.trim() ? earningsDateDisplay.trim() : null;
          const earningsDateYmd = earningsDateDisplayToYmd(display);
          return [
            sym,
            {
              earningsDateDisplay: display,
              fiscalQuarter: fiscalQuarter?.trim() ? fiscalQuarter.trim().toUpperCase() : null,
              earningsDateYmd,
              daysLeft: earningsDaysLeftFromYmd(earningsDateYmd),
              notApplicable: false,
            } satisfies PortfolioEarningsDateEntry,
          ] as const;
        } catch {
          return [sym, emptyEntry()] as const;
        }
      }),
    );

    const bySymbol = Object.fromEntries(entries) as Record<string, PortfolioEarningsDateEntry>;

    return NextResponse.json(
      { bySymbol },
      {
        headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio earnings-dates]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
