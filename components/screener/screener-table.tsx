"use client";

import Link from "next/link";
import { memo, useRef, type UIEvent } from "react";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { WatchlistCollection } from "@/lib/watchlist/collections";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import { CompanyLogo } from "./company-logo";
import {
  SCREENER_TABLE_BODY_DIVIDE_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

function formatPercentValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** Keep header/body columns aligned when the table is wider than the viewport. */
function useSyncedHorizontalScroll() {
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  const onHeaderScroll = (e: UIEvent<HTMLDivElement>) => {
    if (lock.current) return;
    lock.current = true;
    const left = e.currentTarget.scrollLeft;
    const peer = bodyRef.current;
    if (peer && peer.scrollLeft !== left) peer.scrollLeft = left;
    lock.current = false;
  };

  const onBodyScroll = (e: UIEvent<HTMLDivElement>) => {
    if (lock.current) return;
    lock.current = true;
    const left = e.currentTarget.scrollLeft;
    const peer = headerRef.current;
    if (peer && peer.scrollLeft !== left) peer.scrollLeft = left;
    lock.current = false;
  };

  return { headerRef, bodyRef, onHeaderScroll, onBodyScroll };
}

const screenerTableWideHorizontalScrollClass =
  "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]";
const screenerTableWideHeaderScrollClass =
  "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

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

function PriceAndChangeCell({ price, change1D }: { price: number | null; change1D: number | null }) {
  const hasPrice = price != null && Number.isFinite(price);
  const hasChange = change1D != null && Number.isFinite(change1D);
  const positive = (change1D ?? 0) >= 0;
  return (
    <div className="min-w-0 w-full text-right">
      <div className="min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#0F0F0F]">
        {hasPrice ? `$${price!.toFixed(2)}` : "-"}
      </div>
      <div
        className={`mt-0.5 min-w-0 w-full text-[12px] font-medium leading-4 tabular-nums ${
          !hasChange ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
        }`}
      >
        {hasChange ? formatPercentValue(change1D!) : "-"}
      </div>
    </div>
  );
}

/**
 * Static Tailwind strings only (no matchMedia / no conditional inline styles on hydrate).
 * Star sits outside this grid. Mobile = 3 cols; `sm+` = rank + company + 6 metrics.
 * Extra key-stat columns use a pre-baked `sm:grid-cols` class from {@link rowLinkGridClass}.
 */
const ROW_LINK_GRID_MOBILE =
  "grid w-full min-w-0 flex-1 grid-cols-[22px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 max-md:gap-x-1.5 sm:gap-x-2";

/** Pre-baked desktop track lists so Tailwind JIT always sees full class strings. */
const DESKTOP_SM_GRID_BY_KEY_STAT_COUNT = [
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px_96px_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px_96px_96px_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px_96px_96px_96px_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px_96px_96px_96px_96px_96px]",
  "sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr_96px_96px_96px_96px_96px_96px_96px_96px]",
] as const;

function rowLinkGridClass(keyStatCount: number): string {
  const capped = Math.max(0, Math.min(keyStatCount, DESKTOP_SM_GRID_BY_KEY_STAT_COUNT.length - 1));
  return cn(ROW_LINK_GRID_MOBILE, DESKTOP_SM_GRID_BY_KEY_STAT_COUNT[capped]);
}

/** Base desktop width before custom key-stat columns (rank + company + 6 core metrics). */
const SCREENER_TABLE_DESKTOP_BASE_MIN_WIDTH_PX = 688;
const SCREENER_TABLE_KEY_STAT_COL_MIN_WIDTH_PX = 96;

export function screenerTableMinWidthPx(keyStatCount: number): number | undefined {
  if (keyStatCount <= 0) return undefined;
  return SCREENER_TABLE_DESKTOP_BASE_MIN_WIDTH_PX + keyStatCount * SCREENER_TABLE_KEY_STAT_COL_MIN_WIDTH_PX;
}

const mobileRankCellClass = "max-md:-ml-0.5 text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]";

const desktopNumericCellFluidClass = "hidden min-w-0 w-full text-right sm:block";
const desktopNumericCellFixedClass =
  "hidden w-full min-w-[4.5rem] max-w-[8rem] shrink-0 text-right sm:block";
const desktopKeyStatCellClass =
  "hidden w-full min-w-[5.5rem] max-w-[8rem] shrink-0 truncate text-right sm:block";

function screenerDesktopNumericCellClass(fluid: boolean): string {
  return fluid ? desktopNumericCellFluidClass : desktopNumericCellFixedClass;
}

