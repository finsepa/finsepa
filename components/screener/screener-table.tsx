"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import { CompanyLogo } from "./company-logo";
import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

function formatPercentValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <div className="min-w-0 w-full text-right text-[14px] leading-5 font-medium text-[#71717A]">-</div>
    );
  }
  const positive = value >= 0;
  return (
    <div
      className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercentValue(value)}
    </div>
  );
}

const colLayout = "grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] gap-x-2";
/** Columns 2–9 of `colLayout`; used inside a real `<a>` (avoid `display: contents` on Next.js `Link`). */
const rowLinkGrid = "grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] gap-x-2";

type RowProps = {
  item: ScreenerTableRow;
  rank: number;
  starred: boolean;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
};

const ScreenerDataRow = memo(function ScreenerDataRow({ item, rank, starred, loaded, toggleTicker }: RowProps) {
  const watchedSet = useMemo(() => {
    const k = item.ticker.trim().toUpperCase();
    return starred ? new Set([k]) : new Set<string>();
  }, [item.ticker, starred]);

  return (
    <div
      className={`group grid ${colLayout} min-h-[60px] items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4`}
    >
      <WatchlistStarToggle
        className="flex w-10 shrink-0 items-center justify-center px-3"
        storageKey={item.ticker}
        label={item.ticker}
        watched={watchedSet}
        loaded={loaded}
        toggleTicker={toggleTicker}
      />

      <Link
        href={`/stock/${encodeURIComponent(item.ticker)}`}
        prefetch={false}
        className={`${rowLinkGrid} col-span-8 col-start-2 grid min-h-[56px] min-w-0 w-full items-center justify-items-stretch sm:min-h-[60px]`}
        aria-label={`Open ${item.name} (${item.ticker})`}
      >
        <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">{rank}</div>

        <div className="flex min-w-0 items-center justify-start gap-3 pr-4 text-left">
          <CompanyLogo name={item.name} logoUrl={item.logoUrl} symbol={item.ticker} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{item.name}</div>
            <div className="text-[12px] font-normal leading-4 text-[#71717A]">{item.ticker}</div>
          </div>
        </div>

        <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
          {item.price != null && Number.isFinite(item.price) ? `$${item.price.toFixed(2)}` : "-"}
        </div>

        <ChangeCell value={item.change1D} />
        <ChangeCell value={item.change1M} />
        <ChangeCell value={item.changeYTD} />

        <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
          {item.marketCap}
        </div>

        <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
          {item.pe}
        </div>
      </Link>
    </div>
  );
});

export function ScreenerTable({ rows, rankOffset = 0 }: { rows: ScreenerTableRow[]; rankOffset?: number }) {
  const { watched, loaded, toggleTicker } = useWatchlist();

  return (
    <ScreenerTableScroll>
      <div className="divide-y divide-[#E4E4E7] bg-white">
      {/* Column headers */}
      <div
        className={`grid ${colLayout} min-h-[44px] items-center bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
      >
        <div />
        <div className="text-center">#</div>
        <div className="text-left">Company</div>
        <div className="min-w-0 w-full text-right">Price</div>
        <div className="min-w-0 w-full text-right">1D %</div>
        <div className="min-w-0 w-full text-right">1M %</div>
        <div className="min-w-0 w-full text-right">YTD %</div>
        <div className="min-w-0 w-full text-right">M Cap</div>
        <div className="min-w-0 w-full text-right">PE</div>
      </div>

      {rows.map((item, index) => (
        <ScreenerDataRow
          key={item.ticker}
          item={item}
          rank={rankOffset + index + 1}
          starred={watched.has(item.ticker)}
          loaded={loaded}
          toggleTicker={toggleTicker}
        />
      ))}
      </div>
    </ScreenerTableScroll>
  );
}
