"use client";

import { Plus } from "@/lib/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import {
  getStockListingSubtitleParts,
  type StockDetailHeaderMeta,
} from "@/lib/market/stock-header-meta";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import { formatUsdAmountGrouped2dp, formatUsdCompact, formatUsdPrice } from "@/lib/market/key-stats-basic-format";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";

type Props = {
  ticker: string;
  /** Period badge next to change (e.g. `Today` for session / 1D header, or holdings range on that tab). */
  periodLabel: string;
  /** When set (e.g. drag selection), replaces `periodLabel` in the price row. */
  periodLabelOverride?: string | null;
  /** Badge for period move when a range selection is active (e.g. chart `1Y`). */
  chartRangeLabel?: string;
  /** Latest close from chart series for the active range (not crosshair hover). */
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  /** P/L over the dragged window (shown after period move when selection is active). */
  selectionChangeAbs?: number | null;
  selectionChangePct?: number | null;
  chartLoading: boolean;
  /** No chart points for the selected range — hides timestamp line. */
  chartEmpty?: boolean;
  /** Preformatted timestamp under price (includes ", USD"); from chart data. */
  priceTimestampLabel?: string | null;
  /** Reserved for future chart emphasis (crosshair no longer drives header price). */
  chartHovering?: boolean;
  headerMeta: StockDetailHeaderMeta | null;
  headerMetaLoading: boolean;
  /** Overview chart metric — formats the large header number as price vs market cap. */
  headerChartMetric?: StockChartSeries;
};

