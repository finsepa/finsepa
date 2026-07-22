"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type {
  AnalyticsMetricResult,
  PortfolioAnalyticsSnapshot,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";
import { cn } from "@/lib/utils";

type CompareDirection = "higher" | "lower";

type PortfolioMetricDef = {
  label: string;
  tooltipTitle: string;
  portfolio: string;
  portfolioNum: number | null;
  benchmark?: string;
  benchmarkNum?: number;
  compareDirection?: CompareDirection;
  /** No S&P comparison — always neutral (black). */
  neutral?: boolean;
  muted: boolean;
};

type PortfolioMetricRow = PortfolioMetricDef & {
  deltaPct: number | null;
};

const pctFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const ratioFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Three columns — matches portfolio overview reference layout. */
const METRIC_COLUMN_SPLITS = [4, 4, 2] as const;

const KEY_STAT_LABELS = [
  "P/E ratio",
  "Sharpe ratio",
  "Sortino ratio",
  "Cash conversion",
  "Gross margin",
  "Operating margin",
  "ROCE",
  "Volatility",
  "Portfolio turnover",
  "Beta",
] as const;

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
      metric.compareDirection == null ||
      metric.portfolioNum == null ||
      metric.muted
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
  if (deltaPct == null) return "text-[#0F0F0F]";
  if (deltaPct === 0) return "text-[#0F0F0F]";
  return deltaPct > 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function formatRatioMetric(m: AnalyticsMetricResult | undefined): { text: string; num: number | null; muted: boolean } {
  if (!m || m.status !== "available" || m.value == null || !Number.isFinite(m.value)) {
    return { text: "—", num: null, muted: true };
  }
  return { text: ratioFmt.format(m.value), num: m.value, muted: false };
}

function formatPctMetric(m: AnalyticsMetricResult | undefined): { text: string; num: number | null; muted: boolean } {
  if (!m || m.status !== "available" || m.value == null || !Number.isFinite(m.value)) {
    return { text: "—", num: null, muted: true };
  }
  return { text: `${pctFmt.format(m.value)}%`, num: m.value, muted: false };
}

function metricsFromSnapshot(snap: PortfolioAnalyticsSnapshot | null): PortfolioMetricDef[] {
  const pe = formatRatioMetric(snap?.pe);
  const sharpe = formatRatioMetric(snap?.sharpe);
  const sortino = formatRatioMetric(snap?.sortino);
  const cashConv = formatRatioMetric(snap?.cashConversion);
  const gross = formatPctMetric(snap?.grossMargin);
  const op = formatPctMetric(snap?.operatingMargin);
  const roce = formatPctMetric(snap?.roce);
  const vol = formatPctMetric(snap?.volatility);
  const turnover = formatPctMetric(snap?.turnover);
  const beta = formatRatioMetric(snap?.beta);

  const b = snap?.benchmark ?? null;
  const bPe = formatRatioMetric(b?.pe);
  const bSharpe = formatRatioMetric(b?.sharpe);
  const bSortino = formatRatioMetric(b?.sortino);
  const bCash = formatRatioMetric(b?.cashConversion);
  const bGross = formatPctMetric(b?.grossMargin);
  const bOp = formatPctMetric(b?.operatingMargin);
  const bRoce = formatPctMetric(b?.roce);
  const bVol = formatPctMetric(b?.volatility);
  const bTurnover = formatPctMetric(b?.turnover);
  const bBeta = formatRatioMetric(b?.beta);

  const withBench = (
    row: Omit<PortfolioMetricDef, "benchmark" | "benchmarkNum" | "compareDirection" | "neutral"> & {
      compareDirection: CompareDirection;
    },
    bench: { text: string; num: number | null; muted: boolean },
  ): PortfolioMetricDef => {
    if (row.muted || bench.muted || bench.num == null) {
      return { ...row, muted: row.muted, neutral: true };
    }
    return {
      ...row,
      benchmark: bench.text,
      benchmarkNum: bench.num,
      compareDirection: row.compareDirection,
      neutral: false,
    };
  };

  return [
    withBench(
      {
        label: "P/E ratio",
        tooltipTitle: "P/E Ratio",
        portfolio: pe.text,
        portfolioNum: pe.num,
        muted: pe.muted,
        compareDirection: "lower",
      },
      bPe,
    ),
    withBench(
      {
        label: "Sharpe ratio",
        tooltipTitle: "Sharpe Ratio",
        portfolio: sharpe.text,
        portfolioNum: sharpe.num,
        muted: sharpe.muted,
        compareDirection: "higher",
      },
      bSharpe,
    ),
    withBench(
      {
        label: "Sortino ratio",
        tooltipTitle: "Sortino Ratio",
        portfolio: sortino.text,
        portfolioNum: sortino.num,
        muted: sortino.muted,
        compareDirection: "higher",
      },
      bSortino,
    ),
    withBench(
      {
        label: "Cash conversion",
        tooltipTitle: "Cash Conversion",
        portfolio: cashConv.text,
        portfolioNum: cashConv.num,
        muted: cashConv.muted,
        compareDirection: "higher",
      },
      bCash,
    ),
    withBench(
      {
        label: "Gross margin",
        tooltipTitle: "Gross Margin",
        portfolio: gross.text,
        portfolioNum: gross.num,
        muted: gross.muted,
        compareDirection: "higher",
      },
      bGross,
    ),
    withBench(
      {
        label: "Operating margin",
        tooltipTitle: "Operating Margin",
        portfolio: op.text,
        portfolioNum: op.num,
        muted: op.muted,
        compareDirection: "higher",
      },
      bOp,
    ),
    withBench(
      {
        label: "ROCE",
        tooltipTitle: "ROCE",
        portfolio: roce.text,
        portfolioNum: roce.num,
        muted: roce.muted,
        compareDirection: "higher",
      },
      bRoce,
    ),
    withBench(
      {
        label: "Volatility",
        tooltipTitle: "Volatility",
        portfolio: vol.text,
        portfolioNum: vol.num,
        muted: vol.muted,
        compareDirection: "lower",
      },
      bVol,
    ),
    withBench(
      {
        label: "Portfolio turnover",
        tooltipTitle: "Portfolio Turnover",
        portfolio: turnover.text,
        portfolioNum: turnover.num,
        muted: turnover.muted,
        compareDirection: "lower",
      },
      bTurnover,
    ),
    withBench(
      {
        label: "Beta",
        tooltipTitle: "Beta",
        portfolio: beta.text,
        portfolioNum: beta.num,
        muted: beta.muted,
        compareDirection: "lower",
      },
      bBeta,
    ),
  ];
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
          <p className="text-[12px] font-semibold leading-4 text-[#0F0F0F]">{row.tooltipTitle}</p>
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
  loading,
}: {
  row: PortfolioMetricRow;
  muted: boolean;
  showBorderBottom?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        showBorderBottom && "border-b border-dashed border-[#E4E4E7] pb-3",
      )}
    >
      <span className="text-[14px] leading-4 text-[#71717A]">{row.label}</span>
      {loading ? (
        <div className="h-4 w-12 animate-pulse rounded bg-neutral-200" aria-hidden />
      ) : (
        <MetricValueDisplay row={row} muted={muted} align="left" />
      )}
    </div>
  );
}

