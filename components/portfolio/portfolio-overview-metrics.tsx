"use client";

import { useMemo } from "react";

import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { tradeSymbolsFromHistory } from "@/lib/portfolio/realized-pnl-from-trades";
import { cn } from "@/lib/utils";

type CompareDirection = "higher" | "lower";

type PortfolioMetricDef = {
  label: string;
  tooltipTitle: string;
  portfolio: string;
  portfolioNum: number;
  benchmark?: string;
  benchmarkNum?: number;
  compareDirection?: CompareDirection;
  /** No S&P comparison — always neutral (black), e.g. No. of assets. */
  neutral?: boolean;
};

type PortfolioMetricRow = PortfolioMetricDef & {
  deltaPct: number | null;
};

const PLACEHOLDER_METRICS: PortfolioMetricDef[] = [
  {
    label: "P/E ratio",
    tooltipTitle: "P/E Ratio",
    portfolio: "18.4",
    portfolioNum: 18.4,
    benchmark: "20.3",
    benchmarkNum: 20.3,
    compareDirection: "lower",
  },
  {
    label: "Sharpe ratio",
    tooltipTitle: "Sharpe Ratio",
    portfolio: "1.12",
    portfolioNum: 1.12,
    benchmark: "0.88",
    benchmarkNum: 0.88,
    compareDirection: "higher",
  },
  {
    label: "Sortino ratio",
    tooltipTitle: "Sortino Ratio",
    portfolio: "1.45",
    portfolioNum: 1.45,
    benchmark: "1.02",
    benchmarkNum: 1.02,
    compareDirection: "higher",
  },
  {
    label: "Cash conversion",
    tooltipTitle: "Cash Conversion",
    portfolio: "1.08",
    portfolioNum: 1.08,
    benchmark: "0.96",
    benchmarkNum: 0.96,
    compareDirection: "higher",
  },
  {
    label: "Gross margin",
    tooltipTitle: "Gross Margin",
    portfolio: "42.0%",
    portfolioNum: 42.0,
    benchmark: "38.5%",
    benchmarkNum: 38.5,
    compareDirection: "higher",
  },
  {
    label: "Operating margin",
    tooltipTitle: "Operating Margin",
    portfolio: "22.4%",
    portfolioNum: 22.4,
    benchmark: "19.1%",
    benchmarkNum: 19.1,
    compareDirection: "higher",
  },
  {
    label: "ROCE",
    tooltipTitle: "ROCE",
    portfolio: "18.6%",
    portfolioNum: 18.6,
    benchmark: "14.2%",
    benchmarkNum: 14.2,
    compareDirection: "higher",
  },
  {
    label: "Volatility",
    tooltipTitle: "Volatility",
    portfolio: "14.2%",
    portfolioNum: 14.2,
    benchmark: "16.8%",
    benchmarkNum: 16.8,
    compareDirection: "lower",
  },
  { label: "No. of assets", tooltipTitle: "No. of Assets", portfolio: "28", portfolioNum: 28, neutral: true },
  {
    label: "Portfolio turnover",
    tooltipTitle: "Portfolio Turnover",
    portfolio: "24%",
    portfolioNum: 24,
    benchmark: "32%",
    benchmarkNum: 32,
    compareDirection: "lower",
  },
  {
    label: "Beta",
    tooltipTitle: "Beta",
    portfolio: "0.94",
    portfolioNum: 0.94,
    benchmark: "1.00",
    benchmarkNum: 1.0,
    compareDirection: "lower",
  },
];

