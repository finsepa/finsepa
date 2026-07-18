"use client";

import { useMemo } from "react";
import Link from "next/link";

import { CompanyLogo } from "./company-logo";
import {
  SCREENER_TABLE_BODY_DIVIDE_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { CryptoTableSkeleton } from "@/components/markets/markets-skeletons";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import { SCREENER_CRYPTO_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

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
        isMissing ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
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
          hasPrice ? "text-[#0F0F0F]" : "text-[#71717A]"
        }`}
      >
        {hasPrice ? formatCryptoScreenerUsdPrice(price!) : "-"}
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

/** Mobile: # + coin + price + 1D % (no star). `sm+`: star + # + coin + … (matches {@link ScreenerTable}). */
const colLayout =
  "grid-cols-[22px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr] sm:gap-x-2";
/** Columns inside `Link` — same counts as `colLayout` after the star column. */
const rowLinkGrid =
  "grid-cols-[22px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr] sm:gap-x-2";

const mobileRankCellClass =
  "max-md:-ml-0.5 text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]";

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
      <div className="bg-white">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] ${SCREENER_TABLE_HEADER_STICKY_CLASS}`}
      >
        <div className="hidden sm:block" aria-hidden />
        <div className={mobileRankCellClass}>#</div>
        <div className="text-left">Coin</div>
        <div className="min-w-0 w-full text-right">Price</div>
        <div className="hidden min-w-0 w-full text-right sm:block">1D %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">1M %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">YTD %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">M Cap</div>
      </div>

        <div className={SCREENER_TABLE_BODY_DIVIDE_CLASS}>
      {safeRows.map((r, i) => {
        const wlKey = cryptoWatchlistKey(r.symbol);
        return (
          <div
            key={r.symbol}
            className={`group grid min-h-[60px] ${colLayout} items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50`}
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
              className={`${rowLinkGrid} col-span-3 col-start-1 grid min-h-[56px] min-w-0 w-full items-center justify-items-stretch no-underline text-[#0F0F0F] visited:text-[#0F0F0F] sm:col-span-7 sm:col-start-2 sm:min-h-[60px]`}
              aria-label={`Open ${r.name} (${eodhdCryptoSpotTickerDisplay(r.symbol)})`}
            >
              <div className={mobileRankCellClass}>
                {rankOffset + i + 1}
              </div>

              <div className="flex min-w-0 items-center justify-start gap-3 pr-4 text-left">
                <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} symbol={r.symbol} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#0F0F0F] underline-offset-2 decoration-[#71717A] group-hover:underline">
                    {r.name}
                  </div>
                  <div className="text-[12px] font-normal leading-4 !text-[#71717A]">
                    {eodhdCryptoSpotTickerDisplay(r.symbol)}
                  </div>
                </div>
              </div>

              <div className="block sm:hidden">
                <PriceAndChangeCell price={r.price} change1D={r.changePercent1D} />
              </div>
              <div
                className={`hidden min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums sm:block ${
                  r.price == null || !Number.isFinite(r.price) ? "text-[#71717A]" : "text-[#0F0F0F]"
                }`}
              >
                {r.price == null || !Number.isFinite(r.price) ? "-" : formatCryptoScreenerUsdPrice(r.price)}
              </div>

              <div className="hidden min-w-0 w-full sm:block">
                <ChangeCell value={r.changePercent1D} />
              </div>

              <div className="hidden min-w-0 w-full sm:block">
                <ChangeCell value={r.changePercent1M} />
              </div>

              <div className="hidden min-w-0 w-full sm:block">
                <ChangeCell value={r.changePercentYTD} />
              </div>

              <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#0F0F0F] sm:block">
                {r.marketCap === "-" ? "-" : r.marketCap}
              </div>
            </Link>
          </div>
        );
      })}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

