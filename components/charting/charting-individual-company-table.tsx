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
import { cn } from "@/lib/utils";

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
    return "text-[#0F0F0F]";
  }
  if (v > 0) return "text-[#16A34A]";
  if (v < 0) return "text-[#DC2626]";
  return "text-[#71717A]";
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

import {
  CHARTING_TABLE_STICKY_FIRST_COL_BODY_CLASS,
  CHARTING_TABLE_STICKY_FIRST_COL_HEAD_CLASS,
  chartingTableFirstColClass,
} from "@/components/charting/charting-table-styles";

type Props = {
  ordered: ChartingSeriesPoint[];
  selected: ChartingMetricId[];
  periodMode: "annual" | "quarterly";
  /** When not `all`, caps sticky period column width so it does not stretch on sparse ranges (e.g. 1Y). */
  timeRange?: "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";
  /** Matches chart legend, e.g. `RACE Revenue`. */
  ticker?: string;
  metricColors?: Map<ChartingMetricId, string>;
  isBarValuesVisible?: (id: ChartingMetricId) => boolean;
  onShowBarValuesChange?: (id: ChartingMetricId, next: boolean) => void;
  hideMetricSettings?: boolean;
  className?: string;
};

/**
 * Single-company charting table — fiscal periods as rows (newest first), metrics as columns.
 * Reference: Figma charting data grid (Year × PYPL Revenue / Net Income).
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
            {selected.map((id, metricIndex) => {
              const color = metricColor(id, metricIndex, metricColors);
              return (
                <th
                  key={id}
                  scope="col"
                  className="min-w-[9rem] whitespace-nowrap border-t border-b border-[#E4E4E7] px-3 py-2.5 text-right align-middle text-[14px] font-medium leading-5 text-[#71717A]"
                >
                  <div className="flex min-w-0 items-center justify-end gap-2 py-0.5">
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
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {periodsNewestFirst.map((periodRow) => (
            <tr
              key={periodRow.periodEnd}
              className="group h-[52px] max-h-[52px] transition-colors duration-75 hover:bg-neutral-50"
            >
              <td
                className={cn(
                  CHARTING_TABLE_STICKY_FIRST_COL_BODY_CLASS,
                  "border-b border-[#E4E4E7] px-3 align-middle text-[14px] font-semibold leading-5 text-[#0F0F0F] group-hover:bg-white",
                  firstColClass,
                )}
              >
                {formatChartingPeriodLabel(periodRow.periodEnd, periodMode)}
              </td>
              {selected.map((id) => {
                const kind = CHARTING_METRIC_KIND[id];
                const v = chartingRowValue(periodRow, id);
                return (
                  <td
                    key={`${periodRow.periodEnd}-${id}`}
                    className={cn(
                      "border-b border-[#E4E4E7] px-3 align-middle text-right text-[14px] font-normal leading-5 tabular-nums",
                      kind === "percent" ? "font-medium" : "",
                      chartingTableCellTone(id, v),
                    )}
                  >
                    {formatChartingTableCellDisplay(id, v)}
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
