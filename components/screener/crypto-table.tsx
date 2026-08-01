"use client";

import { useMemo } from "react";
import Link from "next/link";

import { CompanyLogo } from "./company-logo";
import { TABLE_END_ALIGNED_PAD_CLASS } from "@/components/screener/screener-table-pad";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { CryptoTableSkeleton } from "@/components/markets/markets-skeletons";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import { SCREENER_CRYPTO_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** Sub-cent meme coins need more precision than 2–4 fixed decimals (avoids `$0`). */
function formatCryptoScreenerUsdPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (value >= 0.01) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  }
  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 8, notation: "standard" })}`;
}

function ChangeCell({ value }: { value: number | null }) {
  const isMissing = value == null || !Number.isFinite(value);
  const positive = !isMissing && value! >= 0;
  return (
    <div
      className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${
        isMissing ? "text-fg-muted" : positive ? "text-up" : "text-down"
      }`}
    >
      {formatPercent(value)}
    </div>
  );
}

function PriceAndChangeCell({
  price,
  change1D,
}: {
  price: number | null;
  change1D: number | null;
}) {
  const hasPrice = price != null && Number.isFinite(price);
  const hasChange = change1D != null && Number.isFinite(change1D);
  const positive = (change1D ?? 0) >= 0;
  return (
    <div className="min-w-0 w-full text-right">
      <div
        className={`min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums ${
          hasPrice ? "text-fg" : "text-fg-muted"
        }`}
      >
        {hasPrice ? formatCryptoScreenerUsdPrice(price!) : "-"}
      </div>
      <div
        className={`mt-0.5 min-w-0 w-full text-[12px] font-medium leading-4 tabular-nums ${
          !hasChange ? "text-fg-muted" : positive ? "text-up" : "text-down"
        }`}
      >
        {formatPercent(change1D)}
      </div>
    </div>
  );
}

/** Mobile: # + coin + price + 1D % (no star). `sm+`: # + coin + … (star sits outside the link). */
const rowLinkGrid =
  "grid grid-cols-[22px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr] sm:gap-x-2";

const desktopNumericCellClass = cn(
  "hidden min-w-0 w-full text-right sm:block",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const mobileRankCellClass =
  "max-md:-ml-0.5 text-center text-[14px] font-semibold leading-5 tabular-nums text-fg-muted";

export function CryptoTable({
  initialRows,
  rankOffset = 0,
}: {
  initialRows?: CryptoTop10Row[];
  /** Global rank index for first row (e.g. `(page - 1) * pageSize`). */
  rankOffset?: number;
}) {
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();

  const safeRows = useMemo(
    () => (Array.isArray(initialRows) ? initialRows : []),
    [initialRows],
  );
  if (safeRows.length === 0) return <CryptoTableSkeleton rows={SCREENER_CRYPTO_PAGE_SIZE} />;

  return (
    <ScreenerTableScroll>
      <div className="bg-surface">
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "md:border-b-0",
          )}
        >
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
            <div className="flex min-h-[44px] min-w-0 w-full items-center gap-x-1.5 py-0 text-[14px] font-medium leading-5 text-fg-muted sm:gap-x-2">
              <div className="hidden w-6 shrink-0 sm:block sm:w-10" aria-hidden />
              <div className={cn(rowLinkGrid, "min-h-[44px] w-full items-center")}>
                <div className={cn(mobileRankCellClass, "text-[14px] font-medium")}>#</div>
                <div className="text-left">Coin</div>
                <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Price</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>1D %</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>1M %</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>YTD %</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>M Cap</div>
              </div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        <div>
          {safeRows.map((r, i) => {
            const wlKey = cryptoWatchlistKey(r.symbol);
            return (
              <div key={r.symbol} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      "flex min-h-[60px] min-w-0 w-full items-center gap-x-1.5 max-md:gap-x-1.5 sm:gap-x-2",
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                  >
                    <WatchlistStarToggle
                      className="hidden w-6 shrink-0 items-center justify-center px-1 sm:flex sm:w-10 sm:px-3"
                      storageKey={wlKey}
                      label={r.symbol}
                      watched={watchedUnion}
                      loaded={loaded}
                      storageHydrated={storageHydrated}
                      toggleTicker={toggleTicker}
                      watchlists={watchlists}
                      activeWatchlistId={activeWatchlistId}
                    />
                    <Link
                      href={`/crypto/${encodeURIComponent(r.symbol)}`}
                      prefetch={false}
                      className={cn(
                        rowLinkGrid,
                        "min-h-[56px] w-full cursor-pointer items-center justify-items-stretch no-underline text-fg visited:text-fg sm:min-h-[60px]",
                      )}
                      aria-label={`Open ${r.name} (${eodhdCryptoSpotTickerDisplay(r.symbol)})`}
                    >
                      <div className={mobileRankCellClass}>{rankOffset + i + 1}</div>

                      <div className="flex min-w-0 items-center justify-start gap-[12px] pr-0 text-left sm:pr-4">
                        <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} symbol={r.symbol} />
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline">
                            {r.name}
                          </div>
                          <div className="text-[12px] font-normal leading-4 text-fg-muted">
                            {eodhdCryptoSpotTickerDisplay(r.symbol)}
                          </div>
                        </div>
                      </div>

                      <div className="block sm:hidden">
                        <PriceAndChangeCell price={r.price} change1D={r.changePercent1D} />
                      </div>
                      <div
                        className={cn(
                          desktopNumericCellClass,
                          "font-['Inter'] text-[14px] font-normal leading-5 tabular-nums",
                          r.price == null || !Number.isFinite(r.price) ? "text-fg-muted" : "text-fg",
                        )}
                      >
                        {r.price == null || !Number.isFinite(r.price)
                          ? "-"
                          : formatCryptoScreenerUsdPrice(r.price)}
                      </div>

                      <div className={desktopNumericCellClass}>
                        <ChangeCell value={r.changePercent1D} />
                      </div>
                      <div className={desktopNumericCellClass}>
                        <ChangeCell value={r.changePercent1M} />
                      </div>
                      <div className={desktopNumericCellClass}>
                        <ChangeCell value={r.changePercentYTD} />
                      </div>

                      <div
                        className={cn(
                          desktopNumericCellClass,
                          "font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
                        )}
                      >
                        {r.marketCap === "-" ? "-" : r.marketCap}
                      </div>
                    </Link>
                  </div>
                </div>
                {i < safeRows.length - 1 ? (
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}
