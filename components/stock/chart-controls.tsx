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
  seriesSelectDisabled = false,
}: {
  activeRange: StockChartRange;
  onRangeChange: (range: StockChartRange) => void;
  /** When set (stock overview), show metric listbox instead of a static title. */
  chartSeries?: StockChartSeries;
  onChartSeriesChange?: (s: StockChartSeries) => void;
  /** Stock overview: “Compare” picker placed just left of the range control. */
  compareSlot?: ReactNode;
  /** When comparing symbols, metric is fixed to return — disable listbox. */
  seriesSelectDisabled?: boolean;
}) {
  const showSeriesToggle = chartSeries != null && onChartSeriesChange != null;

  return (
    <div className="relative z-30 mb-4 flex flex-wrap items-center justify-between gap-3">
      {showSeriesToggle ? (
        <FormListboxSelect
          key={seriesSelectDisabled ? "chart-metric-locked" : "chart-metric"}
          className="w-[min(100%,220px)] shrink-0"
          value={chartSeries}
          onChange={onChartSeriesChange}
          options={CHART_SERIES_OPTIONS}
          aria-label="Chart metric"
          disabled={seriesSelectDisabled}
        />
      ) : (
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Price</h2>
      )}

      <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {compareSlot}
        <div className="min-w-0 max-w-full flex-1 overflow-x-auto pb-0.5 sm:max-w-none sm:flex-initial sm:overflow-visible sm:pb-0">
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