const EMPTY_METRICS: PortfolioMetricDef[] = [
  { label: "P/E ratio", tooltipTitle: "P/E Ratio", portfolio: "0", portfolioNum: 0 },
  { label: "Sharpe ratio", tooltipTitle: "Sharpe Ratio", portfolio: "0", portfolioNum: 0 },
  { label: "Sortino ratio", tooltipTitle: "Sortino Ratio", portfolio: "0", portfolioNum: 0 },
  { label: "Cash conversion", tooltipTitle: "Cash Conversion", portfolio: "0", portfolioNum: 0 },
  { label: "Gross margin", tooltipTitle: "Gross Margin", portfolio: "0%", portfolioNum: 0 },
  { label: "Operating margin", tooltipTitle: "Operating Margin", portfolio: "0%", portfolioNum: 0 },
  { label: "ROCE", tooltipTitle: "ROCE", portfolio: "0%", portfolioNum: 0 },
  { label: "Volatility", tooltipTitle: "Volatility", portfolio: "0%", portfolioNum: 0 },
  { label: "No. of assets", tooltipTitle: "No. of Assets", portfolio: "0", portfolioNum: 0, neutral: true },
  { label: "Portfolio turnover", tooltipTitle: "Portfolio Turnover", portfolio: "0%", portfolioNum: 0 },
  { label: "Beta", tooltipTitle: "Beta", portfolio: "0", portfolioNum: 0 },
];

/** Three columns — matches portfolio overview reference layout. */
const METRIC_COLUMN_SPLITS = [4, 4, 3] as const;

function portfolioAheadDeltaPct(
  portfolio: number,
  benchmark: number,
  direction: CompareDirection,
): number {
  if (!Number.isFinite(portfolio) || !Number.isFinite(benchmark) || benchmark === 0) return 0;
  const raw = ((portfolio - benchmark) / Math.abs(benchmark)) * 100;
  return direction === "higher" ? raw : -raw;
}

function enrichMetricRows(metrics: PortfolioMetricDef[]): PortfolioMetricRow[] {
  return metrics.map((metric) => {
    if (
      metric.neutral ||
      metric.benchmarkNum == null ||
      metric.compareDirection == null
    ) {
      return { ...metric, deltaPct: null };
    }
    return {
      ...metric,
      deltaPct: portfolioAheadDeltaPct(
        metric.portfolioNum,
        metric.benchmarkNum,
        metric.compareDirection,
      ),
    };
  });
}

function splitMetricsIntoColumns(metrics: PortfolioMetricRow[]): PortfolioMetricRow[][] {
  const columns: PortfolioMetricRow[][] = [[], [], []];
  let offset = 0;
  for (let i = 0; i < METRIC_COLUMN_SPLITS.length; i++) {
    const count = METRIC_COLUMN_SPLITS[i]!;
    columns[i] = metrics.slice(offset, offset + count);
    offset += count;
  }
  return columns;
}

/** Mobile matches asset Key Stats card — 16px radius, stacked shadow, inset padding. */
const PORTFOLIO_METRICS_MOBILE_CARD_CLASS = "max-md:overflow-hidden max-md:p-4";

const DESKTOP_STAT_ROW_BORDER_CLASS = "border-b border-solid border-[#E4E4E7]";

function formatDelta(deltaPct: number): string {
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}

