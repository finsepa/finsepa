"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartSpline } from "@/lib/icons";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
  OVERVIEW_SECTION_TITLE_GAP_CLASS,
} from "@/components/design-system/card-surface-styles";
import {
  buildPortfolioWinrateStats,
  formatWinratePercentLabel,
  type PortfolioWinratePosition,
  type PortfolioWinrateStats,
} from "@/lib/portfolio/portfolio-winrate";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import {
  portfolioHoldingDisplayName,
  usePortfolioHoldingDisplayNames,
} from "@/lib/portfolio/use-portfolio-holding-display-names";
import { cn } from "@/lib/utils";

const GAIN = "#22C55E";
const LOSS = "#EF4444";
const MIN_LABEL_W = 40;
const COL_PLOT_H = 160;
const COL_BAR_W = 56;

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSignedUsd(n: number): string {
  const s = usd2.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct2.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function nounCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** iOS `PortfolioWinrateBar` — split winners / losers by share. */
function WinrateSplitBar({ stats }: { stats: PortfolioWinrateStats }) {
  if (stats.isEmpty) {
    return (
      <div className="flex h-7 items-center justify-center rounded-lg bg-surface-muted text-[12px] text-fg-muted dark:bg-surface/50">
        No closed positions yet
      </div>
    );
  }

  const winPct = stats.winShare * 100;
  const losePct = (1 - stats.winShare) * 100;
  const both = stats.winners.length > 0 && stats.losers.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-7 w-full gap-0.5 overflow-hidden"
        role="img"
        aria-label={`${formatWinratePercentLabel(stats.winShare)} winners, ${formatWinratePercentLabel(1 - stats.winShare)} losers`}
      >
        {stats.winners.length > 0 ? (
          <div
            className="relative flex h-full min-w-0 items-center justify-center overflow-hidden rounded-lg"
            style={{
              backgroundColor: GAIN,
              flexGrow: Math.max(winPct, 0.01),
              flexBasis: 0,
            }}
          >
            {winPct >= (MIN_LABEL_W / 3) ? (
              <span className="px-1 text-[12px] font-medium tabular-nums text-white">
                {formatWinratePercentLabel(stats.winShare)}
              </span>
            ) : null}
          </div>
        ) : null}
        {stats.losers.length > 0 ? (
          <div
            className={cn(
              "relative flex h-full min-w-0 items-center justify-center overflow-hidden rounded-lg",
              !both && "rounded-lg",
            )}
            style={{
              backgroundColor: LOSS,
              flexGrow: Math.max(losePct, 0.01),
              flexBasis: 0,
            }}
          >
            {losePct >= (MIN_LABEL_W / 3) ? (
              <span className="px-1 text-[12px] font-medium tabular-nums text-white">
                {formatWinratePercentLabel(1 - stats.winShare)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GAIN }} aria-hidden />
          <span className="tabular-nums">{nounCount(stats.winners.length, "winner")}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LOSS }} aria-hidden />
          <span className="tabular-nums">{nounCount(stats.losers.length, "loser")}</span>
        </div>
      </div>
    </div>
  );
}

/** iOS `PortfolioWinrateColumnsChart` — count bars with realized $ under each. */
function WinrateColumnsChart({ stats }: { stats: PortfolioWinrateStats }) {
  const maxCount = Math.max(stats.winners.count, stats.losers.count, 1);

  const column = (title: string, count: number, usd: number, color: string) => {
    const fraction = count / maxCount;
    const barHeight = Math.max(COL_PLOT_H * fraction, count > 0 ? 6 : 2);
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
        <div className="text-sm font-medium tabular-nums text-fg">{count}</div>
        <div className="flex w-full flex-col justify-end" style={{ height: COL_PLOT_H }}>
          <div
            className={cn(
              "mx-auto rounded-[10px]",
              count === 0 && "bg-surface-muted dark:bg-surface/50",
            )}
            style={{
              width: COL_BAR_W,
              height: barHeight,
              ...(count > 0 ? { backgroundColor: color } : {}),
            }}
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <div className="text-[13px] font-medium text-fg">{title}</div>
          <div
            className={cn(
              "text-[12px] tabular-nums",
              count > 0 ? (usd >= 0 ? "text-up" : "text-down") : "text-fg-muted",
            )}
          >
            {formatSignedUsd(usd)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full items-end justify-center gap-6 rounded-2xl border border-stroke bg-panel px-4 py-4 dark:border-stroke-shell">
      {column("Winners", stats.winners.length, stats.winnersUsd, GAIN)}
      {column("Losers", stats.losers.length, stats.losersUsd, LOSS)}
    </div>
  );
}

function PositionRow({
  position,
  displayName,
}: {
  position: PortfolioWinratePosition;
  displayName: string;
}) {
  const color = position.realizedUsd >= 0 ? "text-up" : "text-down";
  const logo = displayLogoUrlForPortfolioSymbol(position.symbol) || position.logoUrl || "";
  const inner = (
    <div className="flex items-center gap-3 px-3 py-3">
      <CompanyLogo name={displayName} logoUrl={logo} symbol={position.symbol} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">{position.symbol}</div>
        <div className="truncate text-[13px] text-fg-muted">{displayName}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("text-sm font-medium tabular-nums", color)}>
          {formatSignedUsd(position.realizedUsd)}
        </div>
        {position.realizedPercent != null ? (
          <div className={cn("text-[13px] tabular-nums", color)}>
            {formatSignedPct(position.realizedPercent)}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (position.assetHref) {
    return (
      <Link
        href={position.assetHref}
        className="block rounded-xl transition-colors hover:bg-surface-muted/60 dark:hover:bg-surface/40"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

export function PortfolioWinrateSection({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const [side, setSide] = useState<"winners" | "losers">("winners");
  const stats = useMemo(
    () => buildPortfolioWinrateStats(holdings, transactions),
    [holdings, transactions],
  );

  const nameSource = useMemo(
    () =>
      [...stats.winners, ...stats.losers].map(
        (p): PortfolioHolding => ({
          id: p.id,
          symbol: p.symbol,
          name: p.name,
          logoUrl: p.logoUrl,
          shares: 0,
          avgPrice: 0,
          costBasis: 0,
          marketPrice: 0,
          currentValue: 0,
        }),
      ),
    [stats.winners, stats.losers],
  );
  const resolvedNames = usePortfolioHoldingDisplayNames(nameSource);

  const rows = side === "winners" ? stats.winners : stats.losers;

  return (
    <section className="w-full min-w-0">
      <h2 className={cn(OVERVIEW_SECTION_TITLE_GAP_CLASS, STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>
        Winrate
      </h2>

      <div className="flex flex-col gap-4">
        <div>
          <div
            className={cn(
              "text-3xl font-semibold tabular-nums tracking-tight",
              stats.isEmpty
                ? "text-fg-muted"
                : stats.winShare >= 0.5
                  ? "text-up"
                  : "text-down",
            )}
          >
            {stats.isEmpty ? "—" : formatWinratePercentLabel(stats.winShare)}
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {stats.isEmpty
              ? "Close positions to see your winrate"
              : `${stats.winners.length} of ${stats.total} closed positions in profit`}
          </p>
        </div>

        <WinrateSplitBar stats={stats} />

        {stats.isEmpty ? (
          <Empty variant="card" className="min-h-[180px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartSpline className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No closed positions yet</EmptyTitle>
              <EmptyDescription>
                Fully sell a holding to track winners and losers here. Same math as iOS Insights.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <WinrateColumnsChart stats={stats} />

            <SegmentedControl
              fullWidth
              value={side}
              onValueChange={(v) => setSide(v as "winners" | "losers")}
              options={[
                { value: "winners", label: "Winners" },
                { value: "losers", label: "Losers" },
              ]}
            />

            <div className="overflow-hidden rounded-2xl border border-stroke bg-panel dark:border-stroke-shell">
              <div className="flex items-center justify-between px-3 py-3 text-[12px] font-medium text-fg-muted">
                <span>Asset</span>
                <span>{side === "winners" ? "Profit" : "Loss"}</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-fg-muted">
                  {side === "winners"
                    ? "No positions closed in profit."
                    : "No positions closed at a loss."}
                </p>
              ) : (
                <div className="pb-1">
                  {rows.map((p) => {
                    const stub: PortfolioHolding = {
                      id: p.id,
                      symbol: p.symbol,
                      name: p.name,
                      logoUrl: p.logoUrl,
                      shares: 0,
                      avgPrice: 0,
                      costBasis: 0,
                      marketPrice: 0,
                      currentValue: 0,
                    };
                    return (
                      <PositionRow
                        key={p.id}
                        position={p}
                        displayName={portfolioHoldingDisplayName(stub, resolvedNames)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
