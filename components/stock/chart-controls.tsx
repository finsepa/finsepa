"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { SegmentedControl, type SegmentedControlOption } from "@/components/design-system";
import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import { STOCK_CHART_RANGES, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";
import { cn } from "@/lib/utils";

const CHART_SERIES_OPTIONS: readonly ListboxOption<StockChartSeries>[] = [
  { value: "price", label: "Price" },
  { value: "marketCap", label: "Market cap" },
  { value: "return", label: "Return" },
];

const CHART_RANGE_OPTIONS: readonly SegmentedControlOption<StockChartRange>[] = STOCK_CHART_RANGES.map((r) => ({
  value: r,
  label: r,
}));

/** Mobile range row omits YTD to save horizontal space. */
const MOBILE_CHART_RANGE_OPTIONS = CHART_RANGE_OPTIONS.filter((option) => option.value !== "YTD");

export function ChartControls({
  activeRange,
  onRangeChange,
  chartSeries,
  onChartSeriesChange,
  compareSlot,
  titleSlot,
  seriesSelectDisabled = false,
  children,
}: {
  activeRange: StockChartRange;
  onRangeChange: (range: StockChartRange) => void;
  /** When set (stock overview), show metric toggle instead of a static title. */
  chartSeries?: StockChartSeries;
  onChartSeriesChange?: (s: StockChartSeries) => void;
  /** Stock overview: “Compare” picker placed just left of the range control. */
  compareSlot?: ReactNode;
  /** Holdings: replace the default "Price" title (e.g. with portfolio switcher). */
  titleSlot?: ReactNode;
  /** When comparing symbols, metric is fixed to return — disable toggle. */
  seriesSelectDisabled?: boolean;
  /** Chart body — on mobile, range sits above and metric/compare below. */
  children?: ReactNode;
}) {
  const showSeriesToggle = chartSeries != null && onChartSeriesChange != null;
  const chartSeriesSegmentOptions = CHART_SERIES_OPTIONS;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const syncMobileRange = () => {
      if (mq.matches && activeRange === "YTD") {
        onRangeChange("6M");
      }
    };
    syncMobileRange();
    mq.addEventListener("change", syncMobileRange);
    return () => mq.removeEventListener("change", syncMobileRange);
  }, [activeRange, onRangeChange]);

  const mobileRangeControl = (
    <div className="w-full min-w-0 pb-0.5 max-sm:mb-3 sm:hidden">
      <SegmentedControl
        options={MOBILE_CHART_RANGE_OPTIONS}
        value={activeRange === "YTD" ? "6M" : activeRange}
        onChange={onRangeChange}
        size="sm"
        fullWidth
        aria-label="Chart time range"
        className="w-full"
      />
    </div>
  );

  const showMobileMetricRow = showSeriesToggle || titleSlot != null || compareSlot != null;

  const mobileMetricCompare =
    showMobileMetricRow ?
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 sm:hidden",
          !showSeriesToggle && !titleSlot && compareSlot && "justify-end",
          children != null && "mt-3",
        )}
      >
        {showSeriesToggle ? (
          <FormListboxSelect
            compact
            className="min-w-0 flex-1"
            value={chartSeries}
            onChange={onChartSeriesChange}
            options={chartSeriesSegmentOptions}
            disabled={seriesSelectDisabled}
            aria-label="Chart metric"
          />
        ) : titleSlot ? (
          <div className="min-w-0 flex-1 overflow-hidden">{titleSlot}</div>
        ) : compareSlot ? null : (
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-5 text-[#09090B]">Price</h2>
        )}
        {compareSlot ? <div className="shrink-0">{compareSlot}</div> : null}
      </div>
    : null;

  const desktopControls = (
    <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
      {showSeriesToggle ? (
        <div className="min-w-0 shrink-0 overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
          <SegmentedControl
            options={chartSeriesSegmentOptions.map((option) => ({
              ...option,
              disabled: seriesSelectDisabled,
            }))}
            value={chartSeries}
            onChange={onChartSeriesChange}
            size="sm"
            aria-label="Chart metric"
            className="min-w-min flex-nowrap"
          />
        </div>
      ) : titleSlot ? (
        <div className="min-w-0 w-full max-w-full shrink-0 sm:w-auto">{titleSlot}</div>
      ) : (
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Price</h2>
      )}

      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2">
        {compareSlot ? (
          <div className="min-w-0 w-full shrink-0 sm:w-auto sm:max-w-[min(560px,calc(100vw-12rem))]">
            {compareSlot}
          </div>
        ) : null}
        <div className="shrink-0 overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
          <SegmentedControl
            options={CHART_RANGE_OPTIONS}
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

  if (children == null) {
    return (
      <div className="relative z-10 mb-4">
        {mobileRangeControl}
        {mobileMetricCompare}
        {desktopControls}
      </div>
    );
  }

  return (
    <div className="relative z-10 mb-4 max-md:mb-0">
      {mobileRangeControl}
      <div className="mb-0 hidden sm:mb-4 sm:block">{desktopControls}</div>
      {children}
      {mobileMetricCompare}
    </div>
  );
}
