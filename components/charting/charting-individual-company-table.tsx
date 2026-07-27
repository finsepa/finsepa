"use client";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { formatChartingPeriodLabel } from "@/lib/market/charting-period-display";
import {
  formatPercentMetric,
  formatRatio,
  formatSharesOutstanding,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import {
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  isChartingSignedPercentMetric,
  readChartingMetricValue,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import { ChartingDataTableSettingsMenu } from "@/components/charting/charting-data-table-settings-menu";
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
import {
  chartingTableFirstColClass,
  type ChartingTableTimeRange,
} from "@/components/charting/charting-table-styles";

function chartingRowValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  return readChartingMetricValue(row, id);
}

export function formatChartingTableCell(kind: ChartingMetricKind, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (kind) {
    case "usd":
      return formatUsdCompact(v);
    case "eps":
      return formatUsdPrice(v);
    case "shares":
      return formatSharesOutstanding(v);
    case "percent":
      return formatPercentMetric(v);
    case "multiple":
    case "ratio":
      return formatRatio(v);
    default:
      return formatUsdCompact(v);
  }
}

export function formatChartingTableCellDisplay(id: ChartingMetricId, v: number | null): string {
  const kind = CHARTING_METRIC_KIND[id];
  const text = formatChartingTableCell(kind, v);
  if (text === "—" || kind !== "percent" || v == null || !isChartingSignedPercentMetric(id)) return text;
  if (v > 0 && !text.startsWith("+")) return `+${text}`;
  return text;
}

/** Bar labels — same compact formatting as the data table (e.g. $94.83B). */
export function formatBarChartDataLabel(id: ChartingMetricId, v: number): string {
  if (!Number.isFinite(v)) return "";
  return formatChartingTableCellDisplay(id, v);
}

export function chartingTableCellTone(id: ChartingMetricId, v: number | null): string {
  if (
    CHARTING_METRIC_KIND[id] !== "percent" ||
    !isChartingSignedPercentMetric(id) ||
    v == null ||
    !Number.isFinite(v)
  ) {
    return "text-[#141414]";
  }
  if (v > 0) return "text-[#16A34A]";
  if (v < 0) return "text-[#DC2626]";
  return "text-[#5C5D5F]";
}

function metricRowLabel(ticker: string | undefined, id: ChartingMetricId): string {
  const sym = ticker?.trim().toUpperCase();
  const name = CHARTING_METRIC_LABEL[id];
  return sym ? `${sym} ${name}` : name;
}

function metricColor(
  id: ChartingMetricId,
  metricIndex: number,
  metricColors?: Map<ChartingMetricId, string>,
): string {
  return metricColors?.get(id) ?? fundamentalsBarSolidAtIndex(metricIndex);
}

/** Screener-style track: period + equal metric columns (fills card width). */
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

type Props = {
  ordered: ChartingSeriesPoint[];
  selected: ChartingMetricId[];
  periodMode: "annual" | "quarterly";
  timeRange?: ChartingTableTimeRange;
  ticker?: string;
  metricColors?: Map<ChartingMetricId, string>;
  isBarValuesVisible?: (id: ChartingMetricId) => boolean;
  onShowBarValuesChange?: (id: ChartingMetricId, next: boolean) => void;
  hideMetricSettings?: boolean;
  className?: string;
};

/**
 * Single-company charting table — same chrome as Stocks Companies screener.
 */
export function ChartingIndividualCompanyTable({
  ordered,
  selected,
  periodMode,
  timeRange,
  ticker,
  metricColors,
  isBarValuesVisible,
  onShowBarValuesChange,
  hideMetricSettings = false,
  className,
}: Props) {
  if (!ordered.length || !selected.length) return null;

  const firstColClass = chartingTableFirstColClass(timeRange);
  const periodHeaderLabel = periodMode === "quarterly" ? "Period" : "Year";
  const periodsNewestFirst = [...ordered].reverse();
  const grid = chartingScreenerGridStyle(selected.length, firstColClass);
  const tableMinWidthPx = 280 + selected.length * 96;

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
                "min-h-[44px] text-[14px] font-medium leading-5 text-[#5C5D5F]",
              )}
              style={grid.style}
            >
              <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>{periodHeaderLabel}</div>
              {selected.map((id, metricIndex) => {
                const color = metricColor(id, metricIndex, metricColors);
                return (
                  <div
                    key={id}
                    className={cn("min-w-0 w-full truncate text-right", TABLE_END_ALIGNED_PAD_CLASS)}
                  >
                    <div className="inline-flex max-w-full items-center justify-end gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{metricRowLabel(ticker, id)}</span>
                      {onShowBarValuesChange && isBarValuesVisible && !hideMetricSettings ? (
                        <ChartingDataTableSettingsMenu
                          showBarValues={isBarValuesVisible(id)}
                          onShowBarValuesChange={(next) => onShowBarValuesChange(id, next)}
                          metricLabel={CHARTING_METRIC_LABEL[id]}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        {periodsNewestFirst.map((periodRow, rowIdx) => (
          <div key={periodRow.periodEnd} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  grid.className,
                  "min-h-[60px] text-[14px] font-normal leading-5",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
                style={grid.style}
              >
                <div className={cn("text-left font-medium text-[#141414]", TABLE_START_ALIGNED_PAD_CLASS)}>
                  {formatChartingPeriodLabel(periodRow.periodEnd, periodMode)}
                </div>
                {selected.map((id) => {
                  const v = chartingRowValue(periodRow, id);
                  return (
                    <div
                      key={`${periodRow.periodEnd}-${id}`}
                      className={cn(
                        "min-w-0 w-full text-right font-['Inter'] tabular-nums",
                        TABLE_END_ALIGNED_PAD_CLASS,
                        chartingTableCellTone(id, v),
                      )}
                    >
                      {formatChartingTableCellDisplay(id, v)}
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
