"use client";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { formatChartingPeriodLabel } from "@/lib/market/charting-period-display";
import {
  CHARTING_METRIC_LABEL,
  readChartingMetricValue,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  chartingTableCellTone,
  formatChartingTableCellDisplay,
} from "@/components/charting/charting-individual-company-table";
import {
  chartingTableFirstColClass,
  type ChartingTableTimeRange,
} from "@/components/charting/charting-table-styles";
import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

export type ChartingCompareSeriesDef = {
  key: string;
  ticker: string;
  metricId: ChartingMetricId;
  colorIdx: number;
};

type Props = {
  tableColumnLabels: string[];
  seriesDefs: ChartingCompareSeriesDef[];
  orderedByTicker: Record<string, ChartingSeriesPoint[]>;
  periodMode: "annual" | "quarterly";
  timeRange?: ChartingTableTimeRange;
  className?: string;
};

function seriesRowValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  return readChartingMetricValue(row, id);
}

function chartingScreenerGridStyle(metricCount: number, firstColClass: string): {
  className: string;
  style: { gridTemplateColumns: string };
} {
  const periodTrack = firstColClass.includes("11rem") ? "minmax(11rem,1.25fr)" : "minmax(10rem,1.1fr)";
  const metricTracks = Array.from({ length: metricCount }, () => "minmax(5.5rem,1fr)").join(" ");
  return {
    className: "grid w-full min-w-0 items-center gap-x-2",
    style: { gridTemplateColumns: `${periodTrack} ${metricTracks}` },
  };
}

/**
 * Multi-company charting table — same chrome as Stocks Companies screener.
 */
export function ChartingCompareCompanyTable({
  tableColumnLabels,
  seriesDefs,
  orderedByTicker,
  periodMode,
  timeRange,
  className,
}: Props) {
  if (!tableColumnLabels.length || !seriesDefs.length) return null;

  const firstColClass = chartingTableFirstColClass(timeRange);
  const periodHeaderLabel = periodMode === "quarterly" ? "Period" : "Year";
  const periodsNewestFirst = [...tableColumnLabels].reverse();
  const grid = chartingScreenerGridStyle(seriesDefs.length, firstColClass);
  const tableMinWidthPx = 280 + seriesDefs.length * 96;

  return (
    <div className={cn(className)}>
      <ScreenerTableScroll mobileScroll tableMinWidthPx={tableMinWidthPx}>
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
                grid.className,
                "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
              )}
              style={grid.style}
            >
              <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>{periodHeaderLabel}</div>
              {seriesDefs.map((series) => (
                <div
                  key={series.key}
                  className={cn("min-w-0 w-full truncate text-right", TABLE_END_ALIGNED_PAD_CLASS)}
                >
                  <div className="inline-flex max-w-full items-center justify-end gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: fundamentalsBarSolidAtIndex(series.colorIdx) }}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">
                      {series.ticker} {CHARTING_METRIC_LABEL[series.metricId]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        {periodsNewestFirst.map((label, rowIdx) => (
          <div key={label} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  grid.className,
                  "min-h-[60px] text-[14px] font-normal leading-5",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
                style={grid.style}
              >
                <div className={cn("text-left font-medium text-fg", TABLE_START_ALIGNED_PAD_CLASS)}>
                  {label}
                </div>
                {seriesDefs.map((series) => {
                  const row = (orderedByTicker[series.ticker] ?? []).find(
                    (periodRow) =>
                      Boolean(periodRow.periodEnd) &&
                      formatChartingPeriodLabel(periodRow.periodEnd, periodMode) === label,
                  );
                  const v = row ? seriesRowValue(row, series.metricId) : null;
                  return (
                    <div
                      key={`${label}-${series.key}`}
                      className={cn(
                        "min-w-0 w-full text-right font-['Inter'] tabular-nums",
                        TABLE_END_ALIGNED_PAD_CLASS,
                        chartingTableCellTone(series.metricId, v),
                      )}
                    >
                      {formatChartingTableCellDisplay(series.metricId, v)}
                    </div>
                  );
                })}
              </div>
            </div>
            {rowIdx < periodsNewestFirst.length - 1 ? (
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            ) : null}
          </div>
        ))}
      </ScreenerTableScroll>
    </div>
  );
}
