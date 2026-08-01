"use client";

import { memo, useMemo } from "react";

import type { Berkshire13fComparisonRow, SuperinvestorQuarterlyTransaction } from "@/lib/superinvestors/types";
import { SuperinvestorHoldingPriceChart } from "@/components/superinvestors/superinvestor-holding-price-chart";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import {
  formatSuperinvestorPortfolioWeightChange,
  formatSuperinvestorTxPrice,
  SuperinvestorTransactionActivityCell,
  superinvestorTxTdActivity,
  superinvestorTxTdNum,
} from "@/components/superinvestors/superinvestor-transaction-display";
import { cutoffYmdYearsAgo, holdingPanelTableTransactions, SUPERINVESTOR_HOLDING_PANEL_TABLE_LIMIT, SUPERINVESTOR_HOLDING_PANEL_YEARS, summarizeEarlierHoldingActivity, transactionsForHolding } from "@/lib/superinvestors/superinvestor-transaction-utils";
import { cn } from "@/lib/utils";
import { emptyDescriptionClassName } from "@/components/ui/empty";

const panelRowGridFour =
  "grid w-full min-w-[620px] grid-cols-[minmax(88px,0.75fr)_minmax(140px,1.15fr)_minmax(96px,0.9fr)_minmax(120px,1.05fr)] gap-x-4";

const panelHeaderGrid = cn(
  panelRowGridFour,
  "min-h-[44px] items-center bg-surface px-5 text-[14px] font-medium leading-5 text-fg-muted",
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
    <div className="border-t-2 border-b-2 border-stroke bg-surface px-2 pb-4 pt-3 sm:px-4" data-holding-expanded-panel>
      {listingTicker ?
        <SuperinvestorHoldingPriceChart
          ticker={listingTicker}
          transactions={panelTransactions}
          earlierActivitySummary={earlierActivitySummary}
        />
      : null}

      <h3 className="mb-3 text-[20px] font-semibold leading-7 tracking-tight text-fg">Activity</h3>

      {panelTransactions.length === 0 ? (
        <p className={cn("py-6 text-center", emptyDescriptionClassName)}>
          No 13F transactions found for this company.
        </p>
      ) : (
        <ScreenerTableScroll mobileScroll minWidthClassName="min-w-[620px]">
          <div className="bg-surface">
            <div
              className={cn(
                SCREENER_TABLE_HEADER_STICKY_CLASS,
                SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                "md:border-b-0",
              )}
            >
              <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                <div className={panelHeaderGrid}>
                  <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Period</div>
                  <div className={cn("text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Recent Activity</div>
                  <div className={cn("text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Avg closing price</div>
                  <div className={cn("text-right", TABLE_END_ALIGNED_PAD_CLASS)}>% of change to portfolio</div>
                </div>
              </div>
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            </div>
            {tableTransactions.map((tx, index) => (
              <div
                key={`${tx.reportDate}-${tx.cusip ?? tx.companyName}`}
                className={SCREENER_TABLE_DATA_ROW_CLASS}
              >
                <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      panelRowGridFour,
                      "min-h-[60px] items-center bg-surface text-[14px] font-normal leading-5",
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                  >
                    <div className={cn("py-1 text-left text-[14px] font-semibold leading-5 text-fg", TABLE_START_ALIGNED_PAD_CLASS)}>
                      {tx.quarterLabel}
                    </div>
                    <div className={cn(superinvestorTxTdActivity, TABLE_END_ALIGNED_PAD_CLASS)}>
                      <SuperinvestorTransactionActivityCell tx={tx} />
                    </div>
                    <div className={cn(superinvestorTxTdNum, TABLE_END_ALIGNED_PAD_CLASS)}>
                      {formatSuperinvestorTxPrice(tx.avgClosingPriceUsd)}
                    </div>
                    <div className={cn(superinvestorTxTdNum, TABLE_END_ALIGNED_PAD_CLASS)}>
                      {formatSuperinvestorPortfolioWeightChange(tx.portfolioWeightChangePct)}
                    </div>
                  </div>
                </div>
                {index < tableTransactions.length - 1 ? (
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
        </ScreenerTableScroll>
      )}

      {panelTransactions.length > 0 && hasMoreTableRows ? (
        <button
          type="button"
          onClick={() => onViewAllTransactions(searchQuery)}
          className={cn(
            "mt-4 flex h-10 w-full items-center justify-center rounded-[10px] border border-stroke bg-surface",
            "text-[14px] font-medium leading-5 text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
            "transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
          )}
        >
          Show all activity
        </button>
      ) : null}
    </div>
  );
}

export const SuperinvestorHoldingTransactionsPanel = memo(SuperinvestorHoldingTransactionsPanelInner);