export type ScreenerTableKeyStatColumn = {
  header: string;
  valuesByTicker: Record<string, string>;
  loading: boolean;
};

type RowProps = {
  item: ScreenerTableRow;
  rank: number;
  watched: Set<string>;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
  loaded: boolean;
  storageHydrated: boolean;
  toggleTicker: (ticker: string, watchlistId?: string) => void;
  keyStatColumns: ScreenerTableKeyStatColumn[];
  gridClassName: string;
  desktopNumericCellClass: string;
};

const ScreenerDataRow = memo(function ScreenerDataRow({
  item,
  rank,
  watched,
  watchlists,
  activeWatchlistId,
  loaded,
  storageHydrated,
  toggleTicker,
  keyStatColumns,
  gridClassName,
  desktopNumericCellClass,
}: RowProps) {
  const tickerKey = item.ticker.trim().toUpperCase();
  const keyStatDisplays = keyStatColumns.map((col) =>
    col.loading ? "…" : (col.valuesByTicker[tickerKey] ?? col.valuesByTicker[item.ticker] ?? "—"),
  );

  return (
    <div
      className="group flex min-h-[60px] min-w-0 w-full items-center gap-x-1.5 bg-white px-4 transition-colors duration-75 hover:bg-neutral-50 max-md:gap-x-1.5 sm:gap-x-2"
    >
      <WatchlistStarToggle
        className="hidden w-6 shrink-0 items-center justify-center px-1 sm:flex sm:w-10 sm:px-3"
        storageKey={item.ticker}
        label={item.ticker}
        watched={watched}
        loaded={loaded}
        storageHydrated={storageHydrated}
        toggleTicker={toggleTicker}
        watchlists={watchlists}
        activeWatchlistId={activeWatchlistId}
      />

      <Link
        href={`/stock/${encodeURIComponent(item.ticker)}`}
        prefetch={false}
        className={cn(
          gridClassName,
          "min-h-[56px] cursor-pointer items-center justify-items-stretch no-underline text-[#0F0F0F] visited:text-[#0F0F0F] sm:min-h-[60px]",
        )}
        aria-label={`Open ${item.name} (${item.ticker})`}
      >
        <div className={mobileRankCellClass}>{rank}</div>

        <div className="flex min-w-0 items-center justify-start gap-2 pr-0 text-left max-md:gap-2 sm:gap-3 sm:pr-4">
          <CompanyLogo name={item.name} logoUrl={item.logoUrl} symbol={item.ticker} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[#0F0F0F] underline-offset-2 decoration-[#71717A] group-hover:underline">
              {item.name}
            </div>
            <div className="text-[12px] font-normal leading-4 !text-[#71717A]">
              <span>{item.ticker}</span>
              <span className="sm:hidden">
                {typeof item.marketCap === "string" && item.marketCap.trim() && item.marketCap.trim() !== "-" ?
                  ` · ${item.marketCap.trim()}`
                : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="block sm:hidden">
          <PriceAndChangeCell price={item.price} change1D={item.change1D} />
        </div>
        <div
          className={`${desktopNumericCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#0F0F0F]`}
        >
          {item.price != null && Number.isFinite(item.price) ? `$${item.price.toFixed(2)}` : "-"}
        </div>

        <div className={desktopNumericCellClass}>
          <ChangeCell value={item.change1D} />
        </div>
        <div className={desktopNumericCellClass}>
          <ChangeCell value={item.change1M} />
        </div>
        <div className={desktopNumericCellClass}>
          <ChangeCell value={item.changeYTD} />
        </div>

        <div
          className={`${desktopNumericCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#0F0F0F]`}
        >
          {item.marketCap}
        </div>

        <div
          className={`${desktopNumericCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#0F0F0F]`}
        >
          {item.pe}
        </div>

        {keyStatColumns.map((col, i) => (
          <div
            key={col.header}
            className={`${desktopKeyStatCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums ${
              col.loading ? "text-[#71717A]" : "text-[#0F0F0F]"
            }`}
            title={keyStatDisplays[i]}
          >
            {keyStatDisplays[i]}
          </div>
        ))}
      </Link>
    </div>
  );
});

export function ScreenerTable({
  rows,
  rankOffset = 0,
  keyStatColumns = [],
  hideMobileHeader = false,
  embeddedInMobileCard = false,
}: {
  rows: ScreenerTableRow[];
  rankOffset?: number;
  keyStatColumns?: ScreenerTableKeyStatColumn[];
  /** Hides # / Company / Price header row below `md`. */
  hideMobileHeader?: boolean;
  /** Renders without mobile card chrome when inside {@link ScreenerStocksSubTabMobileCard}. */
  embeddedInMobileCard?: boolean;
}) {
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();
  const keyStatCount = keyStatColumns.length;
  const useFluidDesktopColumns = keyStatCount === 0;
  const gridClassName = rowLinkGridClass(keyStatCount);
  const tableMinWidthPx = screenerTableMinWidthPx(keyStatCount);
  const desktopNumericCellClass = screenerDesktopNumericCellClass(useFluidDesktopColumns);
  const { headerRef, bodyRef, onHeaderScroll, onBodyScroll } = useSyncedHorizontalScroll();

  const headerRow = (
    <div
      className={`flex min-h-[44px] max-md:min-h-10 min-w-0 w-full items-center gap-x-1.5 px-4 py-0 max-md:py-2 text-[14px] font-medium leading-5 text-[#71717A] max-md:gap-x-1.5 sm:gap-x-2`}
    >
      <div className="hidden w-6 shrink-0 sm:block sm:w-10" aria-hidden />
      <div
        className={cn(
          gridClassName,
          "min-h-[44px] max-md:min-h-0 items-center text-[14px] font-medium leading-5 text-[#71717A]",
        )}
      >
        <div className={cn(mobileRankCellClass, "text-[14px] font-medium")}>#</div>
        <div className="text-left">Company</div>
        <div className={cn("min-w-0 w-full text-right", !useFluidDesktopColumns && "sm:shrink-0 sm:max-w-[8rem] sm:min-w-[5.25rem]")}>
          <span className="sm:hidden">Price</span>
          <span className="hidden sm:inline">Price</span>
          <span className="hidden text-[12px] font-medium leading-4 text-[#A1A1AA] sm:hidden">1D %</span>
        </div>
        <div className={cn(desktopNumericCellClass, "truncate")}>1D %</div>
        <div className={cn(desktopNumericCellClass, "truncate")}>1M %</div>
        <div className={cn(desktopNumericCellClass, "truncate")}>YTD %</div>
        <div className={cn(desktopNumericCellClass, "truncate")}>M Cap</div>
        <div className={cn(desktopNumericCellClass, "truncate")}>PE</div>
        {keyStatColumns.map((col) => (
          <div
            key={col.header}
            className={cn(desktopKeyStatCellClass, "truncate")}
            title={col.header}
          >
            {col.header}
          </div>
        ))}
      </div>
    </div>
  );

  const bodyRows = (
    <div className={SCREENER_TABLE_BODY_DIVIDE_CLASS}>
      {rows.map((item, index) => (
        <ScreenerDataRow
          key={item.ticker}
          item={item}
          rank={rankOffset + index + 1}
          watched={watchedUnion}
          watchlists={watchlists}
          activeWatchlistId={activeWatchlistId}
          loaded={loaded}
          storageHydrated={storageHydrated}
          toggleTicker={toggleTicker}
          keyStatColumns={keyStatColumns}
          gridClassName={gridClassName}
          desktopNumericCellClass={desktopNumericCellClass}
        />
      ))}
    </div>
  );

  const headerSection = (
    <div className={cn(SCREENER_TABLE_HEADER_STICKY_CLASS, hideMobileHeader && "max-md:hidden")}>
      {headerRow}
    </div>
  );

  if (tableMinWidthPx != null) {
    return (
      <div
        className={cn(
          "w-full min-w-0 max-w-full bg-white",
          !embeddedInMobileCard && SCREENER_TABLE_OUTER_BORDER_CLASS,
          !embeddedInMobileCard && SCREENER_TABLE_MOBILE_SURFACE_CLASS,
          embeddedInMobileCard &&
            "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none",
        )}
      >
        <div className={cn(SCREENER_TABLE_HEADER_STICKY_CLASS, hideMobileHeader && "max-md:hidden")}>
          <div
            ref={headerRef}
            onScroll={onHeaderScroll}
            className={screenerTableWideHeaderScrollClass}
          >
            <div style={{ minWidth: tableMinWidthPx }}>{headerRow}</div>
          </div>
        </div>
        <div ref={bodyRef} onScroll={onBodyScroll} className={screenerTableWideHorizontalScrollClass}>
          <div style={{ minWidth: tableMinWidthPx }}>{bodyRows}</div>
        </div>
      </div>
    );
  }

  return (
    <ScreenerTableScroll embeddedInMobileCard={embeddedInMobileCard}>
      <div className="bg-white">
        {headerSection}
        {bodyRows}
      </div>
    </ScreenerTableScroll>
  );
}
