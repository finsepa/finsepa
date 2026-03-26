"use client";

import { useState } from "react";
import { StockHeader } from "./stock-header";
import { ChartControls } from "./chart-controls";
import { StockChart } from "./stock-chart";
import { MiniTable } from "./mini-table";
import { KeyStats } from "./key-stats";
import { LatestNews } from "./latest-news";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

export function StockPageContent({ routeTicker }: { routeTicker?: string }) {
  const [range, setRange] = useState<StockChartRange>("1Y");
  const ticker = (routeTicker?.trim() ? routeTicker.trim() : "AAPL").toUpperCase();

  return (
    <div className="px-9 py-6 space-y-5">
      <StockHeader ticker={ticker} />
      <ChartControls activeRange={range} onRangeChange={setRange} />
      <StockChart ticker={ticker} range={range} />
      <MiniTable ticker={ticker} />
      <div className="pt-2"><KeyStats ticker={ticker} /></div>
      <div className="pt-2"><LatestNews ticker={ticker} /></div>
    </div>
  );
}
