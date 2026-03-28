import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

export function ChartControls({
  activeRange,
  onRangeChange,
}: {
  activeRange: StockChartRange;
  onRangeChange: (range: StockChartRange) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Price</h2>

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
