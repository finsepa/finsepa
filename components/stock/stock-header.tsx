"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { MobileAssetHeaderPrice } from "@/components/chart/mobile-asset-header-price";
import { AssetPageHeaderActions } from "@/components/asset/asset-page-header-actions";
import { useSetMobileAssetTopbarSubtitle } from "@/components/layout/mobile-asset-topbar-context";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import {
  getStockListingSubtitleParts,
  formatStockTopbarSecondaryLine,
  type StockDetailHeaderMeta,
} from "@/lib/market/stock-header-meta";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import { formatUsdAmountGrouped2dp, formatUsdCompact, formatUsdPrice } from "@/lib/market/key-stats-basic-format";

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
  /** Mobile chart scrub: date string for the period badge (matches chart bottom label). */
  scrubPeriodLabel?: string | null;
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
  scrubPeriodLabel = null,
  chartHovering = false,
  headerMeta,
  headerMetaLoading,
  headerChartMetric = "price",
}: Props) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const exchange = headerMeta?.exchange?.trim() ?? "";
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

  useEffect(() => {
    settledTripletRef.current = null;
  }, [ticker, headerChartMetric]);

  const springTarget = useMemo(() => {
    if (chartLoading) {
      return { price: null, abs: null, pct: null };
    }
    const hasFull =
      price != null &&
      changeAbs != null &&
      changePct != null &&
      Number.isFinite(price) &&
      Number.isFinite(changeAbs) &&
      Number.isFinite(changePct);
    if (hasFull) {
      settledTripletRef.current = { price, abs: changeAbs, pct: changePct };
      return { price, abs: changeAbs, pct: changePct };
    }
    return { price, abs: changeAbs, pct: changePct };
  }, [chartLoading, price, changeAbs, changePct]);

  const anim = useSpringTriplet(springTarget, { stiffness: 520, damping: 38, epsilon: 1e-4 });

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

  const listingSubtitle = getStockListingSubtitleParts({
    ticker: symbol,
    exchange,
    countryIso: headerMeta?.countryIso,
  });
  const topbarLine2 = formatStockTopbarSecondaryLine(listingSubtitle);
  const topbarLine2Loading =
    headerMetaLoading ||
    (topbarLine2 == null && (headerMeta == null || !headerMeta.exchange?.trim()));

  useSetMobileAssetTopbarSubtitle({
    line1: listingSubtitle.ticker,
    line2: topbarLine2,
    line2Exchange: listingSubtitle.exchange,
    line2CountryFlag: listingSubtitle.countryFlag,
    line2Loading: topbarLine2Loading,
  });

  const logoMark =
    logoSrc ?
      // eslint-disable-next-line @next/next/no-img-element -- remote favicon with onError fallback in-browser
      <img
        src={logoSrc}
        alt=""
        width={48}
        height={48}
        className={`h-12 w-12 shrink-0 rounded-2xl border border-neutral-200 bg-white object-contain shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]${symbol === "AAPL" ? " p-1.5" : ""}`}
        onError={() => {
          setImgFailedForKey(logoFailureKey);
          mergeLogoMemory(symbol, null);
        }}
      />
    : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E4E4E7] bg-[#F4F4F5] text-[18px] font-bold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
        {meta.ticker.slice(0, 1)}
      </div>;

  const priceMotionClass = `transition-[transform,opacity] duration-200 ease-out ${
    chartHovering ? "translate-y-px" : ""
  }`;

  const formattedPrice =
    anim.price == null
      ? "—"
      : headerChartMetric === "marketCap"
        ? formatUsdCompact(anim.price)
        : headerChartMetric === "return"
          ? (() => {
              const r = (anim.price ?? 100) - 100;
              const sign = r > 0 ? "+" : r < 0 ? "−" : "";
              return `${sign}${Math.abs(r).toFixed(2)}%`;
            })()
          : formatUsdPrice(anim.price);

  const periodLabelClass = "text-[13px] text-[#71717A]";
  const desktopPeriodLabel = periodLabelOverride ?? periodLabel;
  const mobilePeriodLabel =
    chartHovering && scrubPeriodLabel?.trim() ? scrubPeriodLabel.trim() : desktopPeriodLabel;

  const buildChangeRow = (periodText: string) =>
    headerChartMetric === "return" && !hasSelectionSecondary ? null : (
      <div className="flex flex-wrap items-baseline gap-2">
        {hasSelectionSecondary ? (
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
            {chartRangeLabel ? <span className={periodLabelClass}>{chartRangeLabel}</span> : null}
            <span className={periodLabelClass} aria-hidden>
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
            <span className={periodLabelClass}>Selected range</span>
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
            <span className={periodLabelClass}>{periodText}</span>
          </>
        )}
      </div>
    );

  const changeRow = buildChangeRow(desktopPeriodLabel);
  const mobileChangeRow = buildChangeRow(mobilePeriodLabel);

  const priceLoadingSkeleton = (
    <div className="space-y-1" aria-busy="true" aria-label="Loading chart value">
      <div className="h-9 w-[7.5rem] rounded-md bg-neutral-200/80 animate-pulse" aria-hidden />
      {headerChartMetric === "return" ? null : (
        <div className="h-5 w-[10rem] rounded-md bg-neutral-200/80 animate-pulse" aria-hidden />
      )}
    </div>
  );

  const priceValue = (
    <span
      className={`block text-[28px] font-semibold leading-9 tabular-nums transition-[transform] duration-200 ease-out ${mainPriceClass} ${
        chartHovering ? "scale-[1.01]" : "scale-100"
      }`}
    >
      {formattedPrice}
    </span>
  );

  const mobilePriceValue = (
    <MobileAssetHeaderPrice
      value={price}
      loading={chartLoading}
      chartMetric={headerChartMetric}
      className={mainPriceClass}
      chartHovering={chartHovering}
    />
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className={`min-w-0 flex-1 space-y-0.5 ${priceMotionClass}`}>
          <h1 className="truncate text-[16px] font-medium leading-5 text-[#09090B]">{titleName}</h1>
          {chartLoading ? priceLoadingSkeleton : (
            <>
              {mobilePriceValue}
              {mobileChangeRow}
            </>
          )}
        </div>
        {logoMark}
      </div>

      <div className="hidden space-y-3 md:block">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {logoMark}
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold leading-7 text-[#09090B] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
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
                      <span className="inline-block align-[-2px] text-[16px] leading-none" aria-hidden>
                        {listingSubtitle.countryFlag}
                      </span>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>

          <AssetPageHeaderActions
            watchlistStorageKey={symbol}
            watchlistLabel={symbol}
            transactionSymbol={symbol}
            transactionName={titleName}
          />
        </div>

        <div className="min-w-0">
          {chartLoading ? priceLoadingSkeleton : (
            <div className={`space-y-1 ${priceMotionClass}`}>
              {priceValue}
              {changeRow}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
