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
        <div
          className="inline-flex shrink-0 rounded-[10px] bg-[#F4F4F5] p-0.5"
          role="group"
          aria-label="Chart metric"
        >
          {(
            [
              { id: "price" as const, label: "Price" },
              { id: "marketCap" as const, label: "Market cap" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChartSeriesChange(opt.id)}
              className={cn(
                "rounded-[10px] px-3 py-1.5 text-sm font-medium leading-5 transition-shadow sm:px-4",
                chartSeries === opt.id
                  ? "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#71717A] hover:text-[#09090B]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Price</h2>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        {STOCK_CHART_RANGES.map((range) => {
          const isActive = range === activeRange;
          return (
            <button
              key={range}
              type="button"
              onClick={() => onRangeChange(range)}
              className={`px-2.5 py-1 text-[13px] rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? "bg-[#F4F4F5] text-[#09090B] font-semibold"
                  : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B]"
              }`}
            >
              {range}
            </button>
          );
        })}
      </div>
    </div>
  );
}
