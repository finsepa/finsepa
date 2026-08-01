"use client";

import { memo, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import {
  portfolioHoldingDisplayName,
} from "@/lib/portfolio/use-portfolio-holding-display-names";
import { buildSplitAdjustedTradeIndexForAsset } from "@/lib/portfolio/split-adjusted-trades";
import { assetRouteKeyForHolding, tradeTransactionsForHolding } from "@/lib/portfolio/trade-transactions-for-holding";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const HOLDING_TX_GRID =
  "grid grid-cols-[minmax(200px,2.4fr)_minmax(88px,1fr)_minmax(108px,1.1fr)_minmax(80px,1fr)_minmax(96px,1.1fr)_minmax(64px,0.85fr)_minmax(96px,1.1fr)_minmax(128px,1.35fr)] items-center gap-x-2";

const numericHeaderClass = cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS);
const numericCellClass = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function sumColorClass(sum: number): string {
  if (sum > 0) return "text-up";
  if (sum < 0) return "text-down";
  return "text-fg";
}

function opColorClass(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("sell")) return "text-down";
  if (u.includes("buy")) return "text-up";
  return "text-fg";
}

function PortfolioHoldingTransactionsPanelInner({
  holding,
  transactions,
  resolvedCompanyNames,
}: {
  holding: PortfolioHolding;
  transactions: PortfolioTransaction[];
  resolvedCompanyNames: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const companyName = portfolioHoldingDisplayName(holding, resolvedCompanyNames);
  const { routeKey, kind } = assetRouteKeyForHolding(holding);

  const recentRows = useMemo(
    () => tradeTransactionsForHolding(transactions, holding, 5),
    [transactions, holding],
  );

  const splitAdjusted = useMemo(
    () => buildSplitAdjustedTradeIndexForAsset(transactions, routeKey, kind),
    [transactions, routeKey, kind],
  );

  const assetSearch = portfolioAssetSymbolCaption(holding.symbol) || holding.symbol.trim().toUpperCase();

  return (
    <div className="min-w-0 max-w-full px-2 pb-4 pt-3 sm:px-4" data-holding-expanded-panel>
      <h3 className="mb-3 text-[20px] font-semibold leading-7 tracking-tight text-fg">Transactions</h3>

      {recentRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">No trades for this asset yet.</p>
      ) : (
        <div
          className={cn(
            "w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
            "[scrollbar-width:thin] [scrollbar-color:#A1A1AA_transparent]",
            SCREENER_TABLE_OUTER_BORDER_CLASS,
            SCREENER_TABLE_MOBILE_SURFACE_CLASS,
          )}
        >
          <div className="min-w-[920px] bg-surface">
            <div
              className={cn(
                SCREENER_TABLE_HEADER_STICKY_CLASS,
                SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                "md:border-b-0",
              )}
            >
              <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                <div
                  className={cn(
                    HOLDING_TX_GRID,
                    "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                  )}
                >
                  <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Asset</div>
                  <div className={numericHeaderClass}>Operation</div>
                  <div className={numericHeaderClass}>Date</div>
                  <div className={numericHeaderClass}>Shares</div>
                  <div className={numericHeaderClass}>Price</div>
                  <div className={numericHeaderClass}>Fee</div>
                  <div className={numericHeaderClass}>Summ</div>
                  <div className={numericHeaderClass}>Total profit</div>
                </div>
              </div>
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            </div>

            {recentRows.map((t, i) => {
              const adjusted = splitAdjusted.get(t.id);
              return (
                <div key={t.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                  <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                    <div
                      className={cn(
                        HOLDING_TX_GRID,
                        "min-h-[60px] text-[14px] font-normal leading-5",
                        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                      )}
                    >
                      <div className={cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS)}>
                        <div className="flex min-w-0 items-center gap-3 pr-2">
                          <CompanyLogo
                            name={companyName}
                            logoUrl={displayLogoUrlForPortfolioSymbol(holding.symbol)}
                            symbol={holding.symbol}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold leading-5 text-fg">
                              {companyName}
                            </div>
                            <div className="text-[12px] font-normal leading-4 text-fg-muted">
                              {portfolioAssetSymbolCaption(holding.symbol)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "min-w-0 w-full truncate text-right text-[14px] font-medium leading-5",
                          TABLE_END_ALIGNED_PAD_CLASS,
                          opColorClass(t.operation),
                        )}
                      >
                        {t.operation}
                      </div>
                      <div className={numericCellClass}>
                        {format(parseISO(t.date), "MMM d, yyyy")}
                      </div>
                      <div className={numericCellClass}>
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
                          adjusted?.shares ?? t.shares,
                        )}
                      </div>
                      <div className={numericCellClass}>
                        {formatPortfolioUsdPerUnit(adjusted?.price ?? t.price)}
                      </div>
                      <div className={numericCellClass}>
                        {t.fee > 0 ? usd.format(t.fee) : "—"}
                      </div>
                      <div
                        className={cn(
                          "min-w-0 w-full text-right text-[14px] font-medium leading-5 tabular-nums",
                          TABLE_END_ALIGNED_PAD_CLASS,
                          sumColorClass(t.sum),
                        )}
                      >
                        {formatSignedUsd(t.sum)}
                      </div>
                      <div
                        className={cn(
                          "min-w-0 w-full text-right text-[14px] font-medium leading-5",
                          TABLE_END_ALIGNED_PAD_CLASS,
                        )}
                      >
                        {t.profitPct != null && t.profitUsd != null ? (
                          <div
                            className={cn(
                              "flex flex-col items-end tabular-nums",
                              t.profitUsd >= 0 ? "text-up" : "text-down",
                            )}
                          >
                            <div className="text-[14px] font-medium leading-5">
                              {formatSignedUsd(t.profitUsd)}
                            </div>
                            <div className="text-[12px] font-normal leading-4 opacity-90">
                              {formatSignedPct(t.profitPct)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[14px] font-medium text-fg-muted">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {i < recentRows.length - 1 ? (
                    <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          router.push(
            `/portfolio?tab=transactions&asset=${encodeURIComponent(assetSearch)}`,
          );
        }}
        className={cn(
          "mt-4 flex h-10 w-full items-center justify-center rounded-[10px] border border-stroke bg-surface",
          "text-[14px] font-medium leading-5 text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
          "transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
        )}
      >
        Show all transactions
      </button>
    </div>
  );
}

export const PortfolioHoldingTransactionsPanel = memo(PortfolioHoldingTransactionsPanelInner);
