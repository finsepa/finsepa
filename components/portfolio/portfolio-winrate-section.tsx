"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartSpline } from "@/lib/icons";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { CompanyLogo } from "@/components/screener/company-logo";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
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
import { CHART_BASELINE_COLOR } from "@/lib/chart/dashed-price-line-primitive";
import { CHART_PLOT_BACKGROUND_CLASS } from "@/lib/chart/fundamentals-chart-surface";
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

/** Asset + Profit/Loss — same rhythm as holdings / dividends tables. */
const WINRATE_GRID =
  "grid w-full min-w-0 grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] items-center gap-x-2";

const HOLDING_COMPANY_NAME_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline";

const GAIN = "#22C55E";
const LOSS = "#EF4444";
const MIN_LABEL_W = 40;
const COL_PLOT_H = 180;
const COL_BAR_W = 48;
const COL_AXIS_H = 44;
/** Match asset / portfolio charts — faint solid y-gridlines. */
const Y_AXIS_GRIDLINE_BORDER = "color-mix(in srgb, var(--fs-stroke) 60%, transparent)";
const GRIDLINE_COUNT = 4;

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

/** iOS `PortfolioWinrateColumnsChart` — count bars with regular plot chrome (dots + gridlines). */
function WinrateColumnsChart({ stats }: { stats: PortfolioWinrateStats }) {
  const maxCount = Math.max(stats.winners.length, stats.losers.length, 1);
  const columns = [
    { title: "Winners", count: stats.winners.length, usd: stats.winnersUsd, color: GAIN },
    { title: "Losers", count: stats.losers.length, usd: stats.losersUsd, color: LOSS },
  ] as const;

  return (
    <div className="w-full min-w-0" role="img" aria-label="Winners and losers by closed position count">
      <div className="relative w-full overflow-hidden" style={{ height: COL_PLOT_H }}>
        <div className={cn("pointer-events-none absolute inset-0 z-0", CHART_PLOT_BACKGROUND_CLASS)} aria-hidden />
        <div
          className={cn("pointer-events-none absolute inset-0 z-[1]", CHART_PLOT_DOTS_PATTERN_CLASS)}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          {Array.from({ length: GRIDLINE_COUNT }, (_, i) => {
            const topPct = (i / (GRIDLINE_COUNT - 1)) * 100;
            const isBaseline = i === GRIDLINE_COUNT - 1;
            return (
              <div
                key={i}
                className="absolute inset-x-0 border-t"
                style={{
                  top: `${topPct}%`,
                  borderColor: isBaseline ? CHART_BASELINE_COLOR : Y_AXIS_GRIDLINE_BORDER,
                }}
              />
            );
          })}
        </div>

        <div className="relative z-[2] mx-auto flex h-full w-full max-w-md items-end justify-center gap-16 px-6 pb-0">
          {columns.map((col) => {
            const fraction = col.count / maxCount;
            const barHeight = Math.max((COL_PLOT_H - 28) * fraction, col.count > 0 ? 6 : 2);
            return (
              <div key={col.title} className="flex h-full w-[72px] flex-col items-center justify-end">
                <div className="mb-1.5 text-sm font-medium tabular-nums text-fg">{col.count}</div>
                <div
                  className={cn(
                    "rounded-t-[6px] rounded-b-none",
                    col.count === 0 && "bg-surface-muted dark:bg-surface/40",
                  )}
                  style={{
                    width: COL_BAR_W,
                    height: barHeight,
                    ...(col.count > 0 ? { backgroundColor: col.color } : {}),
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="mx-auto flex w-full max-w-md items-start justify-center gap-16 px-6 pt-2"
        style={{ minHeight: COL_AXIS_H }}
      >
        {columns.map((col) => (
          <div key={col.title} className="flex w-[72px] flex-col items-center gap-0.5 text-center">
            <div className="text-[13px] font-medium text-fg">{col.title}</div>
            <div
              className={cn(
                "text-[12px] tabular-nums",
                col.count > 0 ? (col.usd >= 0 ? "text-up" : "text-down") : "text-fg-muted",
              )}
            >
              {formatSignedUsd(col.usd)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PositionRow({
  position,
  displayName,
  showDivider,
}: {
  position: PortfolioWinratePosition;
  displayName: string;
  showDivider: boolean;
}) {
  const color = position.realizedUsd >= 0 ? "text-up" : "text-down";
  const logo = displayLogoUrlForPortfolioSymbol(position.symbol) || position.logoUrl || "";

  const cells = (
    <div
      className={cn(
        WINRATE_GRID,
        "relative min-h-[52px] py-2.5 text-[14px] leading-5",
        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
        <CompanyLogo name={displayName} logoUrl={logo} symbol={position.symbol} />
        <div className="min-w-0">
          <div className={HOLDING_COMPANY_NAME_CLASS}>{position.symbol}</div>
          <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">{displayName}</div>
        </div>
      </div>
      <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
        <div className={cn("font-['Inter'] text-[14px] font-semibold tabular-nums", color)}>
          {formatSignedUsd(position.realizedUsd)}
        </div>
        {position.realizedPercent != null ? (
          <div className={cn("mt-0.5 text-[12px] font-medium tabular-nums", color)}>
            {formatSignedPct(position.realizedPercent)}
          </div>
        ) : null}
      </div>
      {position.assetHref ? (
        <Link
          href={position.assetHref}
          className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2"
          aria-label={`Open ${displayName}`}
        />
      ) : null}
    </div>
  );

  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>{cells}</div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
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
      <div
        className={cn(
          OVERVIEW_SECTION_TITLE_GAP_CLASS,
          "flex items-center justify-between gap-3",
        )}
      >
        <h2 className={cn("min-w-0 shrink", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>Winrate</h2>
        {!stats.isEmpty ? (
          <SegmentedControl
            size="sm"
            value={side}
            onChange={setSide}
            aria-label="Winrate side"
            options={[
              { value: "winners", label: "Winners" },
              { value: "losers", label: "Losers" },
            ]}
          />
        ) : null}
      </div>

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
            <WinrateSplitBar stats={stats} />
            <WinrateColumnsChart stats={stats} />

            {rows.length === 0 ? (
              <p className="rounded-2xl border border-stroke bg-panel px-4 py-8 text-center text-sm text-fg-muted dark:border-stroke-shell">
                {side === "winners"
                  ? "No positions closed in profit."
                  : "No positions closed at a loss."}
              </p>
            ) : (
              <ScreenerTableScroll className="sm:pb-2">
                <div className="bg-surface">
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
                          WINRATE_GRID,
                          "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                        )}
                      >
                        <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Asset</div>
                        <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                          {side === "winners" ? "Profit" : "Loss"}
                        </div>
                      </div>
                    </div>
                    <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                  </div>

                  {rows.map((p, i) => {
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
                        showDivider={i < rows.length - 1}
                      />
                    );
                  })}
                </div>
              </ScreenerTableScroll>
            )}
          </>
        )}
      </div>
    </section>
  );
}
