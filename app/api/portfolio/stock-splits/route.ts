import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";
import {
  restoreAdjustedCloseTradePrices,
  stripAutoCorporateActionSplits,
} from "@/lib/portfolio/heal-adjusted-trade-prices";
import { parsePortfolioValueHistoryBody } from "@/lib/portfolio/portfolio-value-history.server";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { AuthRequiredError, requireAuthUserFromRequest } from "@/lib/watchlist/api-auth";

/**
 * Repair portfolio ledger for continuous (chart-scale) prices:
 * - strip auto-injected stock-split corporate-action rows that rebased share counts
 * - restore prices that were rewritten to as-traded unadjusted closes (cash outflows 10×)
 *
 * Does **not** append new Split corporate actions — share quantities stay as entered.
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

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (!o) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const portfolioId = typeof o.portfolioId === "string" ? o.portfolioId.trim() : "";
    if (!portfolioId) {
      return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
    }

    const parsed = parsePortfolioValueHistoryBody({
      range: "all",
      transactions: o.transactions,
    });
    if (!parsed) {
      return NextResponse.json({ error: "Invalid transactions" }, { status: 400 });
    }

    const transactions = parsed.transactions as PortfolioTransaction[];
    const stripped = stripAutoCorporateActionSplits(transactions);
    const restored = await restoreAdjustedCloseTradePrices(stripped.transactions);

    const changed = stripped.removed + restored.changed;
    if (changed === 0) {
      return NextResponse.json(
        {
          added: [],
          transactions: transactions,
          pricesHealed: 0,
          splitsRemoved: 0,
          pricesRestored: 0,
        },
        { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
      );
    }

    const { transactions: next } = migratePortfolioTransactionSequences(
      sortPortfolioTransactionsCanonical(restored.transactions),
    );

    return NextResponse.json(
      {
        added: [],
        transactions: next,
        pricesHealed: restored.changed,
        splitsRemoved: stripped.removed,
        pricesRestored: restored.changed,
      },
      { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio stock-splits]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
