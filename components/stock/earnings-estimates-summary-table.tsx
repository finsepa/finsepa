"use client";

import { useMemo } from "react";

import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { STOCK_TABLE_LABEL_COL_WIDTH } from "@/components/stock/stock-income-statement-table";
import { buildFuturePeriodsTableRows } from "@/lib/market/earnings-annual-summary-model";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockEarningsEstimatesChart } from "@/lib/market/stock-earnings-types";
import { cn } from "@/lib/utils";

const FUTURE_GRID_CLASS = "grid min-w-[640px] items-center gap-x-2";
const FUTURE_GRID_STYLE = {
  gridTemplateColumns: `${STOCK_TABLE_LABEL_COL_WIDTH} minmax(6.5rem, 1fr) minmax(5.5rem, 0.85fr) minmax(5.5rem, 0.9fr) minmax(5.5rem, 0.85fr) minmax(6.5rem, 1fr)`,
} as const;

const headerLabelClass = cn(
  "min-w-0 text-left font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
  TABLE_START_ALIGNED_PAD_CLASS,
);

const headerNumClass = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const labelCellClass = cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS);

const numCellClass = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

function formatYoyPct(pct: number | null): { text: string; tone: "up" | "down" | "muted" } {
  if (pct == null || !Number.isFinite(pct)) return { text: "-", tone: "muted" };
  const text = `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
  if (pct > 0) return { text, tone: "up" };
  if (pct < 0) return { text, tone: "down" };
  return { text, tone: "muted" };
}

function YoyCell({ pct }: { pct: number | null }) {
  const { text, tone } = formatYoyPct(pct);
  return (
    <div
      className={cn(
        numCellClass,
        tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg-muted",
      )}
    >
      {text}
    </div>
  );
}

function FuturePeriodsHeader({ period }: { period: FundamentalsSeriesMode }) {
  return (
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
          className={cn(FUTURE_GRID_CLASS, "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted")}
          style={FUTURE_GRID_STYLE}
        >
          <div className={headerLabelClass}>{period === "annual" ? "Year" : "Quarter"}</div>
          <div className={headerNumClass}>EPS</div>
          <div className={headerNumClass}>YoY</div>
          <div className={headerNumClass}>Revenue</div>
          <div className={headerNumClass}>YoY</div>
          <div className={cn(headerNumClass, "whitespace-nowrap")}>Forward P/E</div>
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

/**
 * Future periods — upcoming years / quarters as rows:
 * EPS · YoY · Revenue · YoY · Forward P/E
 */
export function EarningsEstimatesSummaryTable({
  data,
  period,
  lastPrice = null,
}: {
  data: StockEarningsEstimatesChart;
  period: FundamentalsSeriesMode;
  /** Latest price for Forward P/E (price ÷ annualized EPS). */
  lastPrice?: number | null;
}) {
  const rows = useMemo(
    () => buildFuturePeriodsTableRows(data, period, lastPrice),
    [data, period, lastPrice],
  );

  if (rows.length === 0) return null;

  return (
    <div className="min-w-0 space-y-5">
      <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Future periods</h2>
      <ScreenerTableScroll mobileScroll minWidthClassName="min-w-[640px]">
        <div className="bg-surface">
          <FuturePeriodsHeader period={period} />
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            return (
              <div key={row.key} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      FUTURE_GRID_CLASS,
                      "min-h-[60px] text-[14px] font-normal leading-5",
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                    style={FUTURE_GRID_STYLE}
                  >
                    <div className={labelCellClass}>
                      <div className="truncate font-semibold leading-5 text-fg">{row.periodLabel}</div>
                    </div>
                    <div className={numCellClass}>{row.epsDisplay}</div>
                    <YoyCell pct={row.epsYoyPct} />
                    <div className={numCellClass}>{row.revenueDisplay}</div>
                    <YoyCell pct={row.revenueYoyPct} />
                    <div className={numCellClass}>{row.forwardPeDisplay}</div>
                  </div>
                </div>
                {!isLast ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
              </div>
            );
          })}
        </div>
      </ScreenerTableScroll>
    </div>
  );
}
