"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import {
  formatHeaderMetaSegment,
  formatWatchlistsCountLabel,
  type StockDetailHeaderMeta,
} from "@/lib/market/stock-header-meta";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";

type Props = {
  ticker: string;
  /** Active chart range label (e.g. 1D, 1Y). */
  periodLabel: string;
  /** When set (e.g. drag selection), replaces `periodLabel` in the price row. */
  periodLabelOverride?: string | null;
  /** Latest close from chart series, or hover price when crosshair active. */
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  chartLoading: boolean;
  /** No chart points for the selected range — hides timestamp line. */
  chartEmpty?: boolean;
  /** Preformatted timestamp under price (includes ", USD"); from chart data. */
  priceTimestampLabel?: string | null;
  /** Chart crosshair active — subtle emphasis on price row */
  chartHovering?: boolean;
  headerMeta: StockDetailHeaderMeta | null;
  headerMetaLoading: boolean;
};

export function StockHeader({
  ticker,
  periodLabel,
  periodLabelOverride = null,
  price,
  changePct,
  changeAbs,
  chartLoading,
  chartEmpty = false,
  priceTimestampLabel = null,
  chartHovering = false,
  headerMeta,
  headerMetaLoading,
}: Props) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const titleName = headerMeta?.fullName?.trim() ? headerMeta.fullName : meta.name;

  const serverLogo = headerMeta?.logoUrl?.trim() || meta.logoUrl?.trim() || "";
  const memLogo = readLogoMemory(symbol)?.trim() || "";

  // Track failed logo per "current serverLogo" without needing reset effects.
  const logoFailureKey = `${ticker}|${serverLogo}`;
  const [imgFailedForKey, setImgFailedForKey] = useState<string | null>(null);
  const imgFailed = imgFailedForKey === logoFailureKey;
  const logoSrc = imgFailed ? "" : serverLogo || memLogo;

  useEffect(() => {
    if (serverLogo) mergeLogoMemory(symbol, serverLogo);
  }, [symbol, serverLogo]);

  const anim = useSpringTriplet(
    { price, abs: changeAbs, pct: changePct },
    { stiffness: 520, damping: 38, epsilon: 1e-4 },
  );

  /** Watchlist count can differ between SSR and first client paint (DB vs serialized props); defer suffix to avoid hydration mismatch. */
  const [watchlistMetaReady, setWatchlistMetaReady] = useState(false);
  useEffect(() => {
    setWatchlistMetaReady(true);
  }, []);

  const hasChange = changePct != null && changeAbs != null && Number.isFinite(changePct) && Number.isFinite(changeAbs);
  const isPositive = hasChange ? changeAbs >= 0 : true;

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
          <Link href="/screener" className="transition-colors hover:text-[#09090B]">
            Stocks
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-[#09090B]">{symbol}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote favicon with onError fallback in-browser
            <img
              src={logoSrc}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
              onError={() => {
                setImgFailedForKey(logoFailureKey);
                mergeLogoMemory(symbol, null);
              }}
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] text-[18px] font-bold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
              {meta.ticker.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7 text-[#09090B] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
                {titleName}
              </h1>
              <span className="text-[14px] font-medium text-[#71717A]">{symbol}</span>
            </div>
            {headerMetaLoading ? (
              <div className="mt-1 h-4 max-w-[min(100%,28rem)] rounded bg-neutral-200/80 animate-pulse" aria-hidden />
            ) : (
              <p className="mt-1 text-[13px] leading-5 text-[#71717A]">
                <span className="whitespace-normal break-words">
                  {formatHeaderMetaSegment(headerMeta?.sector)}
                  <span className="text-[#D4D4D8]"> / </span>
                  {formatHeaderMetaSegment(headerMeta?.industry)}
                  <span className="text-[#D4D4D8]"> / </span>
                  {formatHeaderMetaSegment(headerMeta?.earningsDateDisplay)}
                  {watchlistMetaReady && headerMeta?.watchlistCount != null ? (
                    <>
                      <span className="text-[#D4D4D8]"> / </span>
                      {formatWatchlistsCountLabel(headerMeta.watchlistCount)}
                    </>
                  ) : null}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="group shrink-0">
          <WatchlistStarButton variant="detail" storageKey={symbol} label={symbol} />
        </div>
      </div>

      <div>
        <div
          className={`flex flex-wrap items-baseline gap-2 transition-[transform,opacity] duration-200 ease-out ${
            chartHovering ? "translate-y-px" : ""
          }`}
        >
          <span
            className={`text-[28px] font-semibold leading-9 tabular-nums text-[#09090B] transition-[transform] duration-200 ease-out ${
              chartHovering ? "scale-[1.01]" : "scale-100"
            }`}
          >
            {chartLoading || anim.price == null ? "—" : `$${anim.price.toFixed(2)}`}
          </span>
          <span
            className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
              hasChange ? (isPositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
            }`}
          >
            {chartLoading || !hasChange || anim.abs == null || anim.pct == null
              ? "—"
              : `${isPositive ? "+" : ""}${anim.abs.toFixed(2)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
          </span>
          <span className="text-[13px] text-[#71717A]">{periodLabelOverride ?? periodLabel}</span>
        </div>
        {chartLoading ? (
          <div className="mt-0.5 text-[12px] text-[#71717A]">Loading…</div>
        ) : chartEmpty ? null : priceTimestampLabel ? (
          <div className="mt-0.5 text-[12px] leading-4 text-[#71717A]">{priceTimestampLabel}</div>
        ) : null}
      </div>
    </div>
  );
}
