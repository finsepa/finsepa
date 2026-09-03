"use client";

import Link from "next/link";
import { Layers2, Plus } from "@/lib/icons";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

import type { ChartDisplayState, HoldingsTradeTooltipItem } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { ChartControls } from "@/components/stock/chart-controls";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import { portfolioSharesUnitTicker } from "@/lib/portfolio/custom-asset-symbol";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import { netCashUsd, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";
import {
  cumulativeRealizedGainUsdForAsset,
  totalTradeFeesUsdForAsset,
} from "@/lib/portfolio/realized-pnl-from-trades";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { cn } from "@/lib/utils";

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const assetTxGrid =
  "grid grid-cols-[minmax(108px,1.1fr)_minmax(84px,0.9fr)_minmax(96px,1fr)_minmax(96px,1fr)_minmax(128px,1.1fr)] items-center gap-x-2";

const assetTxNumericHeaderClass = cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS);
const assetTxNumericCellClass = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

function formatSharesDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  const truncated = Math.trunc(n * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(truncated);
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function opColorClass(operation: string): string {
  const u = operation.toLowerCase();
  if (u.includes("sell")) return "text-down";
  if (u.includes("buy")) return "text-up";
  return "text-fg";
}

function sumColorClass(sum: number): string {
  if (sum > 0) return "text-up";
  if (sum < 0) return "text-down";
  return "text-fg";
}

function PositionStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] font-normal leading-4 text-fg-muted">{label}</div>
      <div className="mt-1.5 min-w-0 text-[14px] font-semibold leading-5 tabular-nums text-fg">
        {children}
      </div>
    </div>
  );
}