function StatRow({
  row,
  muted,
  className,
  loading,
}: {
  row: PortfolioMetricRow;
  muted: boolean;
  className?: string;
  loading?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 md:px-0 md:py-1.5", className)}>
      <span className="min-w-0 shrink text-[14px] font-medium leading-5 text-[#0F0F0F]">{row.label}</span>
      {loading ? (
        <div className="h-4 w-14 shrink-0 animate-pulse rounded bg-neutral-200" aria-hidden />
      ) : (
        <MetricValueDisplay row={row} muted={muted} align="right" />
      )}
    </div>
  );
}

function skeletonMetricRows(): PortfolioMetricRow[] {
  return KEY_STAT_LABELS.map((label) => ({
    label,
    tooltipTitle: label,
    portfolio: "",
    portfolioNum: null,
    muted: true,
    neutral: true,
    deltaPct: null,
  }));
}

export function PortfolioOverviewMetrics({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const [snapshot, setSnapshot] = useState<PortfolioAnalyticsSnapshot | null>(null);
  /** True while waiting for the first analytics snapshot (no prior values). */
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const hasSnapshotRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasSnapshotRef.current) setAnalyticsLoading(true);
    const run = async (attempt: number) => {
      try {
        const res = await fetch("/api/portfolio/analytics", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdings, transactions, benchmark: "SPY" }),
        });
        if (cancelled) return;
        if (!res.ok) {
          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 400));
            if (!cancelled) void run(attempt + 1);
            return;
          }
          if (!cancelled) setAnalyticsLoading(false);
          return;
        }
        const data = (await res.json()) as PortfolioAnalyticsSnapshot;
        if (cancelled) return;
        const riskMissing =
          data.volatility?.status !== "available" &&
          data.sharpe?.status !== "available" &&
          (data.pe?.status === "available" || data.turnover?.status === "available");
        if (riskMissing && attempt < 1) {
          await new Promise((r) => setTimeout(r, 400));
          if (!cancelled) void run(attempt + 1);
          // Still apply this response so fundamentals show while retry runs.
          setSnapshot(data);
          hasSnapshotRef.current = true;
          setAnalyticsLoading(false);
          return;
        }
        setSnapshot(data);
        hasSnapshotRef.current = true;
        setAnalyticsLoading(false);
      } catch {
        if (cancelled) return;
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 400));
          if (!cancelled) void run(attempt + 1);
          return;
        }
        // Keep previous snapshot on failure — avoid flashing "—".
        setAnalyticsLoading(false);
      }
    };
    void run(0);
    return () => {
      cancelled = true;
    };
  }, [holdings, transactions]);

  const showMetricsSkeleton = analyticsLoading && snapshot == null;
  const metricDefs = useMemo(
    () => (showMetricsSkeleton ? skeletonMetricRows() : metricsFromSnapshot(snapshot)),
    [showMetricsSkeleton, snapshot],
  );
  const metrics = useMemo(() => enrichMetricRows(metricDefs), [metricDefs]);
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
                    muted={row.muted}
                    showBorderBottom={showBorderBottom}
                    loading={showMetricsSkeleton}
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
                muted={row.muted}
                loading={showMetricsSkeleton}
                className={rowIndex < column.length - 1 ? DESKTOP_STAT_ROW_BORDER_CLASS : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
