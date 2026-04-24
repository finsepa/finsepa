"use client";

import { useMemo } from "react";
import Link from "next/link";

import { CompanyLogo } from "./company-logo";
import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import { CryptoTableSkeleton } from "@/components/markets/markets-skeletons";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import { SCREENER_MARKETS_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
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

/** Mobile: star + # + coin + price + 1D %. `sm+`: 1M, YTD, M Cap (matches {@link ScreenerTable}). */
const colLayout =
  "grid-cols-[40px_48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr]";
/** Columns inside `Link` — same counts as `colLayout` after the star column. */
const rowLinkGrid =
  "grid-cols-[48px_minmax(0,2fr)_1fr_1fr] gap-x-2 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr]";

export function CryptoTable({
  initialRows,
  rankOffset = 0,
}: {
  initialRows?: CryptoTop10Row[];
  /** Global rank index for first row (e.g. `(page - 1) * pageSize`). */
  rankOffset?: number;
}) {
  const { watched, loaded, toggleTicker } = useWatchlist();

  const safeRows = useMemo(
    () => (Array.isArray(initialRows) ? initialRows : []),
    [initialRows],
  );
  if (safeRows.length === 0) return <CryptoTableSkeleton rows={SCREENER_MARKETS_PAGE_SIZE} />;

  return (
    <ScreenerTableScroll minWidthClassName="min-w-0 sm:min-w-[720px] lg:min-w-0">
      <div className="divide-y divide-[#E4E4E7] bg-white">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
      >
        <div />
        <div className="text-center">#</div>
        <div className="text-left">Coin</div>
        <div className="min-w-0 w-full text-right">Price</div>
        <div className="min-w-0 w-full text-right">1D %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">1M %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">YTD %</div>
        <div className="hidden min-w-0 w-full text-right sm:block">M Cap</div>
      </div>

      {safeRows.map((r, i) => {
        const wlKey = cryptoWatchlistKey(r.symbol);
        return (
          <div
            key={r.symbol}
            className={`group grid min-h-[60px] ${colLayout} items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4`}
          >
            <WatchlistStarToggle
              className="flex w-10 shrink-0 items-center justify-center px-3"
              storageKey={wlKey}
              label={r.symbol}
              watched={watched}
              loaded={loaded}
              toggleTicker={toggleTicker}
            />
            <Link
              href={`/crypto/${encodeURIComponent(r.symbol)}`}
              prefetch={false}
              className={`${rowLinkGrid} col-span-4 col-start-2 grid min-h-[56px] min-w-0 w-full items-center justify-items-stretch no-underline text-[#09090B] visited:text-[#09090B] sm:col-span-7 sm:min-h-[60px]`}
              aria-label={`Open ${r.name} (${eodhdCryptoSpotTickerDisplay(r.symbol)})`}
            >
              <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">
                {rankOffset + i + 1}
              </div>

              <div className="flex min-w-0 items-center justify-start gap-3 pr-4 text-left">
                <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} symbol={r.symbol} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{r.name}</div>
                  <div className="text-[12px] font-normal leading-4 !text-[#71717A]">
                    {eodhdCryptoSpotTickerDisplay(r.symbol)}
                  </div>
                </div>
              </div>

              <div
                className={`min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums ${
                  r.price == null || !Number.isFinite(r.price) ? "text-[#71717A]" : "text-[#09090B]"
                }`}
              >
                {r.price == null || !Number.isFinite(r.price) ? "-" : formatCryptoScreenerUsdPrice(r.price)}
              </div>

              <ChangeCell value={r.changePercent1D} />

              <div className="hidden min-w-0 w-full sm:block">
                <ChangeCell value={r.changePercent1M} />
              </div>

              <div className="hidden min-w-0 w-full sm:block">
                <ChangeCell value={r.changePercentYTD} />
              </div>

              <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B] sm:block">
                {r.marketCap === "-" ? "-" : r.marketCap}
              </div>
            </Link>
          </div>
        );
      })}
      </div>
    </ScreenerTableScroll>
  );
}

