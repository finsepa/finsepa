"use client";

import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";

import { usePortfolioOverviewAthPublisher } from "@/components/portfolio/portfolio-overview-ath-context";
import { ChevronDown } from "lucide-react";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { earliestStockBuyYmd, replayStockSharesUpTo } from "@/lib/portfolio/benchmark-inception";
import {
  equityMarketValue,
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalCostBasisInvested,
  totalNetWorth,
  unrealizedProfitPct,
  unrealizedProfitUsd,
} from "@/lib/portfolio/overview-metrics";
import {
  cumulativeRealizedGainUsd,
  lifetimeEquityProfitUsd,
  tradeSymbolsFromHistory,
} from "@/lib/portfolio/realized-pnl-from-trades";
import type { OverviewProfitPeriod } from "@/lib/portfolio/overview-market-types";
import { pickPerformancePct } from "@/lib/portfolio/overview-market-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { cn } from "@/lib/utils";

const SPY_BENCHMARK = "SPY";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERIOD_OPTIONS: { id: OverviewProfitPeriod; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "m1", label: "1M" },
  { id: "ytd", label: "YTD" },
  { id: "y1", label: "1Y" },
  { id: "y5", label: "5Y" },
];

function OverviewMetricCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]"
      aria-hidden
    >
      <div className="h-3 w-14 animate-pulse rounded bg-neutral-200" />
      <div className="mt-3 h-8 w-[min(100%,11rem)] max-w-full animate-pulse rounded-md bg-neutral-200" />
      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}

/**
 * Weighted average of per-asset returns using current market value weights (equity only).
 */
function weightedPortfolioReturn(
  holdings: PortfolioHolding[],
  getReturn: (sym: string) => number | null,
): number | null {
  let num = 0;
  let denom = 0;
  for (const h of holdings) {
    const r = getReturn(h.symbol.toUpperCase());
    if (r == null || !Number.isFinite(r)) continue;
    num += h.currentValue * r;
    denom += h.currentValue;
  }
  if (denom <= 0) return null;
  return num / denom;
}

