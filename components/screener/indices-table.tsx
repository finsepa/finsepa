"use client";

import { useMemo } from "react";
import { IndicesTableSkeleton } from "@/components/markets/markets-skeletons";
import {
  SCREENER_TABLE_BODY_DIVIDE_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import { indexWatchlistKey } from "@/lib/watchlist/constants";
import { SCREENER_INDICES_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
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

/** Mobile: # + index + value + 1D % (no star). `sm+`: star + # + index + … */
const colLayout =
  "grid-cols-[28px_minmax(0,2fr)_1fr] gap-x-2 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr]";

function ValueAndChangeCell({ value, change1D }: { value: number; change1D: number | null }) {
  const hasValue = Number.isFinite(value);
  const hasChange = change1D != null && Number.isFinite(change1D);
  const positive = (change1D ?? 0) >= 0;
  return (
    <div className="min-w-0 w-full text-right">
      <div className="min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#0F0F0F]">
        {hasValue ? formatValue(value) : "-"}
      </div>
      <div
        className={`mt-0.5 min-w-0 w-full text-[12px] font-medium leading-4 tabular-nums ${
          !hasChange ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
        }`}
      >
        {formatPercent(change1D)}
      </div>
    </div>
  );
}

export function IndicesTable({
  initialRows,
  rankOffset = 0,
}: {
  initialRows?: IndexRow[];
  /** Global rank for first row when paginated (same as {@link CryptoTable}). */
  rankOffset?: number;
}) {
  const rows = Array.isArray(initialRows) ? initialRows : [];
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();

  const safeRows = useMemo(() => rows, [rows]);

  if (safeRows.length === 0) {
    return <IndicesTableSkeleton rows={SCREENER_INDICES_PAGE_SIZE} />;
  }

  return (
    <ScreenerTableScroll
      minWidthClassName="min-w-0"
      className="h-fit"
    >
      <div className="bg-white">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] ${SCREENER_TABLE_HEADER_STICKY_CLASS}`}
      >
        <div className="hidden sm:block" aria-hidden />
        <div className="text-center">#</div>
        <div className="min-w-0 w-full text-left">Index</div>
        <div className="min-w-0 w-full text-right">Price</div>
        <div className="hidden min-w-0 w-full text-right sm:block">1D %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">1M %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">YTD %</div>
      </div>

        <div className={SCREENER_TABLE_BODY_DIVIDE_CLASS}>
      {safeRows.map((r, i) => {
        const wlKey = indexWatchlistKey(r.symbol);
        return (
          <div
            key={r.symbol}
            className={`group grid min-h-[56px] ${colLayout} items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50 sm:min-h-[60px]`}
          >
            <WatchlistStarToggle
              className="hidden w-6 shrink-0 items-center justify-center px-1 sm:flex sm:w-10 sm:px-3"
              storageKey={wlKey}
              label={r.name}
              watched={watchedUnion}
              loaded={loaded}
              storageHydrated={storageHydrated}
              toggleTicker={toggleTicker}
              watchlists={watchlists}
              activeWatchlistId={activeWatchlistId}
            />
            <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">
              {rankOffset + i + 1}
            </div>
            <div className="min-w-0 w-full px-2 text-left text-[14px] font-semibold leading-5 text-[#0F0F0F] sm:px-4">
              {r.name}
            </div>
            <div className="block sm:hidden">
              <ValueAndChangeCell value={r.value} change1D={r.change1D} />
            </div>
            <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#0F0F0F] sm:block">
              {formatValue(r.value)}
            </div>
            <div className="hidden min-w-0 w-full sm:block">
              <ChangeCell value={r.change1D} />
            </div>
            <div className="hidden min-w-0 w-full sm:block">
              <ChangeCell value={r.change1M} />
            </div>
            <div className="hidden min-w-0 w-full sm:block">
              <ChangeCell value={r.changeYTD} />
            </div>
          </div>
        );
      })}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}
