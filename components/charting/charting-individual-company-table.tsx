"use client";

import { Fragment } from "react";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  chartingPeriodSortYear,
  formatChartingPeriodEndShortMd,
  formatChartingPeriodLabel,
} from "@/lib/market/charting-period-display";
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

type Props = {
  ordered: ChartingSeriesPoint[];
  selected: ChartingMetricId[];
  periodMode: "annual" | "quarterly";
  className?: string;
};

/**
 * Single-company charting table — Figma 8479:44939 / stock Charting tab.
 * Period rows (newest first), metric columns; two-line period cells (year or quarter + fiscal end date).
 */
export function ChartingIndividualCompanyTable({ ordered, selected, periodMode, className }: Props) {
  if (!ordered.length || !selected.length) return null;

  return (
    <div className={className ?? "overflow-x-hidden pt-3"}>
      <table className="w-full table-fixed border-collapse bg-white [&_tbody_td:first-child]:text-left [&_tbody_td:not(:first-child)]:text-right [&_thead_th:first-child]:text-left [&_thead_th:not(:first-child)]:text-right">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th
              scope="col"
              className="w-[160px] px-3 py-2.5 text-left align-middle text-[14px] font-semibold leading-5 text-[#71717A]"
            >
              Period
            </th>
            {selected.map((id) => (
              <th
                key={id}
                scope="col"
                className="px-3 py-2.5 text-right align-middle text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]"
              >
                <span className="block truncate">{CHARTING_METRIC_LABEL[id]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...ordered].reverse().map((row, idx, arr) => {
            const year = chartingPeriodSortYear(row.periodEnd);
            const prevYear = idx > 0 ? chartingPeriodSortYear(arr[idx - 1]!.periodEnd) : "";
            const showYearHeader = periodMode === "quarterly" && Boolean(year) && year !== prevYear;
            const colSpan = 1 + selected.length;
            const secondary = formatChartingPeriodEndShortMd(row.periodEnd);
            return (
              <Fragment key={row.periodEnd}>
                {showYearHeader ? (
                  <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <td
                      colSpan={colSpan}
                      className="px-3 py-2 text-left text-[14px] font-semibold leading-5 text-[#09090B]"
                    >
                      {year}
                    </td>
                  </tr>
                ) : null}
                <tr className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50">
                  <td className="px-3 align-middle text-left">
                    <div className="flex flex-col gap-0.5 py-0.5">
                      <span className="text-[14px] font-semibold leading-5 text-[#09090B]">
                        {formatChartingPeriodLabel(row.periodEnd, periodMode)}
                      </span>
                      {secondary ? (
                        <span className="text-[12px] font-normal leading-4 text-[#71717A]">{secondary}</span>
                      ) : null}
                    </div>
                  </td>
                  {selected.map((id) => (
                    <td
                      key={id}
                      className="px-3 align-middle text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]"
                    >
                      {formatChartingTableCell(CHARTING_METRIC_KIND[id], chartingRowValue(row, id))}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
