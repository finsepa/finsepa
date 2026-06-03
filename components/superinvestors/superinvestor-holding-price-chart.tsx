"use client";

import { useMemo } from "react";

import type { HoldingsTradeMarker, HoldingsTradeTooltipItem } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import type { SuperinvestorQuarterlyTransaction } from "@/lib/superinvestors/types";
import {
  superinvestorTransactionActivityHeadline,
  superinvestorTxTradeMarkerSide,
} from "@/lib/superinvestors/superinvestor-transaction-utils";

function tradeMarkersFromTransactions(
  txs: readonly SuperinvestorQuarterlyTransaction[],
): readonly HoldingsTradeMarker[] {
  const seen = new Set<string>();
  const out: HoldingsTradeMarker[] = [];
  for (const tx of [...txs].sort((a, b) => a.reportDate.localeCompare(b.reportDate))) {
    const date = tx.reportDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const key = `${date}|${superinvestorTxTradeMarkerSide(tx.kind)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, side: superinvestorTxTradeMarkerSide(tx.kind) });
  }
  return out;
}

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
}: {
  ticker: string;
  transactions: readonly SuperinvestorQuarterlyTransaction[];
}) {
  const sym = ticker.trim().toUpperCase();

  const tradeMarkers = useMemo(() => tradeMarkersFromTransactions(transactions), [transactions]);
  const tradeTooltipItems = useMemo(() => tradeTooltipItemsFromTransactions(transactions), [transactions]);

  return (
    <section className="mb-6 space-y-4">
      <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Price</h3>
      <div className="overflow-visible rounded-[12px] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        <PriceChart
          kind="stock"
          symbol={sym}
          range="5Y"
          holdingsStyle
          tradeMarkers={tradeMarkers}
          tradeTooltipItems={tradeTooltipItems}
        />
      </div>
    </section>
  );
}
