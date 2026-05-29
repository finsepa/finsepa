"use client";

import { Info } from "lucide-react";
import { useId, useMemo, useState } from "react";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { tradeSymbolsFromHistory } from "@/lib/portfolio/realized-pnl-from-trades";
import { cn } from "@/lib/utils";

type MetricRow = {
  title: string;
  description: string;
  portfolio: string;
  benchmark?: string;
  /** Positive = portfolio ahead vs benchmark (green). */
  deltaPct?: number;
};

/** Placeholder metrics until portfolio vs S&P 500 is computed from holdings. */
const PLACEHOLDER_METRICS: MetricRow[] = [
  {
    title: "Portfolio P/E",
    description: "Weighted average price-to-earnings ratio",
    portfolio: "18.4x",
    benchmark: "22.1x",
    deltaPct: -16.7,
  },
  {
    title: "Volatility (annualized)",
    description: "Standard deviation of portfolio returns",
    portfolio: "14.2%",
    benchmark: "16.8%",
    deltaPct: -15.5,
  },
  {
    title: "Beta",
    description: "Sensitivity vs the broad market",
    portfolio: "0.94",
    benchmark: "1.00",
    deltaPct: -6.0,
  },
  {
    title: "Sharpe ratio",
    description: "Risk-adjusted return vs volatility",
    portfolio: "1.12",
    benchmark: "0.88",
    deltaPct: 27.3,
  },
  {
    title: "Sortino ratio",
    description: "Downside risk-adjusted return",
    portfolio: "1.45",
    benchmark: "1.02",
    deltaPct: 42.2,
  },
  {
    title: "ROCE",
    description: "Return on capital employed",
    portfolio: "18.6%",
    benchmark: "14.2%",
    deltaPct: 31.0,
  },
  {
    title: "Gross margin",
    description: "Revenue left after direct costs",
    portfolio: "42.0%",
    benchmark: "38.5%",
    deltaPct: 9.1,
  },
  {
    title: "Operating margin",
    description: "Operating profit as a share of revenue",
    portfolio: "22.4%",
    benchmark: "19.1%",
    deltaPct: 17.3,
  },
  {
    title: "Cash conversion",
    description: "Operating cash flow vs net income",
    portfolio: "1.08",
    benchmark: "0.96",
    deltaPct: 12.5,
  },
  {
    title: "Portfolio turnover (annualized)",
    description: "Trading activity relative to portfolio size",
    portfolio: "24%",
  },
  {
    title: "No. of assets",
    description: "Distinct positions in the portfolio",
    portfolio: "28",
  },
];

const EMPTY_METRICS: MetricRow[] = [
  {
    title: "Portfolio P/E",
    description: "Weighted average price-to-earnings ratio",
    portfolio: "0x",
  },
  {
    title: "Volatility (annualized)",
    description: "Standard deviation of portfolio returns",
    portfolio: "0%",
  },
  {
    title: "Beta",
    description: "Sensitivity vs the broad market",
    portfolio: "0",
  },
  {
    title: "Sharpe ratio",
    description: "Risk-adjusted return vs volatility",
    portfolio: "0",
  },
  {
    title: "Sortino ratio",
    description: "Downside risk-adjusted return",
    portfolio: "0",
  },
  {
    title: "ROCE",
    description: "Return on capital employed",
    portfolio: "0%",
  },
  {
    title: "Gross margin",
    description: "Revenue left after direct costs",
    portfolio: "0%",
  },
  {
    title: "Operating margin",
    description: "Operating profit as a share of revenue",
    portfolio: "0%",
  },
  {
    title: "Cash conversion",
    description: "Operating cash flow vs net income",
    portfolio: "0",
  },
  {
    title: "Portfolio turnover (annualized)",
    description: "Trading activity relative to portfolio size",
    portfolio: "0%",
  },
  {
    title: "No. of assets",
    description: "Distinct positions in the portfolio",
    portfolio: "0",
  },
];

