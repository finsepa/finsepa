"use client";

import { memo, useMemo } from "react";

import type { Berkshire13fComparisonRow, SuperinvestorQuarterlyTransaction } from "@/lib/superinvestors/types";
import { SuperinvestorHoldingPriceChart } from "@/components/superinvestors/superinvestor-holding-price-chart";
import {
  SuperinvestorTransactionActivityCell,
  SuperinvestorTransactionPriceCells,
  superinvestorTxTdActivity,
} from "@/components/superinvestors/superinvestor-transaction-display";
import {
  cutoffYmdYearsAgo,
  holdingPanelTableTransactions,
  SUPERINVESTOR_HOLDING_PANEL_TABLE_LIMIT,
  SUPERINVESTOR_HOLDING_PANEL_YEARS,
  summarizeEarlierHoldingActivity,
  transactionsForHolding,
} from "@/lib/superinvestors/superinvestor-transaction-utils";
import { cn } from "@/lib/utils";
import { emptyDescriptionClassName } from "@/components/ui/empty";

const panelRowGridFour =
  "grid w-full min-w-[620px] grid-cols-[minmax(88px,0.75fr)_minmax(140px,1.15fr)_minmax(96px,0.9fr)_minmax(120px,1.05fr)] gap-x-4";

const panelHeaderGrid = cn(
  panelRowGridFour,
  "min-h-[44px] items-center bg-white px-4 text-[14px] font-medium leading-5 text-[#71717A]",
);

function SuperinvestorHoldingTransactionsPanelInner({
  row,
  resolvedTicker,
  allTransactions,
  onViewAllTransactions,
}: {
  row: Berkshire13fComparisonRow;
  resolvedTicker: string | null;
  allTransactions: SuperinvestorQuarterlyTransaction[];
  onViewAllTransactions: (searchQuery: string) => void;
}) {
  const chartWindowStartYmd = useMemo(() => cutoffYmdYearsAgo(SUPERINVESTOR_HOLDING_PANEL_YEARS), []);

  const holdingTransactionsAll = useMemo(
    () =>
      transactionsForHolding(allTransactions, row, resolvedTicker, 0).sort((a, b) =>
        b.reportDate.localeCompare(a.reportDate),
      ),
    [allTransactions, row, resolvedTicker],
  );

  const panelTransactions = useMemo(
    () => holdingTransactionsAll.filter((tx) => tx.reportDate.trim() >= chartWindowStartYmd),
    [holdingTransactionsAll, chartWindowStartYmd],
  );

  const earlierActivitySummary = useMemo(
    () => summarizeEarlierHoldingActivity(holdingTransactionsAll, chartWindowStartYmd),
    [holdingTransactionsAll, chartWindowStartYmd],
  );

  const tableTransactions = useMemo(
    () => holdingPanelTableTransactions(panelTransactions),
    [panelTransactions],
  );

  const hasMoreTableRows = panelTransactions.length > SUPERINVESTOR_HOLDING_PANEL_TABLE_LIMIT;

  const listingTicker = resolvedTicker?.trim() || row.ticker?.trim() || null;

  const searchQuery =
    resolvedTicker?.trim().toUpperCase() ||
    row.ticker?.trim().toUpperCase() ||
    row.companyName.trim();

  return (
    <div className="border-t-2 border-b-2 border-[#E4E4E7] bg-white px-2 pb-4 pt-3 sm:px-4" data-holding-expanded-panel>
      {listingTicker ?
        <SuperinvestorHoldingPriceChart
          ticker={listingTicker}
          transactions={panelTransactions}
          earlierActivitySummary={earlierActivitySummary}
        />
      : null}

      <h3 className="mb-3 text-[20px] font-semibold leading-7 tracking-tight text-[#09090B]">Activity</h3>

      {panelTransactions.length === 0 ? (
        <p className={cn("py-6 text-center", emptyDescriptionClassName)}>
          No 13F transactions found for this company.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className={panelHeaderGrid}>
              <div className="text-left">Period</div>
              <div className="text-right">Recent Activity</div>
              <div className="text-right">Avg closing price</div>
              <div className="text-right">% of change to portfolio</div>
            </div>
            {tableTransactions.map((tx) => (
              <div
                key={`${tx.reportDate}-${tx.cusip ?? tx.companyName}`}
                className={cn(
                  panelRowGridFour,
                  "min-h-[60px] items-center border-t border-[#E4E4E7] bg-white px-4",
                )}
              >
                <div className="py-1 text-left text-[14px] font-semibold leading-5 text-[#09090B]">
                  {tx.quarterLabel}
                </div>
                <div className={superinvestorTxTdActivity}>
                  <SuperinvestorTransactionActivityCell tx={tx} />
                </div>
                <SuperinvestorTransactionPriceCells tx={tx} />
              </div>
            ))}
          </div>
        </div>
      )}

      {panelTransactions.length > 0 && hasMoreTableRows ? (
        <button
          type="button"
          onClick={() => onViewAllTransactions(searchQuery)}
          className={cn(
            "mt-4 flex h-10 w-full items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white",
            "text-[14px] font-medium leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]",
            "transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
          )}
        >
          Show all activity
        </button>
      ) : null}
    </div>
  );
}

export const SuperinvestorHoldingTransactionsPanel = memo(SuperinvestorHoldingTransactionsPanelInner);
