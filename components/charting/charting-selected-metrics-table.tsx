"use client";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { formatChartingPeriodLabel } from "@/lib/market/charting-period-display";
import {
  CHARTING_METRIC_LABEL,
  readChartingMetricValue,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import { ChartingDataTableSettingsMenu } from "@/components/charting/charting-data-table-settings-menu";
import {
  chartingTableCellTone,
  formatChartingTableCellDisplay,
} from "@/components/charting/charting-individual-company-table";
import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import {
  stockTableGridTemplateColumns,
  stockTableScrollMinWidthPx,
} from "@/components/stock/stock-income-statement-table";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STICKY_LABEL_RULE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { cn } from "@/lib/utils";

type Props = {
  ordered: ChartingSeriesPoint[];
  selected: ChartingMetricId[];
  periodMode: "annual" | "quarterly";
  metricColors?: Map<ChartingMetricId, string>;
  isBarValuesVisible?: (id: ChartingMetricId) => boolean;
  onShowBarValuesChange?: (id: ChartingMetricId, next: boolean) => void;
  onRemoveMetric?: (id: ChartingMetricId) => void;
  /** When true, keep at least one metric (disable last uncheck). */
  removeDisabledWhenOne?: boolean;
  className?: string;
};

/** Sticky label — same hover wash as {@link StockIncomeStatementTable}. */
const stickyLabelBodyClass = cn(
  "sticky left-0 z-20 flex min-h-full min-w-0 items-center self-stretch bg-surface pr-4 text-left md:rounded-l-[10px] group-hover/row:bg-table-row-hover",
  SCREENER_TABLE_STICKY_LABEL_RULE_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
);

/**
 * Selected chart series as table rows (Financials embed) — checkbox (series color) + name + settings,
 * then period value columns (newest first). Replaces legend badges.
 */
export function ChartingSelectedMetricsTable({
  ordered,
  selected,
  periodMode,
  metricColors,
  isBarValuesVisible,
  onShowBarValuesChange,
  onRemoveMetric,
  removeDisabledWhenOne = true,
  className,
}: Props) {
  if (!ordered.length || !selected.length) return null;

  // Same chronological order as the chart: oldest left → newest (TTM) right.
  const periods = ordered;
  const dataColumnCount = periods.length;
  const gridTemplateColumns = stockTableGridTemplateColumns(dataColumnCount);
  const periodHeaderLabel = periodMode === "quarterly" ? "Period" : "Fiscal Year";

  return (
    <div className={cn(className)}>
      <ScreenerTableScroll
        mobileScroll
        scrollAlignEnd
        scrollAlignKey={`${periodMode}:${periods.map((p) => p.periodEnd).join("|")}`}
        tableMinWidthPx={stockTableScrollMinWidthPx(dataColumnCount)}
      >
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "border-b-0 md:border-b-0",
          )}
        >
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS}>
            <div
              className="grid min-h-[44px] items-stretch gap-x-2 bg-surface py-0 pr-0"
              style={{ gridTemplateColumns }}
            >
              <div
                className={cn(
                  "sticky left-0 z-40 flex min-h-full min-w-0 items-center self-stretch bg-surface pr-4 text-left font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
                  SCREENER_TABLE_STICKY_LABEL_RULE_CLASS,
                  TABLE_START_ALIGNED_PAD_CLASS,
                )}
              >
                Selected
              </div>
              {periods.map((p) => (
                <div
                  key={`sel-h-${p.periodEnd}`}
                  className={cn(
                    "relative z-[1] flex min-h-full min-w-0 items-center justify-end self-stretch bg-surface text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg-muted",
                    TABLE_END_ALIGNED_PAD_CLASS,
                  )}
                >
                  {formatChartingPeriodLabel(p.periodEnd, periodMode)}
                </div>
              ))}
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        <div className="relative z-0 bg-surface">
          {selected.map((id, metricIndex) => {
            const color =
              metricColors?.get(id) ?? fundamentalsBarSolidAtIndex(metricIndex);
            const label = CHARTING_METRIC_LABEL[id];
            const removeDisabled = removeDisabledWhenOne && selected.length <= 1;

            return (
              <div key={id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                <div className={SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS}>
                  <div
                    className={cn(
                      "relative z-0 grid min-h-[60px] w-full items-stretch gap-x-2 border-0 bg-transparent py-0 pr-0",
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                    style={{ gridTemplateColumns }}
                  >
                    <div className={cn(stickyLabelBodyClass, "gap-2.5")}>
                      {onRemoveMetric ? (
                        <AppCheckbox
                          checked
                          checkedColor={color}
                          disabled={removeDisabled}
                          onChange={() => onRemoveMetric(id)}
                          aria-label={`Deselect ${label}`}
                        />
                      ) : null}
                      <span className="min-w-0 truncate text-[14px] font-semibold leading-5 text-fg">
                        {label}
                      </span>
                      {onShowBarValuesChange && isBarValuesVisible ? (
                        <ChartingDataTableSettingsMenu
                          variant="ghost"
                          showBarValues={isBarValuesVisible(id)}
                          onShowBarValuesChange={(next) => onShowBarValuesChange(id, next)}
                          metricLabel={label}
                        />
                      ) : null}
                    </div>
                    {periods.map((periodRow) => {
                      const v = readChartingMetricValue(periodRow, id);
                      return (
                        <div
                          key={`${id}-${periodRow.periodEnd}`}
                          className={cn(
                            "flex min-h-full min-w-0 w-full items-center justify-end self-stretch text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums",
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
                <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
              </div>
            );
          })}
        </div>
      </ScreenerTableScroll>
      <span className="sr-only">{periodHeaderLabel}</span>
    </div>
  );
}
