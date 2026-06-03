"use client";

import { memo, useMemo } from "react";

import type { Berkshire13fComparisonRow, SuperinvestorQuarterlyTransaction } from "@/lib/superinvestors/types";
import { SuperinvestorHoldingPriceChart } from "@/components/superinvestors/superinvestor-holding-price-chart";
import {
  SuperinvestorTransactionActivityCell,
  SuperinvestorTransactionPriceCells,
  superinvestorTxTdActivity,
} from "@/components/superinvestors/superinvestor-transaction-display";
import { holdingPanelTransactions } from "@/lib/superinvestors/superinvestor-transaction-utils";
import { cn } from "@/lib/utils";

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
  const panelTransactions = useMemo(
    () => holdingPanelTransactions(allTransactions, row, resolvedTicker),
    [allTransactions, row, resolvedTicker],
  );

  const listingTicker = resolvedTicker?.trim() || row.ticker?.trim() || null;

  const searchQuery =
    resolvedTicker?.trim().toUpperCase() ||
    row.ticker?.trim().toUpperCase() ||
    row.companyName.trim();

  return (
    <div className="border-t-2 border-b-2 border-[#E4E4E7] bg-white px-2 pb-4 pt-3 sm:px-4" data-holding-expanded-panel>
      {listingTicker ?
        <SuperinvestorHoldingPriceChart ticker={listingTicker} transactions={panelTransactions} />
      : null}

      <h3 className="mb-3 text-[20px] font-semibold leading-7 tracking-tight text-[#09090B]">Transactions</h3>

      {panelTransactions.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#71717A]">No 13F transactions found for this company.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className={panelHeaderGrid}>
              <div className="text-left">Quarter</div>
              <div className="text-right">Recent Activity</div>
              <div className="text-right">Avg closing price</div>
              <div className="text-right">Price range</div>
            </div>
            {panelTransactions.map((tx) => (
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

      <button
        type="button"
        onClick={() => onViewAllTransactions(searchQuery)}
        className={cn(
          "mt-4 flex h-10 w-full items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white",
          "text-[14px] font-medium leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]",
          "transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
        )}
      >
        Show all transactions
      </button>
    </div>
  );
}

export const SuperinvestorHoldingTransactionsPanel = memo(SuperinvestorHoldingTransactionsPanelInner);
