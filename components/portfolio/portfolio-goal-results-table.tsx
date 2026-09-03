"use client";

import type { PortfolioGoalYearRow } from "@/lib/portfolio/portfolio-goal-projections";
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
import { Confetti } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

/** Year + Aggressive / Normal / Safe value columns. */
const GOAL_RESULTS_GRID =
  "grid min-w-[680px] grid-cols-[minmax(88px,auto)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] items-center gap-x-2";

const GOAL_INCOME_GRID =
  "grid min-w-[420px] grid-cols-[minmax(88px,auto)_minmax(160px,1fr)] items-center gap-x-2";

const GOAL_RESULTS_GRID_STYLE = {
  gridTemplateColumns:
    "minmax(88px, auto) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr)",
} satisfies CSSProperties;

const GOAL_INCOME_GRID_STYLE = {
  gridTemplateColumns: "minmax(88px, auto) minmax(160px, 1fr)",
} satisfies CSSProperties;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function GoalResultsGridRow({
  className,
  children,
  incomeOnly,
}: {
  className?: string;
  children: ReactNode;
  incomeOnly?: boolean;
}) {
  return (
    <div
      className={cn(incomeOnly ? GOAL_INCOME_GRID : GOAL_RESULTS_GRID, className)}
      style={incomeOnly ? GOAL_INCOME_GRID_STYLE : GOAL_RESULTS_GRID_STYLE}
    >
      {children}
    </div>
  );
}

function firstRowIndexReachingTarget(
  rows: readonly PortfolioGoalYearRow[],
  pick: (row: PortfolioGoalYearRow) => number,
  target: number,
): number | null {
  if (!(target > 0) || rows.length === 0) return null;
  let sawBelow = false;
  for (let i = 0; i < rows.length; i += 1) {
    const v = pick(rows[i]!);
    if (!Number.isFinite(v)) continue;
    if (v < target) {
      sawBelow = true;
      continue;
    }
    return sawBelow ? i : null;
  }
  return null;
}

const AGGRESSIVE_HIT_COLOR = "#EA580C";
const NORMAL_HIT_COLOR = "var(--fs-accent)";
const SAFE_HIT_COLOR = "#9333EA";

function ValueCell({
  value,
  showGoalHit,
  hitColor,
}: {
  value: number;
  showGoalHit?: boolean;
  hitColor: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 tabular-nums",
        showGoalHit ? "font-medium" : "font-normal text-fg",
        TABLE_END_ALIGNED_PAD_CLASS,
      )}
      style={showGoalHit ? { color: hitColor } : undefined}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {showGoalHit ? (
          <span className="inline-flex shrink-0" title="Reached goal">
            <Confetti className="size-3.5" strokeWidth={1.75} />
            <span className="sr-only">Reached goal</span>
          </span>
        ) : null}
        {usd.format(value)}
      </span>
    </div>
  );
}

export function PortfolioGoalResultsTable({
  rows,
  targetUsd,
  mode = "value",
}: {
  rows: readonly PortfolioGoalYearRow[];
  targetUsd: number;
  mode?: "value" | "passive_income";
}) {
  const incomeOnly = mode === "passive_income";
  const aggressiveHit = incomeOnly
    ? null
    : firstRowIndexReachingTarget(rows, (r) => r.aggressiveValue, targetUsd);
  const normalHit = firstRowIndexReachingTarget(rows, (r) => r.portfolioValue, targetUsd);
  const safeHit = incomeOnly
    ? null
    : firstRowIndexReachingTarget(rows, (r) => r.safeValue, targetUsd);

  return (
    <ScreenerTableScroll
      className="sm:pb-6"
      mobileScroll
      minWidthClassName={incomeOnly ? "min-w-[420px]" : "min-w-[680px]"}
    >
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
            <GoalResultsGridRow
              incomeOnly={incomeOnly}
              className="min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted"
            >
              <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Year</div>
              {incomeOnly ? (
                <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                  Passive income
                </div>
              ) : (
                <>
                  <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                    Aggressive
                  </div>
                  <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                    Normal
                  </div>
                  <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                    Safe
                  </div>
                </>
              )}
            </GoalResultsGridRow>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        {rows.map((row, i) => (
          <div key={row.label} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
              <GoalResultsGridRow
                incomeOnly={incomeOnly}
                className={cn(
                  "min-h-[44px] text-[14px] font-normal leading-5",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
              >
                <div
                  className={cn(
                    "min-w-0 truncate whitespace-nowrap text-left font-medium text-fg",
                    TABLE_START_ALIGNED_PAD_CLASS,
                  )}
                >
                  {row.label}
                </div>
                {incomeOnly ? (
                  <ValueCell
                    value={row.portfolioValue}
                    showGoalHit={i === normalHit}
                    hitColor={NORMAL_HIT_COLOR}
                  />
                ) : (
                  <>
                    <ValueCell
                      value={row.aggressiveValue}
                      showGoalHit={i === aggressiveHit}
                      hitColor={AGGRESSIVE_HIT_COLOR}
                    />
                    <ValueCell
                      value={row.portfolioValue}
                      showGoalHit={i === normalHit}
                      hitColor={NORMAL_HIT_COLOR}
                    />
                    <ValueCell
                      value={row.safeValue}
                      showGoalHit={i === safeHit}
                      hitColor={SAFE_HIT_COLOR}
                    />
                  </>
                )}
              </GoalResultsGridRow>
            </div>
            {i < rows.length - 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
          </div>
        ))}
      </div>
    </ScreenerTableScroll>
  );
}
