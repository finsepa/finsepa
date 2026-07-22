"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { usePortfolioOverviewAthPublisher } from "@/components/portfolio/portfolio-overview-ath-context";
import { ChevronDown } from "@/lib/icons";

import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  equityMarketValue,
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalCostBasisInvested,
  totalNetWorth,
  unrealizedProfitUsd,
} from "@/lib/portfolio/overview-metrics";
import {
  cumulativeRealizedGainUsd,
  lifetimeEquityProfitUsd,
  tradeSymbolsFromHistory,
} from "@/lib/portfolio/realized-pnl-from-trades";
import type { OverviewProfitPeriod } from "@/lib/portfolio/overview-market-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { fetchPortfolioDietzReturnsClient } from "@/lib/portfolio/returns/fetch-dietz-returns-client";
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

/** Matches {@link IndexCards} screener index tile chrome. */
const OVERVIEW_METRIC_CARD_CLASS = cn(
  "flex flex-col items-start gap-1 overflow-hidden px-3 py-3 sm:px-4 sm:py-4",
  MOBILE_ELEVATED_CARD_CLASS,
);

function OverviewMetricCardSkeleton() {
  return (
    <div className={OVERVIEW_METRIC_CARD_CLASS} aria-hidden>
      <div className="h-3 w-14 animate-pulse rounded bg-neutral-200" />
      <div className="h-8 w-[min(100%,11rem)] max-w-full animate-pulse rounded-md bg-neutral-200" />
      <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}

function totalProfitTooltipPosition(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const maxWidth = Math.min(window.innerWidth - 16, 280);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - maxWidth - 8);
  return { left, top: rect.bottom + 8, maxWidth };
}