function valueToneClass(deltaPct: number | null, muted: boolean): string {
  if (muted) return "text-[#71717A]";
  // Neutral metrics (no S&P compare) stay black.
  if (deltaPct == null) return "text-[#09090B]";
  if (deltaPct === 0) return "text-[#09090B]";
  // Positive delta = better vs S&P per compareDirection (higher / lower).
  return deltaPct > 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function MetricValueDisplay({
  row,
  muted,
  align = "right",
}: {
  row: PortfolioMetricRow;
  muted: boolean;
  align?: "left" | "right";
}) {
  const comparable = !row.neutral && row.benchmark != null && row.deltaPct != null && !muted;
  const toneClass = valueToneClass(comparable ? row.deltaPct : null, muted);
  const valueClass = cn(
    "text-[14px] font-medium tabular-nums",
    align === "left" ? "leading-4" : "leading-5",
    align === "right" ? "shrink-0 text-right" : "min-w-0 text-left",
    toneClass,
  );

  if (!comparable) {
    return <span className={valueClass}>{row.portfolio}</span>;
  }

  const deltaLabel = formatDelta(row.deltaPct!);
  const deltaTone = row.deltaPct! > 0 ? "text-[#16A34A]" : "text-[#DC2626]";

  return (
    <>
      <span className={cn(valueClass, "md:hidden")}>{row.portfolio}</span>
      <div className={cn("group/value relative hidden shrink-0 md:block", align === "right" && "ml-auto")}>
        <span
          className={cn(
            "cursor-default underline decoration-dotted decoration-[#D4D4D8] underline-offset-2",
            valueClass,
          )}
          tabIndex={0}
          aria-describedby={`portfolio-metric-tip-${row.label.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {row.portfolio}
        </span>
        <div
          id={`portfolio-metric-tip-${row.label.replace(/\s+/g, "-").toLowerCase()}`}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-[calc(100%+6px)] z-30 w-max max-w-[min(calc(100vw-2rem),15rem)]",
            align === "right" ? "right-0" : "left-0",
            "rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 opacity-0 shadow-[0px_4px_12px_rgba(10,10,10,0.08)]",
            "transition-opacity duration-100 group-hover/value:opacity-100 group-focus-within/value:opacity-100",
          )}
        >
          <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{row.tooltipTitle}</p>
          <p className="mt-2 text-[12px] leading-4 text-[#71717A]">S&amp;P 500 - {row.benchmark}</p>
          <p className="text-[12px] leading-4 text-[#71717A]">Portfolio - {row.portfolio}</p>
          <p className={cn("mt-2 text-[12px] font-semibold leading-4 tabular-nums", deltaTone)}>{deltaLabel}</p>
        </div>
      </div>
    </>
  );
}

function chunkMetricRows<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function MobileStatCell({
  row,
  muted,
  showBorderBottom,
}: {
  row: PortfolioMetricRow;
  muted: boolean;
  showBorderBottom?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        showBorderBottom && "border-b border-dashed border-[#E4E4E7] pb-3",
      )}
    >
      <span className="text-[14px] leading-4 text-[#71717A]">{row.label}</span>
      <MetricValueDisplay row={row} muted={muted} align="left" />
    </div>
  );
}

function StatRow({
  row,
  muted,
  className,
}: {
  row: PortfolioMetricRow;
  muted: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 md:px-0 md:py-1.5", className)}>
      <span className="min-w-0 shrink text-[14px] font-medium leading-5 text-[#09090B]">{row.label}</span>
      <MetricValueDisplay row={row} muted={muted} align="right" />
    </div>
  );
}

export function PortfolioOverviewMetrics({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const hasTradeHistory = useMemo(
    () => tradeSymbolsFromHistory(transactions).length > 0,
    [transactions],
  );
  const isEmptyPortfolio = holdings.length === 0 && !hasTradeHistory;
  const metrics = useMemo(
    () => enrichMetricRows(isEmptyPortfolio ? EMPTY_METRICS : PLACEHOLDER_METRICS),
    [isEmptyPortfolio],
  );
  const columns = useMemo(() => splitMetricsIntoColumns(metrics), [metrics]);

  return (
    <div
      className={cn(
        "mb-6 max-md:mb-4 w-full min-w-0 md:overflow-visible md:p-4",
        MOBILE_INSET_CARD_CLASS,
        PORTFOLIO_METRICS_MOBILE_CARD_CLASS,
      )}
    >
      <div className="md:hidden">
        <h3 className="mb-4 text-[14px] font-medium leading-5 text-[#71717A]">Key Stats</h3>
        <div className="flex flex-col">
          {chunkMetricRows(metrics).map((pair, rowIndex, rows) => {
            const showBorderBottom = rowIndex < rows.length - 1;

            return (
              <div
                key={pair.map((row) => row.label).join("-")}
                className={cn("grid grid-cols-2 gap-x-4", rowIndex > 0 && "pt-3")}
              >
                {pair.map((row) => (
                  <MobileStatCell
                    key={row.label}
                    row={row}
                    muted={isEmptyPortfolio}
                    showBorderBottom={showBorderBottom}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden overflow-visible md:grid md:grid-cols-3 md:gap-6">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="min-w-0 overflow-visible">
            {column.map((row, rowIndex) => (
              <StatRow
                key={row.label}
                row={row}
                muted={isEmptyPortfolio}
                className={rowIndex < column.length - 1 ? DESKTOP_STAT_ROW_BORDER_CLASS : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
