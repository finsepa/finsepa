"use client";

import { useEffect, useState } from "react";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { averageAnnualPortfolioReturnPct } from "@/lib/portfolio/portfolio-average-annual-return";
import type { PortfolioPeriodReturnBar } from "@/lib/portfolio/portfolio-period-returns-types";
import { portfolioValueHistoryLedgerKey } from "@/lib/portfolio/portfolio-value-history-client-cache";

export function usePortfolioAverageAnnualReturnPct(
  transactions: readonly PortfolioTransaction[],
  enabled = true,
): number | null {
  const [pct, setPct] = useState<number | null>(null);
  const ledgerKey = portfolioValueHistoryLedgerKey(transactions);
  const canLoad = enabled && transactions.length > 0;

  useEffect(() => {
    if (!canLoad) {
      setPct(null);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portfolio/period-returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            transactions,
            granularity: "annually",
            benchmark: "SPY",
          }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { bars?: PortfolioPeriodReturnBar[] };
        const avg = averageAnnualPortfolioReturnPct(Array.isArray(json.bars) ? json.bars : []);
        if (!cancelled) setPct(avg);
      } catch {
        if (!cancelled) setPct(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [canLoad, ledgerKey, transactions, enabled]);

  return pct;
}
