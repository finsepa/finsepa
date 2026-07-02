"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { isPositivePriceChange, reconcilePriceChangePair } from "@/lib/chart/reconcile-price-change";
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
import type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";
import { formatUsdCompact, formatUsdPrice, formatSignedUsdAmountGrouped2dp, formatSignedPercent2dp } from "@/lib/market/key-stats-basic-format";
import { StockExtendedHoursPrice } from "@/components/stock/stock-extended-hours-price";
import { ScreenerRankBadge } from "@/components/earnings/screener-rank-badge";

type Props = {
  ticker: string;
  /** Period badge next to change (e.g. `Today` for session / 1D header, or holdings range on that tab). */
  periodLabel: string;
  /** When set (e.g. drag selection), replaces `periodLabel` in the price row. */
  periodLabelOverride?: string | null;
  /** Badge for period move when a range selection is active (e.g. chart `1Y`). */
  chartRangeLabel?: string;
  /** Grey label after inline move (e.g. `Today`, `5D`) — overview chart range. */
  movementRangeBadge?: string | null;
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
  /** US pre/post extended-hours quote (polled ~60s). */
  extendedHours?: StockExtendedHoursHeader | null;
  extendedHoursLoading?: boolean;
  showExtendedHours?: boolean;
};

function formatHeaderChangeAbs(abs: number, metric: StockChartSeries): string {
  if (metric === "marketCap") {
    const sign = abs > 0 ? "+" : abs < 0 ? "-" : "";
    return `${sign}${formatUsdCompact(Math.abs(abs))}`;
  }
  if (metric === "return") {
    if (abs > 0) return `+${abs.toFixed(2)}`;
    return abs.toFixed(2);
  }
  return formatSignedUsdAmountGrouped2dp(abs);
}

function formatHeaderChangePair(abs: number, pct: number, metric: StockChartSeries): string {
  return `${formatHeaderChangeAbs(abs, metric)} (${formatSignedPercent2dp(pct)})`;
}

