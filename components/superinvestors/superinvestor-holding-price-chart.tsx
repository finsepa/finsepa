"use client";

import { useMemo } from "react";

import type { HoldingsTradeTooltipItem } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { superinvestorQuarterBandsFromTransactions } from "@/lib/superinvestors/superinvestor-chart-quarter-bands";
import type { SuperinvestorQuarterlyTransaction } from "@/lib/superinvestors/types";
import type { HoldingEarlierActivitySummary } from "@/lib/superinvestors/superinvestor-transaction-utils";
import {
  formatEarlierActivityLines,
  superinvestorTransactionActivityHeadline,
} from "@/lib/superinvestors/superinvestor-transaction-utils";

function tradeTooltipItemsFromTransactions(
  txs: readonly SuperinvestorQuarterlyTransaction[],
): HoldingsTradeTooltipItem[] {
  const byDate = new Map<string, string[]>();
  for (const tx of txs) {
    const date = tx.reportDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const headline = superinvestorTransactionActivityHeadline(tx.kind, tx.sharesChangePct, tx.sharesDelta);
    const lines = byDate.get(date) ?? [];
    lines.push(`${tx.quarterLabel} · ${headline}`);
    byDate.set(date, lines);
  }
  return [...byDate.entries()].map(([date, lines]) => ({ date, lines }));
}

export function SuperinvestorHoldingPriceChart({
  ticker,
  transactions,
  earlierActivitySummary = null,
}: {
  ticker: string;
  transactions: readonly SuperinvestorQuarterlyTransaction[];
  earlierActivitySummary?: HoldingEarlierActivitySummary | null;
}) {
  const sym = ticker.trim().toUpperCase();

  const holdingsQuarterBands = useMemo(
    () => superinvestorQuarterBandsFromTransactions(transactions),
    [transactions],
  );
  const tradeTooltipItems = useMemo(() => tradeTooltipItemsFromTransactions(transactions), [transactions]);

  return (
    <section className="mb-6">
      <div className="overflow-visible rounded-[12px] bg-white">
        <PriceChart
          kind="stock"
          symbol={sym}
          range="5Y"
          chartDataCadence="daily"
          holdingsStyle
          holdingsQuarterBands={holdingsQuarterBands}
          holdingsEarlierSummary={earlierActivitySummary}
          tradeTooltipItems={tradeTooltipItems}
        />
      </div>
    </section>
  );
}