export function StockHeader({
  ticker,
  periodLabel,
  periodLabelOverride = null,
  chartRangeLabel,
  price,
  changePct,
  changeAbs,
  selectionChangeAbs = null,
  selectionChangePct = null,
  chartLoading,
  chartEmpty = false,
  priceTimestampLabel = null,
  chartHovering = false,
  headerMeta,
  headerMetaLoading,
  headerChartMetric = "price",
}: Props) {
  const { openNewTransactionWithPreset } = usePortfolioWorkspace();
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const exchange = headerMeta?.exchange?.trim() ?? "";
  const listingSubtitle = getStockListingSubtitleParts({
    ticker: symbol,
    exchange,
    countryIso: headerMeta?.countryIso,
  });
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

  const settledTripletRef = useRef<{ price: number; abs: number; pct: number } | null>(null);
  const settledTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    settledTimestampRef.current = null;
  }, [ticker]);
  const springTarget = useMemo(() => {
    const hasFull =
      price != null &&
      changeAbs != null &&
      changePct != null &&
      Number.isFinite(price) &&
      Number.isFinite(changeAbs) &&
      Number.isFinite(changePct);
    if (hasFull && !chartLoading) {
      settledTripletRef.current = { price, abs: changeAbs, pct: changePct };
      return { price, abs: changeAbs, pct: changePct };
    }
    if (chartLoading && settledTripletRef.current) {
      return settledTripletRef.current;
    }
    return { price, abs: changeAbs, pct: changePct };
  }, [chartLoading, price, changeAbs, changePct]);

  const anim = useSpringTriplet(springTarget, { stiffness: 520, damping: 38, epsilon: 1e-4 });

  if (priceTimestampLabel) {
    settledTimestampRef.current = priceTimestampLabel;
  }
  const displayTimestamp = priceTimestampLabel ?? settledTimestampRef.current;
  const showTimestampLoading = chartLoading && anim.price == null && displayTimestamp == null;

  const hasChange = changePct != null && changeAbs != null && Number.isFinite(changePct) && Number.isFinite(changeAbs);
  const isPositive = hasChange ? changeAbs >= 0 : true;
  const hasSelectionSecondary =
    selectionChangeAbs != null &&
    selectionChangePct != null &&
    Number.isFinite(selectionChangeAbs) &&
    Number.isFinite(selectionChangePct);
  const isSelPositive = hasSelectionSecondary ? selectionChangeAbs! >= 0 : true;
  const mainPriceClass =
    headerChartMetric === "return" && !chartLoading && anim.price != null && hasChange
      ? isPositive
        ? "text-[#16A34A]"
        : "text-[#DC2626]"
      : "text-[#09090B]";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote favicon with onError fallback in-browser
            <img
              src={logoSrc}
              alt=""
              width={48}
              height={48}
              className={`h-12 w-12 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]${symbol === "AAPL" ? " p-1.5" : ""}`}
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
            <h1 className="text-[20px] font-semibold leading-7 text-[#09090B] [display:-webkit-box] [-webkit-line-clamp:1] sm:[-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
              {titleName}
            </h1>
            {headerMetaLoading ? (
              <div className="mt-0.5 h-4 w-24 rounded bg-neutral-200/80 animate-pulse" aria-hidden />
            ) : (
              <p className="mt-0.5 text-[13px] leading-5 text-[#71717A]">
                {listingSubtitle.ticker}
                {listingSubtitle.exchange ? <> · {listingSubtitle.exchange}</> : null}
                {listingSubtitle.countryFlag ? (
                  <>
                    {" · "}
                    <span
                      className="inline-block align-[-2px] text-[16px] leading-none"
                      aria-hidden
                    >
                      {listingSubtitle.countryFlag}
                    </span>
                  </>
                ) : null}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="group shrink-0">
            <WatchlistStarButton variant="detail" storageKey={symbol} label={symbol} />
          </div>
          <button
            type="button"
            onClick={() =>
              openNewTransactionWithPreset({
                symbol: symbol.trim().toUpperCase(),
                name: titleName.trim() || symbol,
              })
            }
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB] text-[13px] font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 focus-visible:ring-offset-2 sm:w-auto sm:gap-1.5 sm:px-3.5"
            aria-label="Add Trade"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="hidden sm:inline">Add Trade</span>
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div
          className={`flex flex-wrap items-baseline gap-2 transition-[transform,opacity] duration-200 ease-out ${
            chartHovering ? "translate-y-px" : ""
          }`}
        >
          <span
            className={`text-[28px] font-semibold leading-9 tabular-nums transition-[transform] duration-200 ease-out ${mainPriceClass} ${
              chartHovering ? "scale-[1.01]" : "scale-100"
            }`}
          >
            {anim.price == null
              ? "—"
              : headerChartMetric === "marketCap"
                ? formatUsdCompact(anim.price)
                : headerChartMetric === "return"
                  ? (() => {
                      const r = (anim.price ?? 100) - 100;
                      const sign = r > 0 ? "+" : r < 0 ? "−" : "";
                      return `${sign}${Math.abs(r).toFixed(2)}%`;
                    })()
                  : formatUsdPrice(anim.price)}
          </span>
          {headerChartMetric === "return" && !hasSelectionSecondary ? null : hasSelectionSecondary ? (
            <>
              <span
                className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
                  hasChange ? (isPositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
                }`}
              >
                {!hasChange || anim.abs == null || anim.pct == null
                  ? "—"
                  : headerChartMetric === "marketCap"
                    ? `${isPositive ? "+" : ""}${formatUsdCompact(anim.abs)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`
                    : headerChartMetric === "return"
                      ? `${isPositive ? "+" : ""}${anim.abs.toFixed(2)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`
                      : `${isPositive ? "+" : ""}${formatUsdAmountGrouped2dp(anim.abs)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
              </span>
              {chartRangeLabel ? (
                <span className="text-[13px] text-[#71717A]">{chartRangeLabel}</span>
              ) : null}
              <span className="text-[13px] text-[#71717A]" aria-hidden>
                ·
              </span>
              <span
                className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
                  isSelPositive ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {headerChartMetric === "marketCap"
                  ? `${isSelPositive ? "+" : ""}${formatUsdCompact(selectionChangeAbs!)} (${isSelPositive ? "+" : ""}${selectionChangePct!.toFixed(2)}%)`
                  : `${isSelPositive ? "+" : ""}${formatUsdAmountGrouped2dp(selectionChangeAbs!)} (${isSelPositive ? "+" : ""}${selectionChangePct!.toFixed(2)}%)`}
              </span>
              <span className="text-[13px] text-[#71717A]">Selected range</span>
            </>
          ) : (
            <>
              <span
                className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
                  hasChange ? (isPositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
                }`}
              >
                {!hasChange || anim.abs == null || anim.pct == null
                  ? "—"
                  : headerChartMetric === "marketCap"
                    ? `${isPositive ? "+" : ""}${formatUsdCompact(anim.abs)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`
                    : `${isPositive ? "+" : ""}${formatUsdAmountGrouped2dp(anim.abs)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
              </span>
              <span className="text-[13px] text-[#71717A]">{periodLabelOverride ?? periodLabel}</span>
            </>
          )}
        </div>
        {!chartEmpty || displayTimestamp != null || showTimestampLoading ? (
          <div className="mt-0.5 min-h-4 text-[12px] leading-4 text-[#71717A]">
            {showTimestampLoading ? (
              "Loading…"
            ) : displayTimestamp ? (
              <span className="min-w-0">{displayTimestamp}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
