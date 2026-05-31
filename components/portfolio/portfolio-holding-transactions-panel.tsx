"use client";

import { memo, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";

import { CompanyLogo } from "@/components/screener/company-logo";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import {
  portfolioHoldingDisplayName,
  usePortfolioHoldingDisplayNames,
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

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function sumColorClass(sum: number): string {
  if (sum > 0) return "text-[#16A34A]";
  if (sum < 0) return "text-[#DC2626]";
  return "text-[#09090B]";
}

function opColorClass(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("sell")) return "text-[#DC2626]";
  if (u.includes("buy")) return "text-[#16A34A]";
  return "text-[#09090B]";
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
    <div className="px-2 pb-4 pt-3 sm:px-4" data-holding-expanded-panel>
      <h3 className="mb-3 text-[20px] font-semibold leading-7 tracking-tight text-[#09090B]">Transactions</h3>

      {recentRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#71717A]">No trades for this asset yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div
              className={cn(
                HOLDING_TX_GRID,
                "min-h-[44px] bg-white px-2 text-[14px] font-medium leading-5 text-[#71717A] sm:px-4",
              )}
            >
              <div className="text-left">Asset</div>
              <div className="text-right">Operation</div>
              <div className="text-right">Date</div>
              <div className="text-right">Shares</div>
              <div className="text-right">Price</div>
              <div className="text-right">Fee</div>
              <div className="text-right">Summ</div>
              <div className="text-right">Total profit</div>
            </div>

            {recentRows.map((t) => {
              const adjusted = splitAdjusted.get(t.id);
              return (
                <div
                  key={t.id}
                  className={cn(
                    HOLDING_TX_GRID,
                    "h-[60px] max-h-[60px] border-t border-[#E4E4E7] bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4",
                  )}
                >
                  <div className="min-w-0 text-left">
                    <div className="flex min-w-0 items-center gap-3 pr-2">
                      <CompanyLogo
                        name={companyName}
                        logoUrl={displayLogoUrlForPortfolioSymbol(holding.symbol)}
                        symbol={holding.symbol}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">
                          {companyName}
                        </div>
                        <div className="text-[12px] font-normal leading-4 text-[#71717A]">
                          {portfolioAssetSymbolCaption(holding.symbol)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "truncate px-1 text-right text-[14px] font-medium leading-5",
                      opColorClass(t.operation),
                    )}
                  >
                    {t.operation}
                  </div>
                  <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                    {format(parseISO(t.date), "MMM d, yyyy")}
                  </div>
                  <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                    {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
                      adjusted?.shares ?? t.shares,
                    )}
                  </div>
                  <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                    {formatPortfolioUsdPerUnit(adjusted?.price ?? t.price)}
                  </div>
                  <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                    {t.fee > 0 ? usd.format(t.fee) : "—"}
                  </div>
                  <div
                    className={cn(
                      "text-right text-[14px] font-medium leading-5 tabular-nums",
                      sumColorClass(t.sum),
                    )}
                  >
                    {formatSignedUsd(t.sum)}
                  </div>
                  <div className="min-w-0 text-right text-[14px] font-medium leading-5">
                    {t.profitPct != null && t.profitUsd != null ? (
                      <div
                        className={cn(
                          "flex flex-col items-end tabular-nums",
                          t.profitUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                        )}
                      >
                        <div className="text-[14px] font-medium leading-5">{formatSignedUsd(t.profitUsd)}</div>
                        <div className="text-[12px] font-normal leading-4 opacity-90">
                          {formatSignedPct(t.profitPct)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[14px] font-medium text-[#71717A]">-</span>
                    )}
                  </div>
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

export const PortfolioHoldingTransactionsPanel = memo(PortfolioHoldingTransactionsPanelInner);
