"use client";

import type { ReactNode } from "react";

import { SegmentedControl } from "@/components/design-system";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import type { ListboxOption } from "@/components/ui/form-listbox-select";
import { STOCK_CHART_RANGES, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";

const CHART_SERIES_OPTIONS: readonly ListboxOption<StockChartSeries>[] = [
  { value: "price", label: "Price" },
  { value: "marketCap", label: "Market cap" },
  { value: "return", label: "Return" },
];

export function ChartControls({
  activeRange,
  onRangeChange,
  chartSeries,
  onChartSeriesChange,
  compareSlot,
  titleSlot,
  seriesSelectDisabled = false,
}: {
  activeRange: StockChartRange;
  onRangeChange: (range: StockChartRange) => void;
  /** When set (stock overview), show metric listbox instead of a static title. */
  chartSeries?: StockChartSeries;
  onChartSeriesChange?: (s: StockChartSeries) => void;
  /** Stock overview: “Compare” picker placed just left of the range control. */
  compareSlot?: ReactNode;
  /** Holdings: replace the default "Price" title (e.g. with portfolio switcher). */
  titleSlot?: ReactNode;
  /** When comparing symbols, metric is fixed to return — disable listbox. */
  seriesSelectDisabled?: boolean;
}) {
  const showSeriesToggle = chartSeries != null && onChartSeriesChange != null;

  return (
    <div className="relative z-10 mb-4 flex max-md:px-3 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 md:px-0">
      {showSeriesToggle ? (
        <FormListboxSelect
          key={seriesSelectDisabled ? "chart-metric-locked" : "chart-metric"}
          className="w-full min-w-0 shrink-0 sm:w-[min(100%,220px)]"
          value={chartSeries}
          onChange={onChartSeriesChange}
          options={CHART_SERIES_OPTIONS}
          aria-label="Chart metric"
          disabled={seriesSelectDisabled}
        />
      ) : titleSlot ? (
        <div className="min-w-0 w-full max-w-full shrink-0 sm:w-auto">{titleSlot}</div>
      ) : (
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Price</h2>
      )}

      <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-full sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 sm:gap-3">
        {compareSlot}
        <div className="min-w-0 w-full max-w-full flex-1 overflow-x-auto pb-0.5 sm:w-auto sm:max-w-none sm:flex-initial sm:overflow-visible sm:pb-0">
          <SegmentedControl
            options={STOCK_CHART_RANGES.map((r) => ({ value: r, label: r }))}
            value={activeRange}
            onChange={onRangeChange}
            size="sm"
            aria-label="Chart time range"
            className="min-w-min flex-nowrap"
          />
        </div>
      </div>
    </div>
  );
}
