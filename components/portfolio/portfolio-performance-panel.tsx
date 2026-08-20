"use client";

import { resolveFsColor } from "@/lib/theme/resolve-fs-color";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { LineChart } from "@/lib/icons";

import { PortfolioHoldingsPerformanceChart } from "@/components/portfolio/portfolio-holdings-performance-chart";
import { PortfolioReturnsDynamicsChart } from "@/components/portfolio/portfolio-returns-dynamics-chart";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { SegmentedControl } from "@/components/design-system/segmented-control";
import {
  earliestBenchmarkCoverYmd,
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
import { fetchPortfolioValueHistoryCached } from "@/lib/portfolio/portfolio-value-history-client-cache";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { portfolioIsCombined } from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

const SPY_SWATCH = "#EA580C";
const SPY_LABEL = "S&P 500";

/** Distinct line colors for combined source portfolios (not accent / SPY orange). */
const COMBINED_SOURCE_SWATCHES = [
  "#0d9488",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
] as const;

async function fetchValueHistory(
  range: PortfolioChartRange,
  transactions: readonly PortfolioTransaction[],
  signal?: AbortSignal,
): Promise<PortfolioValueHistoryPoint[]> {
  return fetchPortfolioValueHistoryCached(range, transactions, signal);
}

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
        "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-stroke bg-surface px-3 py-0 text-[12px] font-medium leading-none text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] transition-opacity",
        !pressed && "opacity-40",
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

type CombinedSourceDef = {
  id: string;
  name: string;
  color: string;
};

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
  combinedSources,
  sourcePointsById,
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
  /** Empty when not a combined portfolio. */
  combinedSources: readonly CombinedSourceDef[];
  sourcePointsById: ReadonlyMap<string, PortfolioValueHistoryPoint[]>;
}) {
  const isCombined = combinedSources.length > 0;
  const portfolioLabel = isCombined ? "Combined" : "Portfolio";
  const portfolioSwatch = resolveFsColor("--fs-accent");

  const [showPortfolio, setShowPortfolio] = useState(true);
  const [compareSpy, setCompareSpy] = useState(false);
  const [sourceVisible, setSourceVisible] = useState<Record<string, boolean>>({});

  const sourceIdsKey = combinedSources.map((s) => s.id).join("|");

  // Reset source toggles when combined composition changes; Combined stays on.
  useEffect(() => {
    setShowPortfolio(true);
    setCompareSpy(false);
    setSourceVisible({});
  }, [sourceIdsKey]);

  const anySourceOn = combinedSources.some((s) => sourceVisible[s.id]);

  const togglePortfolio = useCallback(() => {
    setShowPortfolio((cur) => {
      if (cur && !compareSpy && !anySourceOn) return cur;
      return !cur;
    });
  }, [compareSpy, anySourceOn]);

  const toggleSpy = useCallback(() => {
    setCompareSpy((cur) => {
      if (cur && !showPortfolio && !anySourceOn) return cur;
      return !cur;
    });
  }, [showPortfolio, anySourceOn]);

  const toggleSource = useCallback(
    (id: string) => {
      setSourceVisible((prev) => {
        const nextOn = !prev[id];
        if (!nextOn) {
          const othersOn = combinedSources.some((s) => s.id !== id && prev[s.id]);
          if (!othersOn && !showPortfolio && !compareSpy) return prev;
        }
        return { ...prev, [id]: nextOn };
      });
    },
    [combinedSources, showPortfolio, compareSpy],
  );

  const overlaySeries = useMemo(
    () =>
      combinedSources.map((s) => ({
        id: s.id,
        color: s.color,
        visible: Boolean(sourceVisible[s.id]),
        points: sourcePointsById.get(s.id) ?? [],
      })),
    [combinedSources, sourceVisible, sourcePointsById],
  );

  const rangeSwitcherDesktop = (
    <SegmentedControl
      options={PORTFOLIO_CHART_RANGE_LABELS}
      value={range}
      onChange={onRangeChange}
      aria-label={`${title} range`}
    />
  );

  const rangeSwitcherMobile = (
    <SegmentedControl
      options={PORTFOLIO_CHART_RANGE_LABELS}
      value={range}
      onChange={onRangeChange}
      fullWidth
      className="mt-3"
      aria-label={`${title} range`}
    />
  );

  const hasChart = canLoad && !loading && !error && points.length > 0;

  const legend = hasChart ? (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      <PerformanceLegendBadge
        label={portfolioLabel}
        swatch={portfolioSwatch}
        pressed={showPortfolio}
        onToggle={togglePortfolio}
      />
      {combinedSources.map((s) => (
        <PerformanceLegendBadge
          key={s.id}
          label={s.name}
          swatch={s.color}
          pressed={Boolean(sourceVisible[s.id])}
          onToggle={() => toggleSource(s.id)}
        />
      ))}
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
        <h2 className={cn("shrink-0", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>{title}</h2>
        <div className="hidden sm:flex">{rangeSwitcherDesktop}</div>
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
            <p className="text-sm text-fg-muted">{error}</p>
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
            overlaySeries={overlaySeries}
          />
        )}
      </div>

      {legend}

      <div className="flex w-full sm:hidden">{rangeSwitcherMobile}</div>
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
  const { portfolios, selectedPortfolioId, transactionsByPortfolioId } = usePortfolioWorkspace();
  const [range, setRange] = useState<PortfolioChartRange>("ytd");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [sourcePointsById, setSourcePointsById] = useState<
    Map<string, PortfolioValueHistoryPoint[]>
  >(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spyPoints, setSpyPoints] = useState<StockChartPoint[] | null>(null);

  const selected = useMemo(
    () => portfolios.find((p) => p.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  const combinedSources = useMemo((): CombinedSourceDef[] => {
    if (!selected || !portfolioIsCombined(selected)) return [];
    const from = selected.combinedFrom ?? [];
    return from.map((id, i) => {
      const entry = portfolios.find((p) => p.id === id);
      return {
        id,
        name: entry?.name?.trim() || `Portfolio ${i + 1}`,
        color: COMBINED_SOURCE_SWATCHES[i % COMBINED_SOURCE_SWATCHES.length]!,
      };
    });
  }, [selected, portfolios]);

  const canLoad = transactions.length > 0;
  const benchmarkInvestedUsd = useMemo(() => totalCostBasisInvested(holdings), [holdings]);

  const load = useCallback(async () => {
    if (!canLoad) {
      setPoints([]);
      setSourcePointsById(new Map());
      return;
    }
    setLoading(true);
    setError(null);
    const ac = new AbortController();
    try {
      const combinedPts = await fetchValueHistory(range, transactions, ac.signal);
      setPoints(combinedPts);

      if (combinedSources.length > 0) {
        const next = new Map<string, PortfolioValueHistoryPoint[]>();
        await Promise.all(
          combinedSources.map(async (s) => {
            const txs = transactionsByPortfolioId[s.id] ?? [];
            try {
              next.set(s.id, await fetchValueHistory(range, txs, ac.signal));
            } catch {
              next.set(s.id, []);
            }
          }),
        );
        setSourcePointsById(next);
      } else {
        setSourcePointsById(new Map());
      }
    } catch {
      setError("Could not load history");
      setPoints([]);
      setSourcePointsById(new Map());
    } finally {
      setLoading(false);
    }
  }, [canLoad, range, transactions, combinedSources, transactionsByPortfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canLoad) {
      setSpyPoints(null);
      return;
    }
    const ac = new AbortController();
    const coverFromYmd = earliestBenchmarkCoverYmd(transactions);
    void fetchSpyBenchmarkChartPoints(range, ac.signal, coverFromYmd)
      .then(setSpyPoints)
      .catch(() => {
        if (!ac.signal.aborted) setSpyPoints(null);
      });
    return () => ac.abort();
  }, [canLoad, range, transactions]);

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
        combinedSources={combinedSources}
        sourcePointsById={sourcePointsById}
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
        combinedSources={combinedSources}
        sourcePointsById={sourcePointsById}
      />

      <PortfolioReturnsDynamicsChart transactions={transactions} canLoad={canLoad} />

      <section className="pt-6">
        <h2 className={cn("mb-4", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>
          Holdings performance
        </h2>
        <PortfolioHoldingsPerformanceChart holdings={holdings} transactions={transactions} />
      </section>
    </>
  );
}

export const PortfolioPerformancePanel = memo(PortfolioPerformancePanelInner);