function PortfolioOverviewCardsInner({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const cash = useMemo(() => netCashUsd(transactions), [transactions]);
  const netWorth = useMemo(() => totalNetWorth(holdings, cash), [holdings, cash]);
  const invested = useMemo(() => totalCostBasisInvested(holdings), [holdings]);
  const profitAllUsd = useMemo(
    () => lifetimeEquityProfitUsd(holdings, transactions),
    [holdings, transactions],
  );
  const profitAllPct = useMemo(() => unrealizedProfitPct(holdings), [holdings]);
  const realizedLifetimeUsd = useMemo(
    () => cumulativeRealizedGainUsd(transactions),
    [transactions],
  );
  const unrealizedLifetimeUsd = useMemo(() => unrealizedProfitUsd(holdings), [holdings]);

  const equity = useMemo(() => equityMarketValue(holdings), [holdings]);
  const hasTradeHistory = useMemo(
    () => tradeSymbolsFromHistory(transactions).length > 0,
    [transactions],
  );

  const inceptionYmd = useMemo(() => earliestStockBuyYmd(transactions), [transactions]);

  const [period, setPeriod] = useState<OverviewProfitPeriod>("all");
  /** False until overview-market finishes when any symbols need a quote. */
  const [overviewReady, setOverviewReady] = useState(false);
  const [perfBySymbol, setPerfBySymbol] = useState<Record<string, StockPerformance | null>>({});
  const [spyPerf, setSpyPerf] = useState<StockPerformance | null>(null);
  const [yieldBySymbol, setYieldBySymbol] = useState<Record<string, number | null>>({});
  const [inceptionSpyPrice0, setInceptionSpyPrice0] = useState<number | null>(null);

  const symbols = useMemo(() => {
    const fromHoldings = [...new Set(holdings.map((h) => h.symbol.toUpperCase()))];
    if (fromHoldings.length > 0) return fromHoldings;
    return tradeSymbolsFromHistory(transactions);
  }, [holdings, transactions]);

  const loadMarket = useCallback(async () => {
    if (symbols.length === 0) {
      setPerfBySymbol({});
      setSpyPerf(null);
      setYieldBySymbol({});
      setInceptionSpyPrice0(null);
      setOverviewReady(true);
      return;
    }

    setOverviewReady(false);
    try {
      const startYmd = earliestStockBuyYmd(transactions);
      let inceptionPriceTickers: string[] = [];
      if (startYmd) {
        const sharesMap = replayStockSharesUpTo(transactions, startYmd);
        const syms = [...sharesMap.entries()]
          .filter(([, sh]) => sh > 0)
          .map(([s]) => s.toUpperCase());
        inceptionPriceTickers = [...new Set([SPY_BENCHMARK, ...syms])];
      }

      const res = await fetch("/api/portfolio/overview-market", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols,
          inceptionYmd: startYmd,
          inceptionPriceTickers: startYmd ? inceptionPriceTickers : [],
        }),
      });

      if (!res.ok) {
        throw new Error("overview-market failed");
      }

      const data = (await res.json()) as {
        spy: StockPerformance | null;
        performanceBySymbol: Record<string, StockPerformance | null>;
        yieldBySymbol: Record<string, number | null>;
        inceptionPriceByTicker: Record<string, number | null>;
      };

      setSpyPerf(data.spy ?? null);
      setPerfBySymbol(data.performanceBySymbol ?? {});
      setYieldBySymbol(data.yieldBySymbol ?? {});

      let spy0: number | null = null;
      if (startYmd) {
        const prices = data.inceptionPriceByTicker ?? {};
        spy0 = typeof prices[SPY_BENCHMARK] === "number" ? prices[SPY_BENCHMARK]! : null;
      }
      setInceptionSpyPrice0(spy0);
    } catch {
      setSpyPerf(null);
      setPerfBySymbol({});
      setYieldBySymbol({});
      setInceptionSpyPrice0(null);
    } finally {
      setOverviewReady(true);
    }
  }, [symbols, transactions]);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  const weightedPeriodPct = useMemo(() => {
    if (period === "all") return null;
    return weightedPortfolioReturn(holdings, (sym) => {
      const p = perfBySymbol[sym];
      return pickPerformancePct(p, period);
    });
  }, [holdings, perfBySymbol, period]);

  /** Lifetime simple return on total equity cost basis — aligns with headline profit $ vs other apps. */
  const lifetimeReturnPct = useMemo(
    () => lifetimeEquityProfitPct(holdings, transactions),
    [holdings, transactions],
  );

  const inceptionBenchmarkMetrics = useMemo(() => {
    const rPort = lifetimeReturnPct;
    if (inceptionSpyPrice0 == null || inceptionSpyPrice0 <= 0) {
      return { rPort, rSpy: null as number | null, diff: null as number | null };
    }
    const spyNow = spyPerf?.price ?? null;
    if (spyNow == null || !Number.isFinite(spyNow) || spyNow <= 0) {
      return { rPort, rSpy: null, diff: null };
    }
    const rSpy = ((spyNow / inceptionSpyPrice0) - 1) * 100;
    if (!Number.isFinite(rSpy)) {
      return { rPort, rSpy: null, diff: null };
    }
    if (rPort == null || !Number.isFinite(rPort)) {
      return { rPort, rSpy, diff: null };
    }
    return { rPort, rSpy, diff: rPort - rSpy };
  }, [lifetimeReturnPct, inceptionSpyPrice0, spyPerf?.price]);

  const profitDisplayUsd = useMemo(() => {
    if (period === "all") return profitAllUsd;
    if (weightedPeriodPct == null || equity <= 0) return null;
    return (equity * weightedPeriodPct) / 100;
  }, [period, profitAllUsd, weightedPeriodPct, equity]);

  const profitDisplayPct = useMemo(() => {
    if (period === "all") return profitAllPct;
    return weightedPeriodPct;
  }, [period, profitAllPct, weightedPeriodPct]);

  const dividendWeightedYield = useMemo(() => {
    if (equity <= 0) return null;
    let num = 0;
    let denom = 0;
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      const y = yieldBySymbol[sym];
      if (y == null || !Number.isFinite(y)) continue;
      num += h.currentValue * y;
      denom += h.currentValue;
    }
    if (denom <= 0) return null;
    return num / denom;
  }, [holdings, yieldBySymbol, equity]);

  const dividendAnnualUsd = useMemo(() => {
    if (equity <= 0) return null;
    let sum = 0;
    let any = false;
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      const y = yieldBySymbol[sym];
      if (y == null || !Number.isFinite(y)) continue;
      any = true;
      sum += h.currentValue * (y / 100);
    }
    return any ? sum : null;
  }, [holdings, yieldBySymbol, equity]);

  const isEmptyOverview = holdings.length === 0;
  const showEmptyPortfolioMetrics = isEmptyOverview && !hasTradeHistory;
  const showMetricSkeleton = symbols.length > 0 && !overviewReady;

  const totalProfitBreakdownId = useId();

  const setAthSnapshot = usePortfolioOverviewAthPublisher();
  useEffect(() => {
    if (symbols.length === 0) {
      setAthSnapshot({ marketReady: true, athReturnPct: null });
      return;
    }
    setAthSnapshot({
      marketReady: true,
      athReturnPct: lifetimeReturnPct,
    });
  }, [symbols.length, lifetimeReturnPct, setAthSnapshot]);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {showMetricSkeleton ? (
        <>
          <OverviewMetricCardSkeleton />
          <OverviewMetricCardSkeleton />
          <OverviewMetricCardSkeleton />
          <OverviewMetricCardSkeleton />
        </>
      ) : (
        <>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <p className="text-xs font-medium text-[#71717A]">Value</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
              {usd.format(normalizeUsdForDisplay(netWorth))}
            </p>
            <p className="mt-2 text-sm text-[#71717A]">{usd.format(invested)} invested</p>
          </div>

          {/* Total profit */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <p className="text-xs font-medium text-[#71717A]">Total profit</p>
            {showEmptyPortfolioMetrics ? (
              <>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#16A34A]">
                  +{usd.format(0)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums text-[#16A34A]">+{pctFmt.format(0)}%</span>
                  <span className="text-xs font-medium text-[#09090B]">ATH</span>
                </div>
              </>
            ) : (
              <div
                className="group/profit relative mt-2 outline-none"
                tabIndex={0}
                aria-describedby={totalProfitBreakdownId}
              >
                <p
                  className={cn(
                    "cursor-help text-2xl font-semibold tabular-nums tracking-tight",
                    (profitDisplayUsd ?? 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                  )}
                >
                  {profitDisplayUsd != null
                    ? `${profitDisplayUsd >= 0 ? "+" : ""}${usd.format(profitDisplayUsd)}`
                    : "—"}
                </p>
                {period === "all" ? (
                  <div className="mt-2 flex cursor-help flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        (inceptionBenchmarkMetrics.rPort ?? 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                      )}
                    >
                      {inceptionBenchmarkMetrics.rPort != null
                        ? `${inceptionBenchmarkMetrics.rPort >= 0 ? "+" : ""}${pctFmt.format(inceptionBenchmarkMetrics.rPort)}%`
                        : "—"}
                    </span>
                    <span className="text-xs font-medium text-[#09090B]">ATH</span>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "cursor-help text-sm font-medium tabular-nums",
                        (profitDisplayPct ?? 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                      )}
                    >
                      {profitDisplayPct != null
                        ? `${profitDisplayPct >= 0 ? "+" : ""}${pctFmt.format(profitDisplayPct)}%`
                        : "—"}
                    </span>
                    <div className="relative inline-flex items-center gap-0.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-1.5 py-0.5">
                      <select
                        aria-label="Profit period"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as OverviewProfitPeriod)}
                        className="cursor-pointer bg-transparent pr-5 text-xs font-medium text-[#09090B] outline-none"
                      >
                        {PERIOD_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-[#71717A]" aria-hidden />
                    </div>
                  </div>
                )}
                <div
                  id={totalProfitBreakdownId}
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-max min-w-[220px] max-w-[min(calc(100vw-2rem),280px)] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 text-left text-xs shadow-[0px_4px_14px_0px_rgba(10,10,10,0.08)] opacity-0 transition-opacity duration-150 group-hover/profit:opacity-100 group-focus-within/profit:opacity-100"
                >
                  {period !== "all" ? (
                    <p className="mb-2 border-b border-[#F4F4F5] pb-2 text-[11px] font-medium leading-4 text-[#71717A]">
                      Lifetime equity P&amp;L (open vs sold). Headline uses the period you selected.
                    </p>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="shrink-0 text-[#71717A]">Realized (sold)</span>
                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        normalizeUsdForDisplay(realizedLifetimeUsd) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                      )}
                    >
                      {`${normalizeUsdForDisplay(realizedLifetimeUsd) >= 0 ? "+" : ""}${usd.format(normalizeUsdForDisplay(realizedLifetimeUsd))}`}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-4">
                    <span className="shrink-0 text-[#71717A]">Unrealized (not sold yet)</span>
                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        normalizeUsdForDisplay(unrealizedLifetimeUsd) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                      )}
                    >
                      {`${normalizeUsdForDisplay(unrealizedLifetimeUsd) >= 0 ? "+" : ""}${usd.format(normalizeUsdForDisplay(unrealizedLifetimeUsd))}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* S&P 500 */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <p className="text-xs font-medium text-[#71717A]">S&amp;P 500</p>
            {showEmptyPortfolioMetrics ? (
              <>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#16A34A]">
                  +{pctFmt.format(0)}%
                </p>
                <p className="mt-2 text-sm leading-snug text-[#71717A]">Compare to S&amp;P 500</p>
              </>
            ) : (
              <>
                <p
                  className={cn(
                    "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
                    inceptionBenchmarkMetrics.rSpy == null
                      ? "text-[#09090B]"
                      : inceptionBenchmarkMetrics.rSpy >= 0
                        ? "text-[#16A34A]"
                        : "text-[#DC2626]",
                  )}
                >
                  {inceptionBenchmarkMetrics.rSpy != null
                    ? `${inceptionBenchmarkMetrics.rSpy >= 0 ? "+" : ""}${pctFmt.format(inceptionBenchmarkMetrics.rSpy)}%`
                    : "—"}
                </p>
                <p className="mt-2 text-sm leading-snug text-[#71717A]">
                  {inceptionBenchmarkMetrics.diff != null ? (
                    inceptionBenchmarkMetrics.diff >= 0 ? (
                      <>Ahead on {pctFmt.format(inceptionBenchmarkMetrics.diff)}%</>
                    ) : (
                      <>Behind on {pctFmt.format(Math.abs(inceptionBenchmarkMetrics.diff))}%</>
                    )
                  ) : (
                    "—"
                  )}
                </p>
              </>
            )}
          </div>

          {/* Dividends */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <p className="text-xs font-medium text-[#71717A]">Dividends</p>
            {showEmptyPortfolioMetrics ? (
              <>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
                  {pctFmt.format(0)}%
                </p>
                <p className="mt-2 text-sm text-[#71717A]">{usd.format(0)} annually</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
                  {dividendWeightedYield != null ? `${pctFmt.format(dividendWeightedYield)}%` : "—"}
                </p>
                <p className="mt-2 text-sm text-[#71717A]">
                  {dividendAnnualUsd != null ? `${usd.format(dividendAnnualUsd)} annually` : "No dividend data"}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const PortfolioOverviewCards = memo(PortfolioOverviewCardsInner);
