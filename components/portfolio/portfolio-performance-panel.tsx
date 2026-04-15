"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { LineChart } from "lucide-react";

import { PortfolioHoldingsPerformanceTable } from "@/components/portfolio/portfolio-holdings-performance-table";
import { PortfolioReturnsDynamicsChart } from "@/components/portfolio/portfolio-returns-dynamics-chart";
import { PortfolioOverviewCards } from "@/components/portfolio/portfolio-overview-cards";
import {
  PORTFOLIO_CHART_RANGE_LABELS,
  PortfolioValueHistoryChartPane,
} from "@/components/portfolio/portfolio-overview-chart";
import { PortfolioOverviewAthProvider } from "@/components/portfolio/portfolio-overview-ath-context";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { PortfolioChartRange, PortfolioValueHistoryPoint } from "@/lib/portfolio/portfolio-chart-types";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

function PerformanceChartSection({
  title,
  metric,
  range,
  onRangeChange,
  canLoad,
  loading,
  error,
  points,
}: {
  title: string;
  metric: "value" | "profit";
  range: PortfolioChartRange;
  onRangeChange: (r: PortfolioChartRange) => void;
  canLoad: boolean;
  loading: boolean;
  error: string | null;
  points: PortfolioValueHistoryPoint[];
}) {
  return (
    <section className="mb-10 w-full min-w-0">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">{title}</h2>
        <div
          className="flex min-w-0 flex-wrap justify-end gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5"
          role="group"
          aria-label={`${title} range`}
        >
          {PORTFOLIO_CHART_RANGE_LABELS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRangeChange(r.id)}
              className={cn(
                "rounded-[10px] px-3 py-1.5 font-sans text-[14px] leading-5 tracking-normal sm:px-4",
                range === r.id ?
                  "bg-white font-medium text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                : "font-normal text-[#71717A]",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to see performance over time.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="flex h-[320px] flex-col items-center justify-center px-6">
            <p className="text-sm text-[#71717A]">{error}</p>
          </div>
        ) : points.length === 0 ? (
          <Empty variant="plain" className="h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">Not enough data</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Try a different range or add more activity to this portfolio.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <PortfolioValueHistoryChartPane metric={metric} points={points} />
        )}
      </div>
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
  const [range, setRange] = useState<PortfolioChartRange>("all");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = transactions.length > 0;

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

  return (
    <PortfolioOverviewAthProvider>
      <PortfolioOverviewCards holdings={holdings} transactions={transactions} />

      <PerformanceChartSection
        title="Portfolio value"
        metric="value"
        range={range}
        onRangeChange={setRange}
        canLoad={canLoad}
        loading={loading}
        error={error}
        points={points}
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
      />

      <PortfolioReturnsDynamicsChart transactions={transactions} canLoad={canLoad} />

      <section className="pt-6">
        <h2 className="mb-4 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">
          Holdings performance
        </h2>
        <PortfolioHoldingsPerformanceTable holdings={holdings} transactions={transactions} />
      </section>
    </PortfolioOverviewAthProvider>
  );
}

export const PortfolioPerformancePanel = memo(PortfolioPerformancePanelInner);
