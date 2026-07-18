"use client";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { formatChartingPeriodLabel } from "@/lib/market/charting-period-display";
import {
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  readChartingMetricValue,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  chartingTableCellTone,
  formatChartingTableCellDisplay,
} from "@/components/charting/charting-individual-company-table";
import {
  CHARTING_TABLE_STICKY_FIRST_COL_BODY_CLASS,
  CHARTING_TABLE_STICKY_FIRST_COL_HEAD_CLASS,
  chartingTableFirstColClass,
  type ChartingTableTimeRange,
} from "@/components/charting/charting-table-styles";
import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
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

/**
 * Multi-company charting table — fiscal periods as rows (newest first), series as columns.
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

  return (
    <div
      className={cn(
        "overflow-x-auto overscroll-x-contain pt-3 [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      <table className="w-full min-w-max border-separate border-spacing-0 bg-white">
        <thead>
          <tr className="bg-white">
            <th
              scope="col"
              className={cn(
                CHARTING_TABLE_STICKY_FIRST_COL_HEAD_CLASS,
                "border-t border-b border-[#E4E4E7] px-3 py-2.5 text-left align-middle text-[14px] font-medium leading-5 text-[#71717A]",
                firstColClass,
              )}
            >
              {periodHeaderLabel}
            </th>
            {seriesDefs.map((series) => (
              <th
                key={series.key}
                scope="col"
                className="min-w-[9rem] whitespace-nowrap border-t border-b border-[#E4E4E7] px-3 py-2.5 text-right align-middle text-[14px] font-medium leading-5 text-[#71717A]"
              >
                <div className="flex min-w-0 items-center justify-end gap-2 py-0.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: fundamentalsBarSolidAtIndex(series.colorIdx) }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">
                    {series.ticker} {CHARTING_METRIC_LABEL[series.metricId]}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodsNewestFirst.map((label) => (
            <tr
              key={label}
              className="group h-[52px] max-h-[52px] transition-colors duration-75 hover:bg-neutral-50"
            >
              <td
                className={cn(
                  CHARTING_TABLE_STICKY_FIRST_COL_BODY_CLASS,
                  "border-b border-[#E4E4E7] px-3 align-middle text-[14px] font-semibold leading-5 text-[#0F0F0F] group-hover:bg-white",
                  firstColClass,
                )}
              >
                {label}
              </td>
              {seriesDefs.map((series) => {
                const row = (orderedByTicker[series.ticker] ?? []).find(
                  (periodRow) =>
                    Boolean(periodRow.periodEnd) &&
                    formatChartingPeriodLabel(periodRow.periodEnd, periodMode) === label,
                );
                const v = row ? seriesRowValue(row, series.metricId) : null;
                const kind = CHARTING_METRIC_KIND[series.metricId];
                return (
                  <td
                    key={`${label}-${series.key}`}
                    className={cn(
                      "border-b border-[#E4E4E7] px-3 align-middle text-right text-[14px] font-normal leading-5 tabular-nums",
                      kind === "percent" ? "font-medium" : "",
                      chartingTableCellTone(series.metricId, v),
                    )}
                  >
                    {formatChartingTableCellDisplay(series.metricId, v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
