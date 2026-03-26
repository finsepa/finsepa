import { ChevronDown, Search, BarChart2, Maximize2 } from "lucide-react";

import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

export function ChartControls({
  activeRange,
  onRangeChange,
}: {
  activeRange: StockChartRange;
  onRangeChange: (range: StockChartRange) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Price dropdown */}
      <button className="flex items-center gap-1.5 border border-[#E4E4E7] rounded-lg px-3 h-8 text-[14px] text-[#09090B] hover:bg-[#F4F4F5] transition-colors shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
        <span>Price</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#71717A]" />
      </button>

      {/* Key Events toggle */}
      <div className="flex items-center gap-2 cursor-pointer select-none">
        <span className="text-[14px] text-[#09090B]">Key Events</span>
        {/* Toggle off state */}
        <div className="relative h-5 w-9 rounded-full bg-[#E4E4E7] transition-colors">
          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
        </div>
      </div>

      {/* Compare */}
      <button className="flex items-center gap-1.5 border border-[#E4E4E7] rounded-lg px-3 h-8 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] hover:bg-[#F4F4F5] transition-colors">
        <Search className="h-3.5 w-3.5 text-[#71717A] shrink-0" />
        <span className="text-[14px] text-[#71717A]">Compare</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#71717A]" />
      </button>

      <div className="flex-1" />

      {/* Time range buttons */}
      <div className="flex items-center gap-0.5">
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

      {/* Chart type + Fullscreen */}
      <div className="flex items-center gap-1 ml-1">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5] transition-colors shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
          <BarChart2 className="h-4 w-4" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5] transition-colors shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