function TotalProfitBreakdownTooltip({
  tooltipId,
  period,
  realizedLifetimeUsd,
  unrealizedLifetimeUsd,
  children,
}: {
  tooltipId: string;
  period: OverviewProfitPeriod;
  realizedLifetimeUsd: number;
  unrealizedLifetimeUsd: number;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, maxWidth: 280 });

  useEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPos(totalProfitTooltipPosition(trigger));
  }, []);

  const show = useCallback(() => {
    reposition();
    setOpen(true);
  }, [reposition]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const tooltip =
    open && mounted ? (
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none fixed z-[200] w-max min-w-[220px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 text-left text-xs shadow-[0px_4px_14px_0px_rgba(10,10,10,0.08)]"
        style={{ left: pos.left, top: pos.top, maxWidth: pos.maxWidth }}
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
    ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="w-full outline-none"
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={(event) => {
          if (!triggerRef.current?.contains(event.relatedTarget as Node | null)) hide();
        }}
      >
        {children}
      </div>
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </>
  );
}

type DietzPeriodSlice = {
  pct: number | null;
  gainUsd: number | null;
};

function PortfolioOverviewCardsInner({
  holdings,
  transactions,
  mobileToolbarActions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  mobileToolbarActions?: ReactNode;
}) {
  const cash = useMemo(() => netCashUsd(transactions), [transactions]);
  const netWorth = useMemo(() => totalNetWorth(holdings, cash), [holdings, cash]);
  const invested = useMemo(() => totalCostBasisInvested(holdings), [holdings]);
  const profitAllUsd = useMemo(
    () => lifetimeEquityProfitUsd(holdings, transactions),
    [holdings, transactions],
  );
  /** Lifetime equity ROC — reconciles with All $ (not flow-adjusted Dietz). */
  const profitAllPct = useMemo(() => {
    const pct = lifetimeEquityProfitPct(holdings, transactions);
    if (pct != null) return pct;
    if (profitAllUsd === 0) return 0;
    return null;
  }, [holdings, transactions, profitAllUsd]);
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

  const [period, setPeriod] = useState<OverviewProfitPeriod>("all");
  /** False until overview-market finishes when any symbols need a quote. */
  const [overviewReady, setOverviewReady] = useState(false);
  const lastOverviewLoadKeyRef = useRef("");
  const lastOverviewLoadStateRef = useRef<"idle" | "inflight" | "done" | "error">("idle");
  const overviewLoadGenRef = useRef(0);
  const overviewReadyRef = useRef(false);
  overviewReadyRef.current = overviewReady;
  /** Retained from overview-market payload (benchmark path); period cards use Dietz. */
  const [, setPerfBySymbol] = useState<Record<string, StockPerformance | null>>({});
  const [, setSpyPerf] = useState<StockPerformance | null>(null);
  const [yieldBySymbol, setYieldBySymbol] = useState<Record<string, number | null>>({});
  const [dietzByPeriod, setDietzByPeriod] = useState<
    Partial<Record<Exclude<OverviewProfitPeriod, "all">, DietzPeriodSlice>>
  >({});
  const [benchmarkCompare, setBenchmarkCompare] = useState<{
    portfolioPct: number | null;
    benchmarkPct: number | null;
    aheadPct: number | null;
  } | null>(null);
  /** True while first benchmark-compare is in flight (no prior values to show). */
  const [benchmarkLoading, setBenchmarkLoading] = useState(true);
  const hasBenchmarkCompareRef = useRef(false);

  const symbolsKey = useMemo(() => {
    const fromHoldings = [...new Set(holdings.map((h) => h.symbol.toUpperCase()))];
    const syms = fromHoldings.length > 0 ? fromHoldings : tradeSymbolsFromHistory(transactions);
    return syms
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .sort()
      .join(",");
  }, [holdings, transactions]);

  const symbols = useMemo(() => (symbolsKey ? symbolsKey.split(",") : []), [symbolsKey]);

  const loadMarket = useCallback(async () => {
    if (symbols.length === 0) {
      setPerfBySymbol({});
      setSpyPerf(null);
      setYieldBySymbol({});
      setOverviewReady(true);
      return;
    }

    const loadKey = symbols.join(",");
    if (loadKey === lastOverviewLoadKeyRef.current && lastOverviewLoadStateRef.current !== "error") {
      return;
    }
    lastOverviewLoadKeyRef.current = loadKey;

    const sessionKey = `finsepa.portfolio.overviewMarket.v2.${loadKey}`;
    const OVERVIEW_SESSION_TTL_MS = 5 * 60_000;
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as
          | {
              at: number;
              data: {
                spy: StockPerformance | null;
                performanceBySymbol: Record<string, StockPerformance | null>;
                yieldBySymbol: Record<string, number | null>;
              };
            }
          | null;
        if (parsed && typeof parsed.at === "number" && Date.now() - parsed.at < OVERVIEW_SESSION_TTL_MS) {
          const data = parsed.data;
          setSpyPerf(data.spy ?? null);
          setPerfBySymbol(data.performanceBySymbol ?? {});
          setYieldBySymbol(data.yieldBySymbol ?? {});
          lastOverviewLoadStateRef.current = "done";
          setOverviewReady(true);
          return;
        }
      }
    } catch {
      // ignore
    }

    const gen = ++overviewLoadGenRef.current;
    lastOverviewLoadStateRef.current = "inflight";
    setOverviewReady(false);
    try {
      const res = await fetch("/api/portfolio/overview-market", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols,
          inceptionYmd: null,
          inceptionPriceTickers: [],
        }),
      });

      if (!res.ok) {
        throw new Error("overview-market failed");
      }

      if (gen !== overviewLoadGenRef.current) return;

      const data = (await res.json()) as {
        spy: StockPerformance | null;
        performanceBySymbol: Record<string, StockPerformance | null>;
        yieldBySymbol: Record<string, number | null>;
      };

      setSpyPerf(data.spy ?? null);
      setPerfBySymbol(data.performanceBySymbol ?? {});
      setYieldBySymbol(data.yieldBySymbol ?? {});

      lastOverviewLoadStateRef.current = "done";
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify({ at: Date.now(), data }));
      } catch {
        // ignore
      }
    } catch {
      if (gen !== overviewLoadGenRef.current) return;
      // Keep prior market/yield snapshot on failure — avoid dividend flash to "—".
      lastOverviewLoadStateRef.current = "error";
    } finally {
      if (gen === overviewLoadGenRef.current) {
        setOverviewReady(true);
      }
    }
  }, [symbols]);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  /** Phase 2: Modified Dietz for 1M / YTD / 1Y / 5Y overview cards. */
  useEffect(() => {
    if (transactions.length === 0) {
      setDietzByPeriod({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const data = await fetchPortfolioDietzReturnsClient(transactions, [
          "m1",
          "ytd",
          "y1",
          "y5",
        ]);
        if (cancelled) return;
        const next: Partial<Record<Exclude<OverviewProfitPeriod, "all">, DietzPeriodSlice>> = {};
        for (const key of ["m1", "ytd", "y1", "y5"] as const) {
          const row = data[key];
          if (row) next[key] = { pct: row.pct, gainUsd: row.gainUsd };
        }
        setDietzByPeriod(next);
      } catch {
        // Keep prior successful Dietz slices — avoid flashing "—" on transient failure.
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  /** Phase 3: contribution-model Dietz vs Dietz (Ahead / S&P card). */
  useEffect(() => {
    if (transactions.length === 0) {
      setBenchmarkCompare(null);
      hasBenchmarkCompareRef.current = false;
      setBenchmarkLoading(false);
      return;
    }
    let cancelled = false;
    if (!hasBenchmarkCompareRef.current) setBenchmarkLoading(true);
    const run = async (attempt: number) => {
      try {
        const res = await fetch("/api/portfolio/benchmark-compare", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactions,
            benchmark: SPY_BENCHMARK,
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 400));
            if (!cancelled) void run(attempt + 1);
            return;
          }
          if (!cancelled) setBenchmarkLoading(false);
          return;
        }
        const data = (await res.json()) as {
          portfolioPct: number | null;
          benchmarkPct: number | null;
          aheadPct: number | null;
        };
        if (cancelled) return;
        if (data.benchmarkPct == null && data.portfolioPct == null && attempt < 1) {
          await new Promise((r) => setTimeout(r, 400));
          if (!cancelled) void run(attempt + 1);
          return;
        }
        setBenchmarkCompare({
          portfolioPct: data.portfolioPct,
          benchmarkPct: data.benchmarkPct,
          aheadPct: data.aheadPct,
        });
        hasBenchmarkCompareRef.current = true;
        setBenchmarkLoading(false);
      } catch {
        if (cancelled) return;
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 400));
          if (!cancelled) void run(attempt + 1);
          return;
        }
        // Keep prior successful compare on hard failure — avoid flashing "—".
        setBenchmarkLoading(false);
      }
    };
    void run(0);
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  const dietzPeriod = period === "all" ? null : (dietzByPeriod[period] ?? null);

  /**
   * Lifetime equity ROC — aligns with Total Profit $ (cost-basis simple return).
   * Kept as fallback when Dietz is unavailable.
   */
  const lifetimeReturnPct = profitAllPct;

  const inceptionBenchmarkMetrics = useMemo(() => {
    const rSpy = benchmarkCompare?.benchmarkPct ?? null;
    const rPort = benchmarkCompare?.portfolioPct ?? null;
    const diff = benchmarkCompare?.aheadPct ?? null;
    return { rPort, rSpy, diff };
  }, [benchmarkCompare]);

  /**
   * Headline % under Total profit $ (All) — Phase 2/3 Modified Dietz (same as chart Return
   * and the portfolio leg of Ahead). Comparable to S&P card. Falls back to lifetime ROC
   * only when Dietz cannot be computed.
   */
  const allPeriodProfitPct = inceptionBenchmarkMetrics.rPort ?? lifetimeReturnPct;

  const profitDisplayUsd = useMemo(() => {
    if (period === "all") return profitAllUsd;
    return dietzPeriod?.gainUsd ?? null;
  }, [period, profitAllUsd, dietzPeriod]);

  const profitDisplayPct = useMemo(() => {
    if (period === "all") return profitAllPct;
    return dietzPeriod?.pct ?? null;
  }, [period, profitAllPct, dietzPeriod]);

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
  /** S&P card: skeleton while first compare loads — never show "—" during that wait. */
  const showSpySkeleton =
    !showEmptyPortfolioMetrics &&
    !showMetricSkeleton &&
    transactions.length > 0 &&
    benchmarkLoading &&
    inceptionBenchmarkMetrics.rSpy == null &&
    inceptionBenchmarkMetrics.diff == null;
  /**
   * All-time profit % uses Dietz (same as chart Return). Skeleton until first Dietz arrives
   * so we don't flash lifetime ~27% then jump to ~38%.
   */
  const showAllProfitPctSkeleton =
    !showEmptyPortfolioMetrics &&
    !showMetricSkeleton &&
    period === "all" &&
    transactions.length > 0 &&
    benchmarkLoading &&
    inceptionBenchmarkMetrics.rPort == null;

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

  const mobileProfitLine = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${usd.format(0)} (+${pctFmt.format(0)}%)`;
    const pUsd = profitAllUsd;
    if (pUsd == null || !Number.isFinite(pUsd)) return "—";
    if (showAllProfitPctSkeleton) return null;
    const pPct = allPeriodProfitPct;
    if (pPct == null || !Number.isFinite(pPct)) {
      const usdLabel = `${pUsd >= 0 ? "+" : ""}${usd.format(pUsd)}`;
      return usdLabel;
    }
    const usdLabel = `${pUsd >= 0 ? "+" : ""}${usd.format(pUsd)}`;
    const pctLabel = `${pPct >= 0 ? "+" : ""}${pctFmt.format(pPct)}%`;
    return `${usdLabel} (${pctLabel})`;
  }, [showEmptyPortfolioMetrics, profitAllUsd, showAllProfitPctSkeleton, allPeriodProfitPct]);

  const mobileBenchmarkPct = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${pctFmt.format(0)}%`;
    if (showSpySkeleton) return null;
    const r = inceptionBenchmarkMetrics.rSpy;
    if (r == null || !Number.isFinite(r)) return "—";
    return `${r >= 0 ? "+" : ""}${pctFmt.format(r)}%`;
  }, [showEmptyPortfolioMetrics, showSpySkeleton, inceptionBenchmarkMetrics.rSpy]);

  const mobileDividendsRight = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `${usd.format(0)} · ${pctFmt.format(0)}%`;
    const y = dividendWeightedYield;
    const a = dividendAnnualUsd;
    if (y == null || !Number.isFinite(y) || a == null || !Number.isFinite(a)) return "—";
    return `${usd.format(a)} · ${pctFmt.format(y)}%`;
  }, [showEmptyPortfolioMetrics, dividendWeightedYield, dividendAnnualUsd]);

  return (
    <div className="w-full min-w-0 max-md:mb-2 sm:mb-6">
      {/* Mobile: compact summary (matches design reference). */}
      <div className="sm:hidden">
        {showMetricSkeleton ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-10 animate-pulse rounded bg-neutral-200" />
                <div className="h-8 w-[min(100%,14rem)] max-w-full animate-pulse rounded-md bg-neutral-200" />
                <div className="h-4 w-36 animate-pulse rounded bg-neutral-100" />
              </div>
              {mobileToolbarActions ? (
                <div className="flex shrink-0 items-center gap-2">{mobileToolbarActions}</div>
              ) : null}
            </div>
            <div className="mt-1 space-y-0">
              <div className="h-5 w-full animate-pulse rounded bg-neutral-100" />
              <div className="h-5 w-full animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ) : (
          <div className="w-full min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#71717A]">Value</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#0F0F0F]">
                  {usd.format(normalizeUsdForDisplay(netWorth))}
                </p>
                <p className="mt-1 text-sm font-normal tabular-nums text-[#16A34A]">
                  {showAllProfitPctSkeleton || mobileProfitLine == null ? (
                    <span className="inline-block h-4 w-40 animate-pulse rounded bg-neutral-200 align-middle" aria-hidden />
                  ) : (
                    mobileProfitLine
                  )}
                </p>
              </div>
              {mobileToolbarActions ? (
                <div className="flex shrink-0 items-center gap-2">{mobileToolbarActions}</div>
              ) : null}
            </div>

            <div className="max-md:mt-2 sm:mt-4 space-y-0">
              <div className="flex items-center justify-between gap-4 max-md:py-2 sm:py-3">
                <span className="text-[14px] font-medium leading-5 text-[#71717A]">S&amp;P 500</span>
                {showSpySkeleton || mobileBenchmarkPct == null ? (
                  <div className="h-4 w-14 animate-pulse rounded bg-neutral-200" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "text-[14px] font-medium leading-5 tabular-nums",
                      showEmptyPortfolioMetrics
                        ? "text-[#16A34A]"
                        : inceptionBenchmarkMetrics.rSpy == null
                          ? "text-[#0F0F0F]"
                          : inceptionBenchmarkMetrics.rSpy >= 0
                            ? "text-[#16A34A]"
                            : "text-[#DC2626]",
                    )}
                  >
                    {mobileBenchmarkPct}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 pb-0.5">
                <span className="text-[14px] font-medium leading-5 text-[#71717A]">Dividends</span>
                <span className="text-[14px] font-medium leading-5 tabular-nums text-[#0F0F0F]">
                  {mobileDividendsRight}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* sm+: existing tile grid */}
      <div className="hidden grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0 sm:grid">
      {showMetricSkeleton ? (
        <>
          <OverviewMetricCardSkeleton />
          <OverviewMetricCardSkeleton />
          <OverviewMetricCardSkeleton />
          <OverviewMetricCardSkeleton />
        </>
      ) : (
        <>
          <div className={OVERVIEW_METRIC_CARD_CLASS}>
            <p className="text-xs font-medium text-[#71717A]">Value</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#0F0F0F]">
              {usd.format(normalizeUsdForDisplay(netWorth))}
            </p>
            <p className="text-sm text-[#71717A]">{usd.format(invested)} invested</p>
          </div>

          {/* Total profit */}
          <div className={OVERVIEW_METRIC_CARD_CLASS}>
            <p className="text-xs font-medium text-[#71717A]">Total profit</p>
            {showEmptyPortfolioMetrics ? (
              <>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#16A34A]">
                  +{usd.format(0)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums text-[#16A34A]">+{pctFmt.format(0)}%</span>
                </div>
              </>
            ) : (
              <TotalProfitBreakdownTooltip
                tooltipId={totalProfitBreakdownId}
                period={period}
                realizedLifetimeUsd={realizedLifetimeUsd}
                unrealizedLifetimeUsd={unrealizedLifetimeUsd}
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
                  <div className="flex cursor-help flex-wrap items-center gap-2">
                    {showAllProfitPctSkeleton ? (
                      <div className="h-4 w-14 animate-pulse rounded bg-neutral-200" aria-hidden />
                    ) : (
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          (allPeriodProfitPct ?? 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                        )}
                      >
                        {allPeriodProfitPct != null
                          ? `${allPeriodProfitPct >= 0 ? "+" : ""}${pctFmt.format(allPeriodProfitPct)}%`
                          : "—"}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
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
                        className="cursor-pointer bg-transparent pr-5 text-xs font-medium text-[#0F0F0F] outline-none"
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
              </TotalProfitBreakdownTooltip>
            )}
          </div>

          {/* S&P 500 */}
          <div className={OVERVIEW_METRIC_CARD_CLASS}>
            <p className="text-xs font-medium text-[#71717A]">S&amp;P 500</p>
            {showEmptyPortfolioMetrics ? (
              <>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#16A34A]">
                  +{pctFmt.format(0)}%
                </p>
                <p className="text-sm leading-snug text-[#71717A]">Compare to S&amp;P 500</p>
              </>
            ) : showSpySkeleton ? (
              <>
                <div className="h-8 w-[min(100%,7rem)] max-w-full animate-pulse rounded-md bg-neutral-200" aria-hidden />
                <div className="h-4 w-28 animate-pulse rounded bg-neutral-100" aria-hidden />
              </>
            ) : (
              <>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums tracking-tight",
                    inceptionBenchmarkMetrics.rSpy == null
                      ? "text-[#0F0F0F]"
                      : inceptionBenchmarkMetrics.rSpy >= 0
                        ? "text-[#16A34A]"
                        : "text-[#DC2626]",
                  )}
                >
                  {inceptionBenchmarkMetrics.rSpy != null
                    ? `${inceptionBenchmarkMetrics.rSpy >= 0 ? "+" : ""}${pctFmt.format(inceptionBenchmarkMetrics.rSpy)}%`
                    : "—"}
                </p>
                <p className="text-sm leading-snug text-[#71717A]">
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
          <div className={OVERVIEW_METRIC_CARD_CLASS}>
            <p className="text-xs font-medium text-[#71717A]">Dividends</p>
            {showEmptyPortfolioMetrics ? (
              <>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#0F0F0F]">
                  {pctFmt.format(0)}%
                </p>
                <p className="text-sm text-[#71717A]">{usd.format(0)} annually</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#0F0F0F]">
                  {dividendWeightedYield != null ? `${pctFmt.format(dividendWeightedYield)}%` : "—"}
                </p>
                <p className="text-sm text-[#71717A]">
                  {dividendAnnualUsd != null ? `${usd.format(dividendAnnualUsd)} annually` : "No dividend data"}
                </p>
              </>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export const PortfolioOverviewCards = memo(PortfolioOverviewCardsInner);
