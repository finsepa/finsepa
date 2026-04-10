"use client";

import { useMemo } from "react";
import { IndicesTableSkeleton } from "@/components/markets/markets-skeletons";
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
  if (value == null || !Number.isFinite(value)) return <span className="block text-center text-[14px] leading-5 font-medium text-[#71717A]">-</span>;
  const positive = value >= 0;
  return (
    <span className={`block text-center tabular-nums text-[14px] leading-5 font-medium ${positive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
      {formatPercent(value)}
    </span>
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
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] [&>div]:text-center`}
      >
        <div />
        <div className="!text-left">Index</div>
        <div>Value</div>
        <div>1D %</div>
        <div>1M %</div>
        <div>YTD %</div>
      </div>

      {safeRows.map((r) => {
        const wlKey = indexWatchlistKey(r.symbol);
        return (
          <div
            key={r.symbol}
            className={`group grid h-[60px] max-h-[60px] ${colLayout} items-center bg-white px-1 transition-colors duration-75 hover:bg-neutral-50`}
          >
            <WatchlistStarToggle
              className="flex w-10 shrink-0 items-center justify-center px-3"
              storageKey={wlKey}
              label={r.name}
              watched={watched}
              loaded={loaded}
              toggleTicker={toggleTicker}
            />
            <div className="px-4 text-left text-[14px] font-semibold leading-5 text-[#09090B]">{r.name}</div>
            <div className="text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">{formatValue(r.value)}</div>
            <ChangeCell value={r.change1D} />
            <ChangeCell value={r.change1M} />
            <ChangeCell value={r.changeYTD} />
          </div>
        );
      })}
    </div>
  );
}