export function AssetPortfolioHoldingsTab({
  assetKind,
  routeKey,
  assetDisplayName,
  onChartDisplayChange,
}: {
  assetKind: "stock" | "crypto";
  routeKey: string;
  /** Fallback label for empty copy when the page is still loading name/meta. */
  assetDisplayName: string;
  /** Optional: sync the page header price using this chart (used on Holdings tab). */
  onChartDisplayChange?: (s: ChartDisplayState) => void;
}) {
  const {
    portfolios,
    selectedPortfolioId,
    setSelectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    portfolioDisplayReady,
    selectedPortfolioReadOnly,
    openNewTransactionWithPreset,
  } = usePortfolioWorkspace();

  const route = routeKey.trim().toUpperCase();
  const [holdingsChartRange, setHoldingsChartRange] = useState<StockChartRange>("1Y");

  const portfolioTabs = useMemo((): TabSwitcherOption<string>[] => {
    return portfolios.map((p) => ({ value: p.id, label: p.name }));
  }, [portfolios]);

  useEffect(() => {
    if (selectedPortfolioId != null) return;
    if (!portfolioDisplayReady) return;
    if (!portfolios.length) return;
    // If nothing is selected yet, default to the first portfolio (topbar usually sets this).
    setSelectedPortfolioId(portfolios[0]!.id);
  }, [portfolioDisplayReady, portfolios, selectedPortfolioId, setSelectedPortfolioId]);

  const selectedPortfolio = useMemo(
    () => portfolios.find((p) => p.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  const holdings = selectedPortfolioId != null ? holdingsByPortfolioId[selectedPortfolioId] ?? [] : [];
  const transactions = selectedPortfolioId != null ? transactionsByPortfolioId[selectedPortfolioId] ?? [] : [];

  const holding = useMemo((): PortfolioHolding | null => {
    for (const h of holdings) {
      if (portfolioSymbolMatchesAssetRoute({ holdingSymbol: h.symbol, routeKey: route, kind: assetKind })) {
        return h;
      }
    }
    return null;
  }, [holdings, route, assetKind]);

  const cashUsd = useMemo(() => netCashUsd(transactions), [transactions]);
  const netWorth = useMemo(() => totalNetWorth(holdings, cashUsd), [holdings, cashUsd]);
  const allocationDenomUsd = useMemo(() => {
    const equity = holdings.reduce((s, h) => s + h.currentValue, 0);
    const denom = equity + Math.max(0, cashUsd);
    return denom > 0 ? denom : 0;
  }, [holdings, cashUsd]);

  const tradeRows = useMemo(() => {
    const out = transactions.filter(
      (t) =>
        t.kind === "trade" &&
        portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: route, kind: assetKind }),
    );
    return [...out].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return 0;
    });
  }, [transactions, route, assetKind]);

  const tradeMarkersForChart = useMemo(() => {
    const chronological = [...tradeRows].sort((a, b) => a.date.localeCompare(b.date));
    return chronological
      .map((t) => {
        const op = t.operation.toLowerCase();
        if (op === "buy") return { date: t.date, side: "buy" as const };
        if (op === "sell") return { date: t.date, side: "sell" as const };
        return null;
      })
      .filter((x): x is { date: string; side: "buy" | "sell" } => x != null);
  }, [tradeRows]);

  const tradeTooltipItems = useMemo((): HoldingsTradeTooltipItem[] => {
    const out = new Map<string, string[]>();
    for (const t of tradeRows) {
      const op = t.operation.toLowerCase();
      if (op !== "buy" && op !== "sell") continue;
      const lines = out.get(t.date) ?? [];
      lines.push(
        `${t.operation} · ${formatSharesDisplay(t.shares)} @ ${formatPortfolioUsdPerUnit(t.price)}`,
      );
      out.set(t.date, lines);
    }
    return [...out.entries()].map(([date, lines]) => ({ date, lines }));
  }, [tradeRows]);

  if (!portfolioDisplayReady) {
    return (
      <div className="rounded-[12px] border border-stroke bg-surface px-6 py-10">
        <div className="mx-auto max-w-md space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-full animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-skeleton" />
        </div>
      </div>
    );
  }

  const portfolioTabBar =
    portfolioTabs.length > 1 ? (
      <div className="mb-4">
        <div className="max-w-full overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
          <TabSwitcher
            options={portfolioTabs}
            value={selectedPortfolioId ?? portfolioTabs[0]!.value}
            onChange={(next) => setSelectedPortfolioId(next)}
            aria-label="Portfolio"
            className="min-w-min flex-nowrap"
          />
        </div>
      </div>
    ) : null;

  const portfolioTitleSlot =
    portfolioTabs.length > 1 ? (
      <div className="max-w-full overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
        <TabSwitcher
          options={portfolioTabs}
          value={selectedPortfolioId ?? portfolioTabs[0]!.value}
          onChange={(next) => setSelectedPortfolioId(next)}
          aria-label="Portfolio"
          className="min-w-min flex-nowrap"
        />
      </div>
    ) : null;

  if (selectedPortfolioId == null || !selectedPortfolio) {
    return (
      <div className="min-w-0">
        {portfolioTabBar}
        <Empty variant="card" className="min-h-[min(50vh,400px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Select a portfolio</EmptyTitle>
            <EmptyDescription>
              Choose a portfolio to see whether you hold {assetDisplayName} and your position details.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!holding) {
    return (
      <div className="min-w-0">
        {portfolioTabBar}
        <Empty variant="card" className="min-h-[min(50vh,400px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No position in this portfolio</EmptyTitle>
            <EmptyDescription>
              {selectedPortfolio.name} does not include {assetDisplayName}. Add a buy or import trades on the portfolio
              page to track this asset.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-6">
            <button
              type="button"
              disabled={selectedPortfolioReadOnly}
              title={selectedPortfolioReadOnly ? "Trades are not available for combined portfolios." : undefined}
              onClick={() => openNewTransactionWithPreset({ symbol: route, name: assetDisplayName })}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-fg px-4 text-sm font-semibold text-surface",
                "shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-12))] transition-colors hover:bg-[#18181B]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Add Transaction
            </button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const retUsd = holding.currentValue - holding.costBasis;
  const retPct = holding.costBasis > 0 ? ((holding.currentValue - holding.costBasis) / holding.costBasis) * 100 : 0;
  const weightPctRaw = allocationDenomUsd > 0 ? (holding.currentValue / allocationDenomUsd) * 100 : 0;
  const weightPct = Math.min(100, Math.max(0, weightPctRaw));

  const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, route, assetKind);
  const feesUsd = totalTradeFeesUsdForAsset(transactions, route, assetKind);
  const totalProfitUsd = retUsd + realizedUsd;

  const sharesLabel = (() => {
    const num = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(holding.shares);
    if (assetKind === "crypto") {
      const u = portfolioSharesUnitTicker(holding.symbol);
      return u ? `${num} ${u}` : num;
    }
    return `${num} shares`;
  })();

  const profitTone = (n: number) => (n >= 0 ? "text-up" : "text-down");

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <ChartControls
          activeRange={holdingsChartRange}
          onRangeChange={setHoldingsChartRange}
          titleSlot={portfolioTitleSlot}
        >
          <div className="overflow-visible rounded-[12px] bg-panel">
            <PriceChart
              kind={assetKind}
              symbol={route}
              range={holdingsChartRange}
              holdingsStyle
              tradeMarkers={tradeMarkersForChart}
              tradeTooltipItems={tradeTooltipItems}
              costBasisPrice={holding.avgPrice}
              onDisplayChange={onChartDisplayChange}
            />
          </div>
        </ChartControls>
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-fg">My positions</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[12px] border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
            <h3 className="mb-4 text-[15px] font-semibold leading-5 text-fg">General</h3>
            <div>
              <div className="grid grid-cols-2 gap-4 border-b border-dotted border-stroke pb-4">
                <PositionStat label="Shares">{sharesLabel}</PositionStat>
                <PositionStat label="Current value">{usd0.format(holding.currentValue)}</PositionStat>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-dotted border-stroke py-4">
                <PositionStat label="Cost per share">{formatPortfolioUsdPerUnit(holding.avgPrice)}</PositionStat>
                <PositionStat label="Cost basis">{usd0.format(holding.costBasis)}</PositionStat>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <PositionStat label="Share in portfolio">{pct.format(weightPct)}%</PositionStat>
                <div aria-hidden className="hidden min-[480px]:block" />
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
            <h3 className="mb-4 text-[15px] font-semibold leading-5 text-fg">Return</h3>
            <div>
              <div className="grid grid-cols-2 gap-4 border-b border-dotted border-stroke pb-4">
                <PositionStat label="Total profit">
                  <span className={cn("font-semibold tabular-nums", profitTone(totalProfitUsd))}>
                    {formatSignedUsd(totalProfitUsd)}
                  </span>
                </PositionStat>
                <PositionStat label="Capital gain">
                  <span className={cn("font-semibold tabular-nums", profitTone(retUsd))}>
                    {formatSignedUsd(retUsd)} ({formatSignedPct(retPct)})
                  </span>
                </PositionStat>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <PositionStat label="Realized P&amp;L">
                  <span className={cn("font-semibold tabular-nums", profitTone(realizedUsd))}>
                    {formatSignedUsd(realizedUsd)}
                  </span>
                </PositionStat>
                <PositionStat label="Fees paid">
                  <span className={feesUsd > 0 ? "text-down" : "text-fg-muted"}>
                    {feesUsd <= 0 ? usd0.format(0) : `-${usd0.format(feesUsd)}`}
                  </span>
                </PositionStat>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div>
        <h2 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-fg">Transactions</h2>
        {tradeRows.length === 0 ? (
          <p className="text-[14px] leading-6 text-fg-muted">No trades recorded for this symbol in this portfolio.</p>
        ) : (
          <div
            className={cn(
              "w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
              SCREENER_TABLE_OUTER_BORDER_CLASS,
              SCREENER_TABLE_MOBILE_SURFACE_CLASS,
            )}
          >
            <div className="min-w-[640px] bg-surface">
              <div
                className={cn(
                  SCREENER_TABLE_HEADER_STICKY_CLASS,
                  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                  "md:border-b-0",
                )}
              >
                <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      assetTxGrid,
                      "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                    )}
                  >
                    <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Date</div>
                    <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Type</div>
                    <div className={assetTxNumericHeaderClass}>Shares</div>
                    <div className={assetTxNumericHeaderClass}>Price</div>
                    <div className={assetTxNumericHeaderClass}>Amount</div>
                  </div>
                </div>
                <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
              </div>

              {tradeRows.map((t, i) => {
                return (
                  <div key={t.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                    <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                      <div
                        className={cn(
                          assetTxGrid,
                          "min-h-[60px] text-[14px] font-normal leading-5",
                          SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                        )}
                      >
                        <div
                          className={cn(
                            "text-left font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
                            TABLE_START_ALIGNED_PAD_CLASS,
                          )}
                        >
                          {format(parseISO(t.date), "MMM d, yyyy")}
                        </div>
                        <div
                          className={cn(
                            "min-w-0 truncate text-left text-[14px] font-medium leading-5",
                            TABLE_START_ALIGNED_PAD_CLASS,
                            opColorClass(t.operation),
                          )}
                        >
                          {t.operation}
                        </div>
                        <div className={assetTxNumericCellClass}>
                          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(t.shares)}
                        </div>
                        <div className={assetTxNumericCellClass}>{formatPortfolioUsdPerUnit(t.price)}</div>
                        <div
                          className={cn(
                            "min-w-0 w-full text-right text-[14px] font-medium leading-5 tabular-nums",
                            TABLE_END_ALIGNED_PAD_CLASS,
                            sumColorClass(t.sum),
                          )}
                        >
                          {formatSignedUsd(t.sum)}
                        </div>
                      </div>
                    </div>
                    {i < tradeRows.length - 1 ? (
                      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
