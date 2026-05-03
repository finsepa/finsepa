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

/**
 * `#` … metrics … trailing cell. Star is a flex sibling (see row wrapper), not column 1 of this grid.
 * `minmax(0,1fr)` / `minmax(0,2fr)` avoids min-content blowout that wrapped the inner grid to multiple rows
 * when an extra Key Stat column was added.
 */
const rowLinkGridDefault =
  "grid min-w-0 flex-1 grid-cols-[48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[48px_minmax(0,2fr)_repeat(5,minmax(0,1fr))_96px]";
const rowLinkGridWithKeyStat =
  "grid min-w-0 flex-1 grid-cols-[48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[48px_minmax(0,2fr)_repeat(6,minmax(0,1fr))_minmax(5rem,1fr)_96px]";

export type ScreenerTableKeyStatColumn = {
  header: string;
  valuesByTicker: Record<string, string>;
  loading: boolean;
};

type RowProps = {
  item: ScreenerTableRow;
  rank: number;
  starred: boolean;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
  keyStatColumn?: ScreenerTableKeyStatColumn | null;
  rowLinkGrid: string;
};

const ScreenerDataRow = memo(function ScreenerDataRow({
  item,
  rank,
  starred,
  loaded,
  toggleTicker,
  keyStatColumn,
  rowLinkGrid,
}: RowProps) {
  const watchedSet = useMemo(() => {
    const k = item.ticker.trim().toUpperCase();
    return starred ? new Set([k]) : new Set<string>();
  }, [item.ticker, starred]);

  const tickerKey = item.ticker.trim().toUpperCase();
  const keyStatDisplay =
    keyStatColumn == null
      ? null
      : keyStatColumn.loading
        ? "…"
        : (keyStatColumn.valuesByTicker[tickerKey] ?? keyStatColumn.valuesByTicker[item.ticker] ?? "—");

  return (
    <div
      className={`group flex min-h-[60px] items-center gap-x-2 bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4`}
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
        className={`${rowLinkGrid} min-h-[56px] cursor-pointer items-center justify-items-stretch no-underline text-[#09090B] visited:text-[#09090B] sm:min-h-[60px]`}
        aria-label={`Open ${item.name} (${item.ticker})`}
      >
        <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">{rank}</div>

        <div className="flex min-w-0 items-center justify-start gap-3 pr-4 text-left">
          <CompanyLogo name={item.name} logoUrl={item.logoUrl} symbol={item.ticker} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-2 decoration-[#71717A] group-hover:underline">
              {item.name}
            </div>
            <div className="text-[12px] font-normal leading-4 !text-[#71717A]">{item.ticker}</div>
          </div>
        </div>

        <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
          {item.price != null && Number.isFinite(item.price) ? `$${item.price.toFixed(2)}` : "-"}
        </div>

        <ChangeCell value={item.change1D} />
        <div className="hidden min-w-0 w-full sm:block">
          <ChangeCell value={item.change1M} />
        </div>
        <div className="hidden min-w-0 w-full sm:block">
          <ChangeCell value={item.changeYTD} />
        </div>

        <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B] sm:block">
          {item.marketCap}
        </div>

        <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B] sm:block">
          {item.pe}
        </div>

        {keyStatColumn != null ? (
          <>
            <div
              className={`hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums sm:block ${
                keyStatColumn.loading ? "text-[#71717A]" : "text-[#09090B]"
              }`}
              title={keyStatDisplay ?? undefined}
            >
              {keyStatDisplay}
            </div>
            <div className="hidden min-w-0 sm:block" aria-hidden />
          </>
        ) : null}
      </Link>
    </div>
  );
});

export function ScreenerTable({
  rows,
  rankOffset = 0,
  keyStatColumn = null,
}: {
  rows: ScreenerTableRow[];
  rankOffset?: number;
  keyStatColumn?: ScreenerTableKeyStatColumn | null;
}) {
  const { watched, loaded, toggleTicker } = useWatchlist();
  const hasKeyStat = keyStatColumn != null;
  const rowLinkGrid = hasKeyStat ? rowLinkGridWithKeyStat : rowLinkGridDefault;

  return (
    <ScreenerTableScroll minWidthClassName="min-w-0 sm:min-w-[720px] lg:min-w-0">
      <div className="divide-y divide-[#E4E4E7] bg-white">
      {/* Column headers */}
      <div
        className={`flex min-h-[44px] items-center gap-x-2 bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
      >
        <div className="w-10 shrink-0" aria-hidden />
        <div
          className={`${rowLinkGrid} min-h-[44px] items-center text-[12px] font-medium leading-5 text-[#71717A] sm:text-[14px]`}
        >
          <div className="text-center">#</div>
          <div className="text-left">Company</div>
          <div className="min-w-0 w-full text-right">Price</div>
          <div className="min-w-0 w-full text-right">1D %</div>
          <div className="hidden min-w-0 w-full text-right sm:block">1M %</div>
          <div className="hidden min-w-0 w-full text-right sm:block">YTD %</div>
          <div className="hidden min-w-0 w-full text-right sm:block">M Cap</div>
          <div className="hidden min-w-0 w-full text-right sm:block">PE</div>
          {hasKeyStat ? (
            <>
              <div
                className="hidden min-w-0 truncate text-right sm:block"
                title={keyStatColumn.header}
              >
                {keyStatColumn.header}
              </div>
              <div className="hidden min-w-0 sm:block" aria-hidden />
            </>
          ) : null}
        </div>
      </div>

      {rows.map((item, index) => (
        <ScreenerDataRow
          key={item.ticker}
          item={item}
          rank={rankOffset + index + 1}
          starred={watched.has(item.ticker)}
          loaded={loaded}
          toggleTicker={toggleTicker}
          keyStatColumn={keyStatColumn}
          rowLinkGrid={rowLinkGrid}
        />
      ))}
      </div>
    </ScreenerTableScroll>
  );
}