export function StockHeader({
  ticker,
  periodLabel,
  periodLabelOverride = null,
  chartRangeLabel,
  movementRangeBadge = null,
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
  extendedHours = null,
  extendedHoursLoading = false,
  showExtendedHours = false,
}: Props) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const exchange = headerMeta?.exchange?.trim() ?? "";
  const titleName = headerMeta?.fullName?.trim() ? headerMeta.fullName : meta.name;
  const screenerRank = headerMeta?.screenerRank ?? null;

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
    const reconciled = reconcilePriceChangePair(price, changeAbs, changePct);
    const resolvedPrice = price;
    const resolvedAbs = reconciled.abs;
    const resolvedPct = reconciled.pct;
    const hasFull =
      resolvedPrice != null &&
      resolvedAbs != null &&
      resolvedPct != null &&
      Number.isFinite(resolvedPrice) &&
      Number.isFinite(resolvedAbs) &&
      Number.isFinite(resolvedPct);
    if (hasFull) {
      settledTripletRef.current = { price: resolvedPrice, abs: resolvedAbs, pct: resolvedPct };
      return { price: resolvedPrice, abs: resolvedAbs, pct: resolvedPct };
    }
    return { price: resolvedPrice, abs: resolvedAbs, pct: resolvedPct };
  }, [chartLoading, price, changeAbs, changePct]);

  const anim = useSpringTriplet(springTarget, { stiffness: 520, damping: 38, epsilon: 1e-4 });

  const hasChange = changePct != null && changeAbs != null && Number.isFinite(changePct) && Number.isFinite(changeAbs);
  const isPositive = isPositivePriceChange(anim.abs, anim.pct);
  const hasSelectionSecondary =
    selectionChangeAbs != null &&
    selectionChangePct != null &&
    Number.isFinite(selectionChangeAbs) &&
    Number.isFinite(selectionChangePct);
  const isSelPositive = hasSelectionSecondary
    ? isPositivePriceChange(selectionChangeAbs, selectionChangePct)
    : true;
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

  const showPeriodChange = headerChartMetric !== "return" || hasSelectionSecondary;

  /** Price may hydrate from SSR/performance before range P/L is ready — skeleton the change chip. */
  const changePending =
    showPeriodChange &&
    !hasSelectionSecondary &&
    !chartEmpty &&
    (chartLoading || (price != null && Number.isFinite(price) && !hasChange));

  const periodChangeValue =
    !hasChange || anim.abs == null || anim.pct == null
      ? "—"
      : formatHeaderChangePair(anim.abs, anim.pct, headerChartMetric);

  const periodChangeClass = `text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
    hasChange ? (isPositive ? "text-[#16A34A]" : "text-[#DC2626]") : "text-[#71717A]"
  }`;

  const inlinePeriodChange = showPeriodChange ? (
    changePending ? (
      <div
        className="h-5 w-[8rem] shrink-0 rounded-md bg-neutral-200/80 animate-pulse"
        aria-busy="true"
        aria-label="Loading price change"
      />
    ) : (
      <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <span className={periodChangeClass}>{periodChangeValue}</span>
        {movementRangeBadge && !hasSelectionSecondary ? (
          <span className={periodLabelClass}>{movementRangeBadge}</span>
        ) : null}
      </span>
    )
  ) : null;

  const buildPeriodMetaRow = (periodText: string) => {
    if (!showPeriodChange) return null;
    if (hasSelectionSecondary) {
      return (
        <div className="flex flex-wrap items-baseline gap-2">
          {chartRangeLabel ? <span className={periodLabelClass}>{chartRangeLabel}</span> : null}
          <span className={periodLabelClass} aria-hidden>
            ·
          </span>
          <span
            className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
              isSelPositive ? "text-[#16A34A]" : "text-[#DC2626]"
            }`}
          >
            {formatHeaderChangePair(selectionChangeAbs!, selectionChangePct!, headerChartMetric)}
          </span>
          <span className={periodLabelClass}>Selected range</span>
        </div>
      );
    }
    return <p className={periodLabelClass}>{periodText}</p>;
  };

  const periodMetaRow = buildPeriodMetaRow(desktopPeriodLabel);
  const mobilePeriodMetaRow = buildPeriodMetaRow(mobilePeriodLabel);

  const showExtendedHoursColumn =
    showExtendedHours && headerChartMetric === "price" && (extendedHoursLoading || extendedHours != null);

  const priceLoadingSkeleton = (
    <div className="space-y-1" aria-busy="true" aria-label="Loading chart value">
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="h-9 w-[7.5rem] rounded-md bg-neutral-200/80 animate-pulse" aria-hidden />
        {showPeriodChange ? (
          <div className="h-5 w-[8rem] rounded-md bg-neutral-200/80 animate-pulse" aria-hidden />
        ) : null}
      </div>
      {showPeriodChange ? (
        <div className="h-4 w-[14rem] rounded-md bg-neutral-200/80 animate-pulse" aria-hidden />
      ) : null}
    </div>
  );

  const priceValue = (
    <span
      className={`text-[28px] font-semibold leading-9 tabular-nums transition-[transform] duration-200 ease-out ${mainPriceClass} ${
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

  const mainPriceBlock = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {priceValue}
        {inlinePeriodChange}
      </div>
      {periodMetaRow}
    </div>
  );

  const mobileMainPriceBlock = (
    <div className="min-w-0">
      <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ${priceMotionClass}`}>
        {mobilePriceValue}
        {inlinePeriodChange}
      </div>
      {mobilePeriodMetaRow}
    </div>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className={`min-w-0 flex-1 space-y-0.5 ${priceMotionClass}`}>
          <h1 className="truncate text-[16px] font-medium leading-5 text-[#09090B]">
            <span className="inline-flex min-w-0 max-w-full items-center gap-2">
              <span className="truncate">{titleName}</span>
              {screenerRank != null ? <ScreenerRankBadge rank={screenerRank} size="sm" /> : null}
            </span>
          </h1>
          {chartLoading ? priceLoadingSkeleton : (
            <>
              {showExtendedHoursColumn ? (
                <div className={`flex flex-col gap-2 ${priceMotionClass}`}>
                  {mobileMainPriceBlock}
                  <StockExtendedHoursPrice quote={extendedHours} loading={extendedHoursLoading} />
                </div>
              ) : (
                mobileMainPriceBlock
              )}
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
              <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">
                <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2">
                  <span className="[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
                    {titleName}
                  </span>
                  {screenerRank != null ? <ScreenerRankBadge rank={screenerRank} /> : null}
                </span>
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
            <div className={`flex flex-wrap items-end gap-5 ${priceMotionClass}`}>
              {mainPriceBlock}
              {showExtendedHoursColumn ? (
                <StockExtendedHoursPrice quote={extendedHours} loading={extendedHoursLoading} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
