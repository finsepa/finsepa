"use client";

import { memo, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChartSpline } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import {
  normalizeUsdForDisplay,
  totalHistoricalEquityCostBasis,
} from "@/lib/portfolio/overview-metrics";
import { cumulativeRealizedGainUsdForAsset } from "@/lib/portfolio/realized-pnl-from-trades";
import { cn } from "@/lib/utils";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const EM_DASH = "\u2014";

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

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function PortfolioHoldingsPerformanceTableInner({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  /** Same denominator as overview “Total profit” ATH % — each row’s share of return in percentage points. */
  const portfolioReturnDenominator = useMemo(
    () => totalHistoricalEquityCostBasis(holdings, transactions),
    [holdings, transactions],
  );

  const [profitSortDesc, setProfitSortDesc] = useState(true);

  const sortedRows = useMemo(() => {
    const rows = holdings.map((h) => {
      const retUsd = h.currentValue - h.costBasis;
      const routeKey = cryptoRouteBase(h.symbol);
      const assetKind: "stock" | "crypto" = isSupportedCryptoAssetSymbol(routeKey) ? "crypto" : "stock";
      const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, routeKey, assetKind);
      const totalProfitUsd = retUsd + realizedUsd;
      const totalProfitPct = h.costBasis > 0 ? (totalProfitUsd / h.costBasis) * 100 : null;
      const contributionPct =
        portfolioReturnDenominator > 0 && Number.isFinite(portfolioReturnDenominator) &&
        Number.isFinite(totalProfitUsd) ?
          (totalProfitUsd / portfolioReturnDenominator) * 100
        : null;
      const realizedDisplay =
        Math.abs(normalizeUsdForDisplay(realizedUsd)) < 0.005 ? null : realizedUsd;
      return {
        h,
        retUsd,
        totalProfitUsd,
        totalProfitPct,
        contributionPct,
        realizedDisplay,
      };
    });
    rows.sort((a, b) => {
      const diff = b.totalProfitUsd - a.totalProfitUsd;
      const cmp = profitSortDesc ? diff : -diff;
      if (cmp !== 0) return cmp;
      return a.h.symbol.localeCompare(b.h.symbol);
    });
    return rows;
  }, [holdings, transactions, portfolioReturnDenominator, profitSortDesc]);

  if (holdings.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(40vh,360px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartSpline className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No holdings to show</EmptyTitle>
          <EmptyDescription>
            Add stocks, ETFs, or funds to this portfolio to see per-asset profit, dividends, fees, and capital
            contribution.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E4E4E7] text-[#71717A]">
            <th className="pb-3 pr-4 text-left font-medium">Company</th>
            <th className="whitespace-nowrap pb-3 pr-4 text-right font-medium">
              <button
                type="button"
                onClick={() => setProfitSortDesc((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md transition-colors hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
                aria-label={
                  profitSortDesc ? "Sort total profit: lowest dollar amount first" : "Sort total profit: highest dollar amount first"
                }
              >
                Total profit
                {profitSortDesc ? (
                  <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                )}
              </button>
            </th>
            <th className="whitespace-nowrap pb-3 pr-4 text-right font-medium">Capital gain</th>
            <th className="whitespace-nowrap pb-3 pr-4 text-right font-medium">Realized P&amp;L</th>
            <th className="whitespace-nowrap pb-3 pr-4 text-right font-medium">Dividends</th>
            <th className="whitespace-nowrap pb-3 pr-4 text-right font-medium">Contribution</th>
            <th className="whitespace-nowrap pb-3 pr-0 text-right font-medium">Fees paid</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ h, retUsd, totalProfitUsd, totalProfitPct, contributionPct, realizedDisplay }) => (
            <tr key={h.id} className="border-b border-[#E4E4E7]">
              <td className="py-3 pr-4 text-left align-middle">
                <div className="flex min-w-0 items-center gap-3 text-left">
                  <CompanyLogo
                    name={h.name}
                    logoUrl={displayLogoUrlForPortfolioSymbol(h.symbol)}
                    symbol={h.symbol}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#09090B]">{h.name}</div>
                    <div className="text-xs text-[#71717A]">{portfolioAssetSymbolCaption(h.symbol)}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-right align-middle">
                <div
                  className={cn(
                    "font-medium tabular-nums",
                    totalProfitUsd >= 0 ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {formatSignedUsd(totalProfitUsd)}
                </div>
                {totalProfitPct != null ? (
                  <div
                    className={cn(
                      "text-xs tabular-nums",
                      totalProfitPct >= 0 ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {formatSignedPct(totalProfitPct)}
                  </div>
                ) : (
                  <div className="text-xs text-[#A1A1AA]">{EM_DASH}</div>
                )}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap py-3 pr-4 text-right font-medium tabular-nums align-middle",
                  retUsd >= 0 ? "text-emerald-600" : "text-red-600",
                )}
              >
                {formatSignedUsd(retUsd)}
              </td>
              <td
                className={cn(
                  "py-3 pr-4 text-right align-middle font-medium tabular-nums",
                  realizedDisplay == null ? "text-[#71717A]" : realizedDisplay >= 0 ? "text-emerald-600" : "text-red-600",
                )}
              >
                {realizedDisplay == null ? EM_DASH : formatSignedUsd(realizedDisplay)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums text-[#71717A] align-middle">{EM_DASH}</td>
              <td
                className={cn(
                  "whitespace-nowrap py-3 pr-4 text-right align-middle font-medium tabular-nums",
                  contributionPct == null ?
                    "text-[#71717A]"
                  : contributionPct >= 0 ?
                    "text-emerald-600"
                  : "text-red-600",
                )}
              >
                {contributionPct != null ? formatSignedPct(contributionPct) : EM_DASH}
              </td>
              <td className="py-3 pr-0 text-right tabular-nums text-[#71717A] align-middle">{EM_DASH}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PortfolioHoldingsPerformanceTable = memo(PortfolioHoldingsPerformanceTableInner);
