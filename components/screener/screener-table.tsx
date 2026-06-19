"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
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
      <div className="min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
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
 * `#` … metrics … trailing cell. Star is a flex sibling (see row wrapper), not column 1 of this grid.
 * `minmax(0,1fr)` / `minmax(0,2fr)` avoids min-content blowout that wrapped the inner grid to multiple rows
 * when an extra Key Stat column was added.
 */
const rowLinkGridBase =
  "grid w-full min-w-0 flex-1 grid-cols-[20px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 max-md:gap-x-1.5 sm:gap-x-2";

/** Base desktop width before custom key-stat columns (rank + company + 6 core metrics). */
const SCREENER_TABLE_DESKTOP_BASE_MIN_WIDTH_PX = 688;
const SCREENER_TABLE_KEY_STAT_COL_MIN_WIDTH_PX = 96;

export function screenerTableMinWidthPx(keyStatCount: number): number | undefined {
  if (keyStatCount <= 0) return undefined;
  return SCREENER_TABLE_DESKTOP_BASE_MIN_WIDTH_PX + keyStatCount * SCREENER_TABLE_KEY_STAT_COL_MIN_WIDTH_PX;
}

const MOBILE_GRID_TEMPLATE = "20px minmax(0, 1fr) minmax(4.5rem, 5.5rem)";

/** Default: fluid columns that fit the viewport. With custom metrics: fixed mins + horizontal scroll. */
function buildDesktopGridTemplate(keyStatCount: number): string {
  if (keyStatCount === 0) {
    return [
      "48px",
      "minmax(0, 2fr)",
      "minmax(0, 1fr)",
      "minmax(0, 1fr)",
      "minmax(0, 1fr)",
      "minmax(0, 1fr)",
      "minmax(0, 1fr)",
      "minmax(0, 1fr)",
    ].join(" ");
  }
  return [
    "48px",
    "minmax(11rem, 1.35fr)",
    "minmax(5.25rem, max-content)",
    "minmax(4.75rem, max-content)",
    "minmax(4.75rem, max-content)",
    "minmax(4.75rem, max-content)",
    "minmax(5.5rem, max-content)",
    "minmax(4.5rem, max-content)",
    ...Array.from({ length: keyStatCount }, () => "minmax(5.5rem, 8rem)"),
  ].join(" ");
}

function useScreenerTableGridTemplate(keyStatCount: number): string {
  const [template, setTemplate] = useState(MOBILE_GRID_TEMPLATE);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => {
      setTemplate(mq.matches ? buildDesktopGridTemplate(keyStatCount) : MOBILE_GRID_TEMPLATE);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [keyStatCount]);

  return template;
}

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
  starred: boolean;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
  keyStatColumns: ScreenerTableKeyStatColumn[];
  gridTemplateColumns: string;
  desktopNumericCellClass: string;
};

const ScreenerDataRow = memo(function ScreenerDataRow({
  item,
  rank,
  starred,
  loaded,
  toggleTicker,
  keyStatColumns,
  gridTemplateColumns,
  desktopNumericCellClass,
}: RowProps) {
  const watchedSet = useMemo(() => {
    const k = item.ticker.trim().toUpperCase();
    return starred ? new Set([k]) : new Set<string>();
  }, [item.ticker, starred]);

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
        watched={watchedSet}
        loaded={loaded}
        toggleTicker={toggleTicker}
      />

      <Link
        href={`/stock/${encodeURIComponent(item.ticker)}`}
        prefetch={false}
        className={`${rowLinkGridBase} min-h-[56px] cursor-pointer items-center justify-items-stretch no-underline text-[#09090B] visited:text-[#09090B] sm:min-h-[60px]`}
        style={{ gridTemplateColumns }}
        aria-label={`Open ${item.name} (${item.ticker})`}
      >
        <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">{rank}</div>

        <div className="flex min-w-0 items-center justify-start gap-2 pr-0 text-left max-md:gap-2 sm:gap-3 sm:pr-4">
          <CompanyLogo name={item.name} logoUrl={item.logoUrl} symbol={item.ticker} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-2 decoration-[#71717A] group-hover:underline">
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
          className={`${desktopNumericCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]`}
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
          className={`${desktopNumericCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]`}
        >
          {item.marketCap}
        </div>

        <div
          className={`${desktopNumericCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]`}
        >
          {item.pe}
        </div>

        {keyStatColumns.map((col, i) => (
          <div
            key={col.header}
            className={`${desktopKeyStatCellClass} font-['Inter'] text-[14px] font-normal leading-5 tabular-nums ${
              col.loading ? "text-[#71717A]" : "text-[#09090B]"
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
  const { watched, loaded, toggleTicker } = useWatchlist();
  const keyStatCount = keyStatColumns.length;
  const useFluidDesktopColumns = keyStatCount === 0;
  const gridTemplateColumns = useScreenerTableGridTemplate(keyStatCount);
  const tableMinWidthPx = screenerTableMinWidthPx(keyStatCount);
  const desktopNumericCellClass = screenerDesktopNumericCellClass(useFluidDesktopColumns);
  const { headerRef, bodyRef, onHeaderScroll, onBodyScroll } = useSyncedHorizontalScroll();

  const headerRow = (
    <div
      className={`flex min-h-[44px] max-md:min-h-10 min-w-0 w-full items-center gap-x-1.5 px-4 py-0 max-md:py-2 text-[12px] font-medium leading-5 text-[#71717A] max-md:gap-x-1.5 sm:gap-x-2 sm:text-[14px]`}
    >
      <div className="hidden w-6 shrink-0 sm:block sm:w-10" aria-hidden />
      <div
        className={`${rowLinkGridBase} min-h-[44px] max-md:min-h-0 items-center text-[12px] font-medium leading-5 text-[#71717A] sm:text-[14px]`}
        style={{ gridTemplateColumns }}
      >
        <div className="text-center">#</div>
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
          starred={watched.has(item.ticker)}
          loaded={loaded}
          toggleTicker={toggleTicker}
          keyStatColumns={keyStatColumns}
          gridTemplateColumns={gridTemplateColumns}
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
