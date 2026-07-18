"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { LineChart } from "@/lib/icons";

import { PortfolioHoldingsPerformanceChart } from "@/components/portfolio/portfolio-holdings-performance-chart";
import { PortfolioReturnsDynamicsChart } from "@/components/portfolio/portfolio-returns-dynamics-chart";
import {
  fetchSpyBenchmarkChartPoints,
  PORTFOLIO_CHART_RANGE_LABELS,
  PortfolioValueHistoryChartPane,
} from "@/components/portfolio/portfolio-overview-chart";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { totalCostBasisInvested } from "@/lib/portfolio/overview-metrics";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { PortfolioChartRange, PortfolioValueHistoryPoint } from "@/lib/portfolio/portfolio-chart-types";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

const PORTFOLIO_SWATCH = "#2563EB";
const SPY_SWATCH = "#EA580C";
const SPY_LABEL = "S&P 500";

/** Clickable legend badge — same pattern as Dynamics of portfolio returns. */
function PerformanceLegendBadge({
  label,
  swatch,
  pressed,
  onToggle,
}: {
  label: string;
  swatch: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-3 py-0 text-[12px] font-medium leading-none text-[#0F0F0F] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-opacity",
        !pressed && "opacity-40",
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function PerformanceChartSection({
  title,
  metric,
  range,
  onRangeChange,
  canLoad,
  loading,
  error,
  points,
  transactions,
  spyPricePoints,
  benchmarkInvestedUsd,
}: {
  title: string;
  metric: "value" | "profit";
  range: PortfolioChartRange;
  onRangeChange: (r: PortfolioChartRange) => void;
  canLoad: boolean;
  loading: boolean;
  error: string | null;
  points: PortfolioValueHistoryPoint[];
  transactions: PortfolioTransaction[];
  spyPricePoints: StockChartPoint[] | null;
  benchmarkInvestedUsd: number | null;
}) {
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [compareSpy, setCompareSpy] = useState(false);

  const togglePortfolio = useCallback(() => {
    setShowPortfolio((cur) => {
      if (cur && !compareSpy) return cur;
      return !cur;
    });
  }, [compareSpy]);

  const toggleSpy = useCallback(() => {
    setCompareSpy((cur) => {
      if (cur && !showPortfolio) return cur;
      return !cur;
    });
  }, [showPortfolio]);

  const rangeSwitcher = (
    <div
      className="mt-3 flex w-full min-w-0 flex-nowrap justify-stretch gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5 sm:mt-0 sm:w-auto sm:flex-nowrap sm:justify-end"
      role="group"
      aria-label={`${title} range`}
    >
      {PORTFOLIO_CHART_RANGE_LABELS.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onRangeChange(r.id)}
          className={cn(
            "flex-1 rounded-[10px] px-2 py-1.5 text-center font-sans text-[14px] leading-5 tracking-normal sm:flex-none sm:px-4",
            range === r.id ?
              "bg-white font-medium text-[#0F0F0F] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
            : "font-normal text-[#71717A]",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  const hasChart = canLoad && !loading && !error && points.length > 0;

  const legend = hasChart ? (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      <PerformanceLegendBadge
        label="Portfolio"
        swatch={PORTFOLIO_SWATCH}
        pressed={showPortfolio}
        onToggle={togglePortfolio}
      />
      <PerformanceLegendBadge
        label={SPY_LABEL}
        swatch={SPY_SWATCH}
        pressed={compareSpy}
        onToggle={toggleSpy}
      />
    </div>
  ) : null;

  return (
    <section className="mb-10 w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#0F0F0F]">{title}</h2>
        <div className="hidden sm:flex">{rangeSwitcher}</div>
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="h-[320px] justify-center py-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to see performance over time.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading ? (
          <AssetChartSkeleton />
        ) : error ? (
          <div className="flex h-[320px] flex-col items-center justify-center px-6">
            <p className="text-sm text-[#71717A]">{error}</p>
          </div>
        ) : points.length === 0 ? (
          <Empty variant="plain" className="h-[320px] justify-center py-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Not enough data</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Try a different range or add more activity to this portfolio.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <PortfolioValueHistoryChartPane
            metric={metric}
            range={range}
            points={points}
            transactions={transactions}
            showPortfolio={showPortfolio}
            compareSpy={compareSpy}
            spyPricePoints={spyPricePoints}
            benchmarkInvestedUsd={benchmarkInvestedUsd}
          />
        )}
      </div>

      {legend}

      <div className="flex w-full justify-end sm:hidden">{rangeSwitcher}</div>
    </section>
  );
}

function PortfolioPerformancePanelInner({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const [range, setRange] = useState<PortfolioChartRange>("ytd");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spyPoints, setSpyPoints] = useState<StockChartPoint[] | null>(null);

  const canLoad = transactions.length > 0;
  const benchmarkInvestedUsd = useMemo(() => totalCostBasisInvested(holdings), [holdings]);

  const load = useCallback(async () => {
    if (!canLoad) {
      setPoints([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/value-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ range, transactions }),
      });
      if (!res.ok) throw new Error("Failed to load chart");
      const json = (await res.json()) as { points?: PortfolioValueHistoryPoint[] };
      setPoints(Array.isArray(json.points) ? json.points : []);
    } catch {
      setError("Could not load history");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, range, transactions]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canLoad) {
      setSpyPoints(null);
      return;
    }
    const ac = new AbortController();
    void fetchSpyBenchmarkChartPoints(range, ac.signal)
      .then(setSpyPoints)
      .catch(() => {
        if (!ac.signal.aborted) setSpyPoints(null);
      });
    return () => ac.abort();
  }, [canLoad, range]);

  return (
    <>
      <PerformanceChartSection
        title="Portfolio value"
        metric="value"
        range={range}
        onRangeChange={setRange}
        canLoad={canLoad}
        loading={loading}
        error={error}
        points={points}
        transactions={transactions}
        spyPricePoints={spyPoints}
        benchmarkInvestedUsd={benchmarkInvestedUsd}
      />

      <PerformanceChartSection
        title="Portfolio return"
        metric="profit"
        range={range}
        onRangeChange={setRange}
        canLoad={canLoad}
        loading={loading}
        error={error}
        points={points}
        transactions={transactions}
        spyPricePoints={spyPoints}
        benchmarkInvestedUsd={benchmarkInvestedUsd}
      />

      <PortfolioReturnsDynamicsChart transactions={transactions} canLoad={canLoad} />

      <section className="pt-6">
        <h2 className="mb-4 text-2xl font-semibold leading-9 tracking-tight text-[#0F0F0F]">
          Holdings performance
        </h2>
        <PortfolioHoldingsPerformanceChart holdings={holdings} transactions={transactions} />
      </section>
    </>
  );
}

export const PortfolioPerformancePanel = memo(PortfolioPerformancePanelInner);
