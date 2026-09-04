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

import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { tooltipSurfaceClassName } from "@/components/design-system/tooltip-surface-styles";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalCostBasisInvested,
  totalNetWorth,
  unrealizedProfitUsd,
} from "@/lib/portfolio/overview-metrics";
import { portfolioDividendIncome } from "@/lib/portfolio/portfolio-dividend-income";
import {
  cumulativeRealizedGainUsd,
  lifetimeEquityProfitUsd,
  tradeSymbolsFromHistory,
} from "@/lib/portfolio/realized-pnl-from-trades";
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

/** Matches elevated card chrome; 16px inset (denser than 20px multichart panels). */
const OVERVIEW_METRIC_CARD_CLASS = cn(
  "flex flex-col items-start gap-1 overflow-hidden p-4",
  MOBILE_ELEVATED_CARD_CLASS,
);

function totalProfitTooltipPosition(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const maxWidth = Math.min(window.innerWidth - 16, 280);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - maxWidth - 8);
  return { left, top: rect.bottom + 8, maxWidth };
}

function TradingProfitBreakdownTooltip({
  tooltipId,
  realizedLifetimeUsd,
  unrealizedLifetimeUsd,
  children,
}: {
  tooltipId: string;
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
        className={cn(
          "pointer-events-none fixed z-[200] w-max min-w-[220px] px-3 py-2.5 text-left text-xs",
          tooltipSurfaceClassName,
        )}
        style={{ left: pos.left, top: pos.top, maxWidth: pos.maxWidth }}
      >
        <p className="mb-2 border-b border-surface-muted pb-2 text-[11px] font-medium leading-4 text-fg-muted">
          Trading P&amp;L on cost: realized (sold) + unrealized (still held). Percent is profit ÷
          historical cost — not time-weighted return.
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <span className="shrink-0 text-fg-muted">Realized (sold)</span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              normalizeUsdForDisplay(realizedLifetimeUsd) >= 0 ? "text-up" : "text-down",
            )}
          >
            {`${normalizeUsdForDisplay(realizedLifetimeUsd) >= 0 ? "+" : ""}${usd.format(normalizeUsdForDisplay(realizedLifetimeUsd))}`}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <span className="shrink-0 text-fg-muted">Unrealized (not sold yet)</span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              normalizeUsdForDisplay(unrealizedLifetimeUsd) >= 0 ? "text-up" : "text-down",
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
  const tradingProfitUsd = useMemo(
    () => lifetimeEquityProfitUsd(holdings, transactions),
    [holdings, transactions],
  );
  /** Simple return on historical equity cost — Trading profit %. */
  const tradingProfitPct = useMemo(() => {
    const pct = lifetimeEquityProfitPct(holdings, transactions);
    if (pct != null) return pct;
    if (tradingProfitUsd === 0) return 0;
    return null;
  }, [holdings, transactions, tradingProfitUsd]);
  const realizedLifetimeUsd = useMemo(
    () => cumulativeRealizedGainUsd(transactions),
    [transactions],
  );
  const unrealizedLifetimeUsd = useMemo(() => unrealizedProfitUsd(holdings), [holdings]);

  const hasTradeHistory = useMemo(
    () => tradeSymbolsFromHistory(transactions).length > 0,
    [transactions],
  );

  /** False until overview-market finishes when any symbols need a quote. */
  const [overviewReady, setOverviewReady] = useState(false);
  const lastOverviewLoadKeyRef = useRef("");
  const lastOverviewLoadStateRef = useRef<"idle" | "inflight" | "done" | "error">("idle");
  const overviewLoadGenRef = useRef(0);
  /** Retained from overview-market payload (benchmark path). */
  const [, setPerfBySymbol] = useState<Record<string, StockPerformance | null>>({});
  const [, setSpyPerf] = useState<StockPerformance | null>(null);
  const [yieldBySymbol, setYieldBySymbol] = useState<Record<string, number | null>>({});
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

  /** Contribution-model Dietz vs Dietz (time-weighted return / Ahead of S&P). */
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
        setBenchmarkLoading(false);
      }
    };
    void run(0);
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  const timeWeightedReturnPct = benchmarkCompare?.portfolioPct ?? null;
  const aheadOfSpyPct = benchmarkCompare?.aheadPct ?? null;

  const { annualUsd: dividendAnnualUsd, yieldPct: dividendWeightedYield } = useMemo(
    () => portfolioDividendIncome(holdings, yieldBySymbol),
    [holdings, yieldBySymbol],
  );

  const isEmptyOverview = holdings.length === 0;
  const showEmptyPortfolioMetrics = isEmptyOverview && !hasTradeHistory;
  const showDividendsSkeleton = symbols.length > 0 && !overviewReady;
  const showTimeWeightedSkeleton =
    !showEmptyPortfolioMetrics &&
    transactions.length > 0 &&
    benchmarkLoading &&
    timeWeightedReturnPct == null &&
    aheadOfSpyPct == null;

  const totalProfitBreakdownId = useId();

  const setAthSnapshot = usePortfolioOverviewAthPublisher();
  useEffect(() => {
    if (symbols.length === 0) {
      setAthSnapshot({ marketReady: true, athReturnPct: null });
      return;
    }
    setAthSnapshot({
      marketReady: true,
      athReturnPct: tradingProfitPct,
    });
  }, [symbols.length, tradingProfitPct, setAthSnapshot]);

  const mobileProfitUsdLabel = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${usd.format(0)}`;
    if (!Number.isFinite(tradingProfitUsd)) return "—";
    return `${tradingProfitUsd >= 0 ? "+" : ""}${usd.format(tradingProfitUsd)}`;
  }, [showEmptyPortfolioMetrics, tradingProfitUsd]);

  const mobileProfitPctLabel = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${pctFmt.format(0)}%`;
    if (tradingProfitPct == null || !Number.isFinite(tradingProfitPct)) return null;
    return `${tradingProfitPct >= 0 ? "+" : ""}${pctFmt.format(tradingProfitPct)}%`;
  }, [showEmptyPortfolioMetrics, tradingProfitPct]);

  const mobileTimeWeightedLine = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `+${pctFmt.format(0)}%`;
    if (showTimeWeightedSkeleton) return null;
    if (timeWeightedReturnPct == null || !Number.isFinite(timeWeightedReturnPct)) return "—";
    return `${timeWeightedReturnPct >= 0 ? "+" : ""}${pctFmt.format(timeWeightedReturnPct)}%`;
  }, [showEmptyPortfolioMetrics, showTimeWeightedSkeleton, timeWeightedReturnPct]);

  const mobileDividendsRight = useMemo(() => {
    if (showEmptyPortfolioMetrics) return `${usd.format(0)} · ${pctFmt.format(0)}%`;
    if (showDividendsSkeleton) return null;
    const y = dividendWeightedYield;
    const a = dividendAnnualUsd;
    if (y == null || !Number.isFinite(y) || a == null || !Number.isFinite(a)) return "—";
    return `${usd.format(a)} · ${pctFmt.format(y)}%`;
  }, [showEmptyPortfolioMetrics, showDividendsSkeleton, dividendWeightedYield, dividendAnnualUsd]);

  return (
    <div className="w-full min-w-0 max-md:mb-2 sm:mb-5">
      <div className="sm:hidden">
        <div className="w-full min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-fg-muted">Value</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">
                {usd.format(normalizeUsdForDisplay(netWorth))}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-normal tabular-nums",
                  tradingProfitUsd >= 0 ? "text-up" : "text-down",
                )}
              >
                {mobileProfitUsdLabel}
                {mobileProfitPctLabel != null ? (
                  <>
                    {" "}
                    (
                    <span className={(tradingProfitPct ?? 0) >= 0 ? "text-up" : "text-down"}>
                      {mobileProfitPctLabel}
                    </span>{" "}
                    <span className="text-fg-muted">on cost</span>)
                  </>
                ) : null}
              </p>
            </div>
            {mobileToolbarActions ? (
              <div className="flex shrink-0 items-center gap-2">{mobileToolbarActions}</div>
            ) : null}
          </div>

          <div className="max-md:mt-2 sm:mt-4 space-y-0">
            <div className="flex items-center justify-between gap-4 max-md:py-2 sm:py-3">
              <span className="text-[14px] font-medium leading-5 text-fg-muted">Time-weighted return</span>
              {showEmptyPortfolioMetrics ? (
                <span className="text-[14px] font-medium leading-5 tabular-nums text-up">
                  +{pctFmt.format(0)}%
                </span>
              ) : showTimeWeightedSkeleton || mobileTimeWeightedLine == null ? (
                <div className="h-4 w-14 animate-pulse rounded bg-skeleton" aria-hidden />
              ) : (
                <span
                  className={cn(
                    "text-[14px] font-medium leading-5 tabular-nums",
                    timeWeightedReturnPct == null
                      ? "text-fg"
                      : timeWeightedReturnPct >= 0
                        ? "text-up"
                        : "text-down",
                  )}
                >
                  {mobileTimeWeightedLine}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 pb-0.5">
              <span className="text-[14px] font-medium leading-5 text-fg-muted">Dividends</span>
              {showDividendsSkeleton || mobileDividendsRight == null ? (
                <div className="h-4 w-28 animate-pulse rounded bg-skeleton" aria-hidden />
              ) : (
                <span className="text-[14px] font-medium leading-5 tabular-nums text-fg">
                  {mobileDividendsRight}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0 sm:grid">
        <div className={OVERVIEW_METRIC_CARD_CLASS}>
          <p className="text-xs font-medium text-fg-muted">Value</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
            {usd.format(normalizeUsdForDisplay(netWorth))}
          </p>
          <p className="text-sm text-fg-muted">{usd.format(invested)} invested</p>
        </div>

        <div className={OVERVIEW_METRIC_CARD_CLASS}>
          <p className="text-xs font-medium text-fg-muted">Trading profit</p>
          {showEmptyPortfolioMetrics ? (
            <>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-up">
                +{usd.format(0)}
              </p>
              <p className="text-sm tabular-nums">
                <span className="text-up">+{pctFmt.format(0)}%</span>{" "}
                <span className="text-fg-muted">on cost</span>
              </p>
            </>
          ) : (
            <TradingProfitBreakdownTooltip
              tooltipId={totalProfitBreakdownId}
              realizedLifetimeUsd={realizedLifetimeUsd}
              unrealizedLifetimeUsd={unrealizedLifetimeUsd}
            >
              <p
                className={cn(
                  "cursor-help text-2xl font-semibold tabular-nums tracking-tight",
                  tradingProfitUsd >= 0 ? "text-up" : "text-down",
                )}
              >
                {`${tradingProfitUsd >= 0 ? "+" : ""}${usd.format(tradingProfitUsd)}`}
              </p>
              <p className="cursor-help text-sm tabular-nums">
                {tradingProfitPct != null ? (
                  <>
                    <span className={(tradingProfitPct ?? 0) >= 0 ? "text-up" : "text-down"}>
                      {`${tradingProfitPct >= 0 ? "+" : ""}${pctFmt.format(tradingProfitPct)}%`}
                    </span>{" "}
                    <span className="text-fg-muted">on cost</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </TradingProfitBreakdownTooltip>
          )}
        </div>

        <div className={OVERVIEW_METRIC_CARD_CLASS}>
          <p className="text-xs font-medium text-fg-muted">Time-weighted return</p>
          {showEmptyPortfolioMetrics ? (
            <>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-up">
                +{pctFmt.format(0)}%
              </p>
              <p className="text-sm text-fg-muted">Compare to S&amp;P 500</p>
            </>
          ) : showTimeWeightedSkeleton ? (
            <>
              <div className="h-8 w-[min(100%,7rem)] max-w-full animate-pulse rounded-md bg-skeleton" aria-hidden />
              <div className="h-4 w-28 animate-pulse rounded bg-skeleton" aria-hidden />
            </>
          ) : (
            <>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums tracking-tight",
                  timeWeightedReturnPct == null
                    ? "text-fg"
                    : timeWeightedReturnPct >= 0
                      ? "text-up"
                      : "text-down",
                )}
              >
                {timeWeightedReturnPct != null
                  ? `${timeWeightedReturnPct >= 0 ? "+" : ""}${pctFmt.format(timeWeightedReturnPct)}%`
                  : "—"}
              </p>
              <p className="text-sm text-fg-muted">
                {aheadOfSpyPct != null ? (
                  aheadOfSpyPct >= 0 ? (
                    <>Ahead of S&amp;P by {pctFmt.format(aheadOfSpyPct)}%</>
                  ) : (
                    <>Behind S&amp;P by {pctFmt.format(Math.abs(aheadOfSpyPct))}%</>
                  )
                ) : (
                  "—"
                )}
              </p>
            </>
          )}
        </div>

        <div className={OVERVIEW_METRIC_CARD_CLASS}>
          <p className="text-xs font-medium text-fg-muted">Dividends</p>
          {showEmptyPortfolioMetrics ? (
            <>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
                {pctFmt.format(0)}%
              </p>
              <p className="text-sm text-fg-muted">{usd.format(0)} annually</p>
            </>
          ) : showDividendsSkeleton ? (
            <>
              <div className="h-8 w-[min(100%,7rem)] max-w-full animate-pulse rounded-md bg-skeleton" aria-hidden />
              <div className="h-4 w-28 animate-pulse rounded bg-skeleton" aria-hidden />
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
                {dividendWeightedYield != null ? `${pctFmt.format(dividendWeightedYield)}%` : "—"}
              </p>
              <p className="text-sm text-fg-muted">
                {dividendAnnualUsd != null ? `${usd.format(dividendAnnualUsd)} annually` : "No dividend data"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const PortfolioOverviewCards = memo(PortfolioOverviewCardsInner);