function formatDelta(deltaPct: number) {
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}

function MetricCard({
  row,
  compareEnabled,
  emptyPortfolio,
}: {
  row: MetricRow;
  compareEnabled: boolean;
  emptyPortfolio: boolean;
}) {
  const showCompare =
    !emptyPortfolio && compareEnabled && row.benchmark != null && row.deltaPct != null;
  const positive = (row.deltaPct ?? 0) >= 0;

  return (
    <div
      className={cn(
        "flex min-h-[116px] flex-col rounded-[12px] border border-[#E4E4E7] bg-white p-4",
        "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
      )}
    >
      <p className="text-base font-semibold leading-5 text-[#09090B]">{row.title}</p>
      <p className="mt-1 text-xs leading-4 text-[#71717A]">{row.description}</p>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-semibold leading-8 tracking-tight tabular-nums",
              emptyPortfolio ? "text-[#71717A]" : "text-[#09090B]",
            )}
          >
            {row.portfolio}
          </p>
          {showCompare ? (
            <p className="mt-0.5 text-xl font-semibold leading-7 text-[#71717A]">vs {row.benchmark}</p>
          ) : null}
        </div>
        {showCompare ? (
          <p
            className={cn(
              "shrink-0 text-xl font-semibold leading-7",
              positive ? "text-[#16A34A]" : "text-[#DC2626]",
            )}
          >
            {formatDelta(row.deltaPct!)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PortfolioMetricsPanel({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const [compareToSpy, setCompareToSpy] = useState(true);
  const switchId = useId();

  const hasTradeHistory = useMemo(
    () => tradeSymbolsFromHistory(transactions).length > 0,
    [transactions],
  );
  const isEmptyPortfolio = holdings.length === 0 && !hasTradeHistory;
  const metrics = isEmptyPortfolio ? EMPTY_METRICS : PLACEHOLDER_METRICS;
  const outperforming = !isEmptyPortfolio;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-[#09090B]">Metrics</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={switchId} className="cursor-pointer text-sm font-medium text-[#09090B]">
            Portfolio vs S&amp;P 500
          </label>
          <button
            id={switchId}
            type="button"
            role="switch"
            aria-checked={compareToSpy}
            disabled={isEmptyPortfolio}
            onClick={() => setCompareToSpy((v) => !v)}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 focus-visible:ring-offset-2",
              compareToSpy ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
              isEmptyPortfolio && "cursor-not-allowed opacity-50",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow-sm transition-[transform] duration-150 ease-out",
                compareToSpy ? "left-[calc(100%-1rem-2px)]" : "left-0.5",
              )}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {isEmptyPortfolio ? (
        <div
          className={cn(
            "mb-6 flex gap-3 rounded-[12px] border border-[#E4E4E7] bg-[#FAFAFA] p-4",
            "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#71717A] shadow-sm ring-1 ring-[#E4E4E7]">
            <Info className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#09090B]">No portfolio metrics yet</p>
            <p className="mt-1 text-sm leading-5 text-[#71717A]">
              Add your first holding or transaction to calculate risk, quality, and valuation metrics. Until then,
              values stay at zero.
            </p>
          </div>
        </div>
      ) : compareToSpy && outperforming ? (
        <div
          className={cn(
            "mb-6 flex gap-3 rounded-[12px] border border-[#16A34A]/35 bg-[#F0FDF4] p-4",
            "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]",
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#16A34A] shadow-sm ring-1 ring-[#16A34A]/20">
            <Info className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#166534]">Portfolio is Outperforming 🚀</p>
            <p className="mt-1 text-sm leading-5 text-[#166534]/90">
              Metrics of your portfolio are outperforming the market, well done!
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {metrics.map((row) => (
          <MetricCard
            key={row.title}
            row={row}
            compareEnabled={compareToSpy}
            emptyPortfolio={isEmptyPortfolio}
          />
        ))}
      </div>
    </div>
  );
}
