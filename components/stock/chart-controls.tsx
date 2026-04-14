import { STOCK_CHART_RANGES, type StockChartRange, type StockChartSeries } from "@/lib/market/stock-chart-types";
import { cn } from "@/lib/utils";

export function ChartControls({
  activeRange,
  onRangeChange,
  chartSeries,
  onChartSeriesChange,
}: {
  activeRange: StockChartRange;
  onRangeChange: (range: StockChartRange) => void;
  /** When set (stock overview), show Price / Market cap segmented control instead of a static title. */
  chartSeries?: StockChartSeries;
  onChartSeriesChange?: (s: StockChartSeries) => void;
}) {
  const showSeriesToggle = chartSeries != null && onChartSeriesChange != null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {showSeriesToggle ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart metric">
          {(
            [
              { id: "price" as const, label: "Price" },
              { id: "marketCap" as const, label: "Market cap" },
            ] as const
          ).map((opt) => {
            const active = chartSeries === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChartSeriesChange(opt.id)}
                className={cn(
                  "rounded-[10px] px-4 py-2 text-sm font-medium leading-5 text-[#09090B] transition-colors duration-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                  active ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]/80",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : (
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Price</h2>
      )}

      <div
        className="flex max-w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial"
        role="group"
        aria-label="Chart time range"
      >
        {STOCK_CHART_RANGES.map((range) => {
          const isActive = range === activeRange;
          return (
            <button
              key={range}
              type="button"
              onClick={() => onRangeChange(range)}
              className={cn(
                "shrink-0 cursor-pointer rounded-[10px] px-3 py-2 text-[13px] font-medium leading-5 text-[#09090B] transition-colors duration-100 sm:text-[14px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                isActive ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]/80",
              )}
            >
              {range}
            </button>
          );
        })}
      </div>
    </div>
  );
}
