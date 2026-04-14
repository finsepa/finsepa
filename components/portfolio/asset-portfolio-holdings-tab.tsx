"use client";

import Link from "next/link";
import { Layers2, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

import type { ChartDisplayState, HoldingsTradeTooltipItem } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { ChartControls } from "@/components/stock/chart-controls";
import {
  Empty,
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
import { buildSplitAdjustedTradeIndexForAsset } from "@/lib/portfolio/split-adjusted-trades";
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
  if (u.includes("sell")) return "text-[#DC2626]";
  if (u.includes("buy")) return "text-[#16A34A]";
  return "text-[#09090B]";
}

function sumColorClass(sum: number): string {
  if (sum > 0) return "text-[#16A34A]";
  if (sum < 0) return "text-[#DC2626]";
  return "text-[#09090B]";
}

function PositionStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] font-normal leading-4 text-[#71717A]">{label}</div>
      <div className="mt-1.5 min-w-0 text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
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
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    portfolioDisplayReady,
    selectedPortfolioReadOnly,
    openNewTransactionWithPreset,
  } = usePortfolioWorkspace();

  const route = routeKey.trim().toUpperCase();
  const [holdingsChartRange, setHoldingsChartRange] = useState<StockChartRange>("1Y");

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

  const splitAdjusted = useMemo(
    () => buildSplitAdjustedTradeIndexForAsset(tradeRows, route, assetKind),
    [tradeRows, route, assetKind],
  );

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
      const adj = splitAdjusted.get(t.id);
      const sh = adj?.shares ?? t.shares;
      const pr = adj?.price ?? t.price;
      const lines = out.get(t.date) ?? [];
      lines.push(`${t.operation} · ${formatSharesDisplay(sh)} @ ${formatPortfolioUsdPerUnit(pr)}`);
      out.set(t.date, lines);
    }
    return [...out.entries()].map(([date, lines]) => ({ date, lines }));
  }, [tradeRows, splitAdjusted]);

  if (!portfolioDisplayReady) {
    return (
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-10">
        <div className="mx-auto max-w-md space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (selectedPortfolioId == null || !selectedPortfolio) {
    return (
      <Empty variant="card" className="min-h-[min(50vh,400px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Select a portfolio</EmptyTitle>
          <EmptyDescription>
            Choose a portfolio from the top bar to see whether you hold {assetDisplayName} and your position details.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!holding) {
    return (
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
      </Empty>
    );
  }

  const retUsd = holding.currentValue - holding.costBasis;
  const retPct = holding.costBasis > 0 ? ((holding.currentValue - holding.costBasis) / holding.costBasis) * 100 : 0;
  const weightPctRaw = allocationDenomUsd > 0 ? (holding.currentValue / allocationDenomUsd) * 100 : 0;
  const weightPct = Math.min(100, Math.max(0, weightPctRaw));

  const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, route, assetKind);
  const feesUsd = totalTradeFeesUsdForAsset(transactions, route, assetKind);
  const totalProfitUsd = retUsd + realizedUsd;
  const totalProfitPct = holding.costBasis > 0 ? (totalProfitUsd / holding.costBasis) * 100 : 0;

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

  const profitTone = (n: number) => (n >= 0 ? "text-[#16A34A]" : "text-[#DC2626]");

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <ChartControls activeRange={holdingsChartRange} onRangeChange={setHoldingsChartRange} />
        <div className="overflow-hidden rounded-[12px] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
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
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">My positions</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[12px] border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <h3 className="mb-4 text-[15px] font-semibold leading-5 text-[#09090B]">General</h3>
            <div>
              <div className="grid grid-cols-2 gap-4 border-b border-dotted border-[#E4E4E7] pb-4">
                <PositionStat label="Shares">{sharesLabel}</PositionStat>
                <PositionStat label="Current value">{usd0.format(holding.currentValue)}</PositionStat>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-dotted border-[#E4E4E7] py-4">
                <PositionStat label="Cost per share">{formatPortfolioUsdPerUnit(holding.avgPrice)}</PositionStat>
                <PositionStat label="Cost basis">{usd0.format(holding.costBasis)}</PositionStat>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <PositionStat label="Share in portfolio">{pct.format(weightPct)}%</PositionStat>
                <div aria-hidden className="hidden min-[480px]:block" />
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <h3 className="mb-4 text-[15px] font-semibold leading-5 text-[#09090B]">Return</h3>
            <div>
              <div className="grid grid-cols-2 gap-4 border-b border-dotted border-[#E4E4E7] pb-4">
                <PositionStat label="Total profit">
                  <span className={cn("font-semibold tabular-nums", profitTone(totalProfitUsd))}>
                    {formatSignedUsd(totalProfitUsd)} ({formatSignedPct(totalProfitPct)})
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
                  <span className={feesUsd > 0 ? "text-[#DC2626]" : "text-[#71717A]"}>
                    {feesUsd <= 0 ? usd0.format(0) : `-${usd0.format(feesUsd)}`}
                  </span>
                </PositionStat>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Transactions</h2>
          <button
            type="button"
            aria-label={`Add transaction for ${holding.name}`}
            disabled={selectedPortfolioReadOnly}
            onClick={() => openNewTransactionWithPreset({ symbol: route, name: holding.name })}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B]",
              "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {tradeRows.length === 0 ? (
          <p className="text-[14px] leading-6 text-[#71717A]">No trades recorded for this symbol in this portfolio.</p>
        ) : (
          <div className="w-full min-w-0">
            <div className="overflow-x-auto pb-4">
              <div className="min-w-[640px] divide-y divide-[#E4E4E7] border-t border-[#E4E4E7] rounded-[12px] overflow-hidden bg-white">
                <div
                  className={cn(
                    assetTxGrid,
                    "min-h-[44px] bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]",
                  )}
                >
                  <div className="text-left">Date</div>
                  <div className="text-left">Type</div>
                  <div className="text-right">Shares</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Amount</div>
                </div>

                {tradeRows.map((t) => {
                  const adj = splitAdjusted.get(t.id);
                  const sh = adj?.shares ?? t.shares;
                  const pr = adj?.price ?? t.price;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        assetTxGrid,
                        "h-[60px] max-h-[60px] bg-white px-4 transition-colors duration-75 hover:bg-neutral-50",
                      )}
                    >
                      <div className="text-left font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {format(parseISO(t.date), "MMM d, yyyy")}
                      </div>
                      <div
                        className={cn(
                          "min-w-0 truncate text-left text-[14px] font-medium leading-5 align-middle",
                          opColorClass(t.operation),
                        )}
                      >
                        {t.operation}
                      </div>
                      <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(sh)}
                      </div>
                      <div className="text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] align-middle">
                        {formatPortfolioUsdPerUnit(pr)}
                      </div>
                      <div
                        className={cn(
                          "text-right text-[14px] font-medium leading-5 tabular-nums align-middle",
                          sumColorClass(t.sum),
                        )}
                      >
                        {formatSignedUsd(t.sum)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
