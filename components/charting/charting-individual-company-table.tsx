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
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import { ChartingDataTableSettingsMenu } from "@/components/charting/charting-data-table-settings-menu";
import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import { cn } from "@/lib/utils";

function chartingRowValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  const k = CHARTING_METRIC_FIELD[id];
  const v = row[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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
  if (text === "—" || kind !== "percent" || v == null) return text;
  if (v > 0 && !text.startsWith("+")) return `+${text}`;
  return text;
}

/** Bar labels — same compact formatting as the data table (e.g. $94.83B). */
export function formatBarChartDataLabel(id: ChartingMetricId, v: number): string {
  if (!Number.isFinite(v)) return "";
  return formatChartingTableCellDisplay(id, v);
}

function cellTone(id: ChartingMetricId, v: number | null): string {
  if (CHARTING_METRIC_KIND[id] !== "percent" || v == null || !Number.isFinite(v)) {
    return "text-[#09090B]";
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

type Props = {
  ordered: ChartingSeriesPoint[];
  selected: ChartingMetricId[];
  periodMode: "annual" | "quarterly";
  /** Matches chart legend, e.g. `RACE Revenue`. */
  ticker?: string;
  metricColors?: Map<ChartingMetricId, string>;
  isBarValuesVisible?: (id: ChartingMetricId) => boolean;
  onShowBarValuesChange?: (id: ChartingMetricId, next: boolean) => void;
  className?: string;
};

/**
 * Single-company charting table — metrics as rows, fiscal periods as columns (oldest → newest).
 * Reference: Figma charting data grid (PYPL Revenue / Net Income across years).
 */
export function ChartingIndividualCompanyTable({
  ordered,
  selected,
  periodMode,
  ticker,
  metricColors,
  isBarValuesVisible,
  onShowBarValuesChange,
  className,
}: Props) {
  if (!ordered.length || !selected.length) return null;

  return (
    <div
      className={cn(
        "overflow-x-auto overscroll-x-contain pt-3 [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      <table className="w-full min-w-max border-collapse bg-white">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th
              scope="col"
              className="sticky left-0 z-[1] min-w-[11rem] bg-white px-3 py-2.5 text-left align-middle text-[14px] font-semibold leading-5 text-[#71717A] relative after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-[#E4E4E7]"
            >
              Data
            </th>
            {ordered.map((row) => (
              <th
                key={row.periodEnd}
                scope="col"
                className="min-w-[4.5rem] whitespace-nowrap px-3 py-2.5 text-right align-middle text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]"
              >
                {formatChartingPeriodLabel(row.periodEnd, periodMode)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {selected.map((id, metricIndex) => {
            const color = metricColor(id, metricIndex, metricColors);
            const kind = CHARTING_METRIC_KIND[id];
            return (
              <tr
                key={id}
                className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
              >
                <td className="relative sticky left-0 z-[1] bg-white px-3 align-middle after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-[#E4E4E7]">
                  <div className="flex min-w-0 items-center gap-2.5 py-0.5 pr-0.5">
                    <span
                      className="h-4 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-5 text-[#09090B]">
                      {metricRowLabel(ticker, id)}
                    </span>
                    {onShowBarValuesChange && isBarValuesVisible ? (
                      <ChartingDataTableSettingsMenu
                        showBarValues={isBarValuesVisible(id)}
                        onShowBarValuesChange={(next) => onShowBarValuesChange(id, next)}
                        metricLabel={CHARTING_METRIC_LABEL[id]}
                      />
                    ) : null}
                  </div>
                </td>
                {ordered.map((row) => {
                  const v = chartingRowValue(row, id);
                  return (
                    <td
                      key={`${id}-${row.periodEnd}`}
                      className={cn(
                        "px-3 align-middle text-right text-[14px] font-normal leading-5 tabular-nums",
                        kind === "percent" ? "font-medium" : "",
                        cellTone(id, v),
                      )}
                    >
                      {formatChartingTableCellDisplay(id, v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
