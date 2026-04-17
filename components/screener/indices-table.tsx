"use client";

import { useMemo } from "react";
import { IndicesTableSkeleton } from "@/components/markets/markets-skeletons";
import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import { indexWatchlistKey } from "@/lib/watchlist/constants";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

type IndexRow = {
  name: string;
  symbol: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
};

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="min-w-0 w-full text-right text-[14px] leading-5 font-medium text-[#71717A]">-</div>;
  }
  const positive = value >= 0;
  return (
    <div
      className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercent(value)}
    </div>
  );
}

const colLayout = "grid-cols-[40px_2fr_1fr_1fr_1fr_1fr] gap-x-2";

export function IndicesTable({ initialRows }: { initialRows?: IndexRow[] }) {
  const rows = Array.isArray(initialRows) ? initialRows : [];
  const { watched, loaded, toggleTicker } = useWatchlist();

  const safeRows = useMemo(() => rows, [rows]);

  if (safeRows.length === 0) {
    return <IndicesTableSkeleton rows={10} />;
  }

  return (
    <ScreenerTableScroll minWidthClassName="min-w-[560px] lg:min-w-0">
      <div className="divide-y divide-[#E4E4E7] bg-white">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
      >
        <div />
        <div className="min-w-0 w-full text-left">Index</div>
        <div className="min-w-0 w-full text-right">Value</div>
        <div className="min-w-0 w-full text-right">1D %</div>
        <div className="min-w-0 w-full text-right">1M %</div>
        <div className="min-w-0 w-full text-right">YTD %</div>
      </div>

      {safeRows.map((r) => {
        const wlKey = indexWatchlistKey(r.symbol);
        return (
          <div
            key={r.symbol}
            className={`group grid min-h-[56px] ${colLayout} items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:min-h-[60px] sm:px-4`}
          >
            <WatchlistStarToggle
              className="flex w-10 shrink-0 items-center justify-center px-3"
              storageKey={wlKey}
              label={r.name}
              watched={watched}
              loaded={loaded}
              toggleTicker={toggleTicker}
            />
            <div className="min-w-0 w-full px-4 text-left text-[14px] font-semibold leading-5 text-[#09090B]">{r.name}</div>
            <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
              {formatValue(r.value)}
            </div>
            <ChangeCell value={r.change1D} />
            <ChangeCell value={r.change1M} />
            <ChangeCell value={r.changeYTD} />
          </div>
        );
      })}
      </div>
    </ScreenerTableScroll>
  );
}
