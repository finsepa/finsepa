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

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { earliestStockBuyYmd } from "@/lib/portfolio/benchmark-inception";
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

/** Matches {@link IndexCards} screener index tile chrome. */
const OVERVIEW_METRIC_CARD_CLASS =
  "flex flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white px-3 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] sm:px-4 sm:py-4";

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
  const lastOverviewLoadKeyRef = useRef("");
  const lastOverviewLoadStateRef = useRef<"idle" | "inflight" | "done" | "error">("idle");
  const overviewLoadGenRef = useRef(0);
  const overviewReadyRef = useRef(false);
  overviewReadyRef.current = overviewReady;
  const [perfBySymbol, setPerfBySymbol] = useState<Record<string, StockPerformance | null>>({});
  const [spyPerf, setSpyPerf] = useState<StockPerformance | null>(null);
  const [yieldBySymbol, setYieldBySymbol] = useState<Record<string, number | null>>({});
  const [inceptionSpyPrice0, setInceptionSpyPrice0] = useState<number | null>(null);

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
      setInceptionSpyPrice0(null);
      setOverviewReady(true);
      return;
    }

    const startYmd = earliestStockBuyYmd(transactions);
    let inceptionPriceTickers: string[] = [];
    if (startYmd) {
      // Keep inception benchmark fan-out bounded to current symbols set.
      inceptionPriceTickers = [...new Set([SPY_BENCHMARK, ...symbols])];
    }

    const loadKey = `${symbols.join(",")}|${startYmd ?? ""}|${inceptionPriceTickers.join(",")}`;
    if (loadKey === lastOverviewLoadKeyRef.current && lastOverviewLoadStateRef.current !== "error") {
      return;
    }
    lastOverviewLoadKeyRef.current = loadKey;

    const sessionKey = `finsepa.portfolio.overviewMarket.v1.${loadKey}`;
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
                inceptionPriceByTicker: Record<string, number | null>;
              };
            }
          | null;
        if (parsed && typeof parsed.at === "number" && Date.now() - parsed.at < OVERVIEW_SESSION_TTL_MS) {
          const data = parsed.data;
          setSpyPerf(data.spy ?? null);
          setPerfBySymbol(data.performanceBySymbol ?? {});
          setYieldBySymbol(data.yieldBySymbol ?? {});
          let spy0: number | null = null;
          if (startYmd) {
            const prices = data.inceptionPriceByTicker ?? {};
            spy0 = typeof prices[SPY_BENCHMARK] === "number" ? prices[SPY_BENCHMARK]! : null;
          }
          setInceptionSpyPrice0(spy0);
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
          inceptionYmd: startYmd,
          inceptionPriceTickers: startYmd ? inceptionPriceTickers : [],
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

      lastOverviewLoadStateRef.current = "done";
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify({ at: Date.now(), data }));
      } catch {
        // ignore
      }
    } catch {
      if (gen !== overviewLoadGenRef.current) return;
      setSpyPerf(null);
      setPerfBySymbol({});
      setYieldBySymbol({});
      setInceptionSpyPrice0(null);
      lastOverviewLoadStateRef.current = "error";
    } finally {
      if (gen === overviewLoadGenRef.current) {
        setOverviewReady(true);
      }
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

  const mobileProfitLine = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${usd.format(0)} (+${pctFmt.format(0)}%)`;
    const pUsd = profitAllUsd;
    const pPct = lifetimeReturnPct;
    if (pUsd == null || !Number.isFinite(pUsd) || pPct == null || !Number.isFinite(pPct)) return "—";
    const usdLabel = `${pUsd >= 0 ? "+" : ""}${usd.format(pUsd)}`;
    const pctLabel = `${pPct >= 0 ? "+" : ""}${pctFmt.format(pPct)}%`;
    return `${usdLabel} (${pctLabel})`;
  }, [showEmptyPortfolioMetrics, profitAllUsd, lifetimeReturnPct]);

  const mobileBenchmarkPct = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${pctFmt.format(0)}%`;
    const r = inceptionBenchmarkMetrics.rSpy;
    if (r == null || !Number.isFinite(r)) return "—";
    return `${r >= 0 ? "+" : ""}${pctFmt.format(r)}%`;
  }, [showEmptyPortfolioMetrics, inceptionBenchmarkMetrics.rSpy]);

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
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
                  {usd.format(normalizeUsdForDisplay(netWorth))}
                </p>
                <p className="mt-1 text-sm font-normal tabular-nums text-[#16A34A]">
                  {mobileProfitLine}
                </p>
              </div>
              {mobileToolbarActions ? (
                <div className="flex shrink-0 items-center gap-2">{mobileToolbarActions}</div>
              ) : null}
            </div>

            <div className="max-md:mt-2 sm:mt-4 space-y-0">
              <div className="flex items-center justify-between gap-4 max-md:py-2 sm:py-3">
                <span className="text-[14px] font-medium leading-5 text-[#71717A]">S&amp;P 500</span>
                <span
                  className={cn(
                    "text-[14px] font-medium leading-5 tabular-nums",
                    showEmptyPortfolioMetrics
                      ? "text-[#16A34A]"
                      : inceptionBenchmarkMetrics.rSpy == null
                        ? "text-[#09090B]"
                        : inceptionBenchmarkMetrics.rSpy >= 0
                          ? "text-[#16A34A]"
                          : "text-[#DC2626]",
                  )}
                >
                  {mobileBenchmarkPct}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 pb-0.5">
                <span className="text-[14px] font-medium leading-5 text-[#71717A]">Dividends</span>
                <span className="text-[14px] font-medium leading-5 tabular-nums text-[#09090B]">
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
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
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
            ) : (
              <>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums tracking-tight",
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
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
                  {pctFmt.format(0)}%
                </p>
                <p className="text-sm text-[#71717A]">{usd.format(0)} annually</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
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
