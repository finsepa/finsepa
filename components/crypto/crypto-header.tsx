"use client";

import { useEffect, useMemo, useState } from "react";

import { AssetPageHeaderActions } from "@/components/asset/asset-page-header-actions";
import { useSetMobileAssetTopbarSubtitle } from "@/components/layout/mobile-asset-topbar-context";
import { MobileAssetHeaderPrice } from "@/components/chart/mobile-asset-header-price";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { isPositivePriceChange, reconcilePriceChangePair } from "@/lib/chart/reconcile-price-change";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { withLogoDevTheme } from "@/lib/screener/company-logo-url";
import { useClientMounted, useLogoDevTheme } from "@/lib/theme/use-logo-dev-theme";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { formatCryptoUsd, formatCryptoUsdChangeAbs } from "@/lib/market/format-crypto-usd";
import { cryptoWatchlistKey } from "@/lib/watchlist/constants";

/** Per-symbol zoom inside the fixed 48×48 header frame (crypto marks carry baked-in padding). */
const CRYPTO_HEADER_LOGO_SCALE: Partial<Record<string, number>> = {
  BTC: 1.36,
  DOGE: 1.34,
  LTC: 1.32,
  BCH: 1.34,
};

function cryptoHeaderLogoScale(symbol: string): number {
  return CRYPTO_HEADER_LOGO_SCALE[symbol.trim().toUpperCase()] ?? 1.26;
}

type Props = {
  symbol: string;
  displayName: string;
  logoUrl: string | null;
  logoLetter: string;
  /** Period badge next to change (`Today` on overview = 1D session; holdings tab uses chart range). */
  periodLabel: string;
  periodLabelOverride?: string | null;
  /** Badge for period move when a range selection is active (e.g. `1Y`). */
  chartRangeLabel?: string;
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  selectionChangeAbs?: number | null;
  selectionChangePct?: number | null;
  chartLoading: boolean;
  chartEmpty?: boolean;
  priceTimestampLabel?: string | null;
  scrubPeriodLabel?: string | null;
  chartHovering?: boolean;
  headerLoading: boolean;
  /**
   * Stock-style header: change sits inline to the right of the price and the date/time timestamp
   * shows below (matches the equity header). Used for the live 24H crypto view (BTC, ETH).
   */
  stockStyleLayout?: boolean;
};

export function CryptoHeader({
  symbol,
  displayName,
  logoUrl,
  logoLetter,
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
  headerLoading,
  stockStyleLayout = false,
}: Props) {
  const logoTheme = useLogoDevTheme();
  const mounted = useClientMounted();
  const sym = symbol.trim().toUpperCase();
  const pairLabel = eodhdCryptoSpotTickerDisplay(sym);
  const serverLogo = logoUrl?.trim() ?? "";
  const logoFailureKey = `${sym}|${serverLogo}`;
  const [imgFailedForKey, setImgFailedForKey] = useState<string | null>(null);
  const memLogo = mounted ? (readLogoMemory(sym)?.trim() ?? "") : "";
  const imgFailed = imgFailedForKey === logoFailureKey;
  const logoBase = imgFailed ? "" : serverLogo || memLogo;
  const logoSrc = logoBase ? withLogoDevTheme(logoBase, logoTheme) : "";

  useEffect(() => {
    if (serverLogo) mergeLogoMemory(sym, serverLogo);
  }, [sym, serverLogo]);

  const springTarget = useMemo(() => {
    const reconciled = reconcilePriceChangePair(price, changeAbs, changePct);
    return { price, abs: reconciled.abs, pct: reconciled.pct };
  }, [price, changeAbs, changePct]);

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
  const wlKey = cryptoWatchlistKey(sym);

  useSetMobileAssetTopbarSubtitle({
    line1: sym,
    line2: headerLoading ? null : pairLabel,
    line2Loading: headerLoading,
  });

  const logoMark =
    headerLoading ?
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl border border-stroke bg-surface-muted" aria-hidden />
    : logoSrc ?
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stroke-muted bg-surface shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote logo */}
        <img
          src={logoSrc}
          alt=""
          width={48}
          height={48}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: `scale(${cryptoHeaderLogoScale(sym)})` }}
          onError={() => {
            setImgFailedForKey(logoFailureKey);
            mergeLogoMemory(sym, null);
          }}
        />
      </div>
    : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stroke bg-surface-muted text-[18px] font-bold text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
        {logoLetter.slice(0, 1)}
      </div>;

  const priceMotionClass = `transition-[transform,opacity] duration-200 ease-out ${
    chartHovering ? "translate-y-px" : ""
  }`;

  const periodLabelClass = "text-[13px] text-fg-muted";
  const desktopPeriodLabel = periodLabelOverride ?? periodLabel;
  const mobilePeriodLabel =
    chartHovering && scrubPeriodLabel?.trim() ? scrubPeriodLabel.trim() : desktopPeriodLabel;

  const buildChangeRow = (periodText: string) => (
    <div className="flex flex-wrap items-baseline gap-2">
      {hasSelectionSecondary ? (
        <>
          <span
            suppressHydrationWarning
            className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
              hasChange ? (isPositive ? "text-up" : "text-down") : "text-fg-muted"
            }`}
          >
            {chartLoading || !hasChange || anim.abs == null || anim.pct == null
              ? "—"
              : `${isPositive ? "+" : ""}${formatCryptoUsdChangeAbs(anim.abs, anim.price)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
          </span>
          {chartRangeLabel ? <span className={periodLabelClass}>{chartRangeLabel}</span> : null}
          <span className={periodLabelClass} aria-hidden>
            ·
          </span>
          <span
            suppressHydrationWarning
            className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
              isSelPositive ? "text-up" : "text-down"
            }`}
          >
            {`${isSelPositive ? "+" : ""}${formatCryptoUsdChangeAbs(selectionChangeAbs!, anim.price)} (${isSelPositive ? "+" : ""}${selectionChangePct!.toFixed(2)}%)`}
          </span>
          <span className={periodLabelClass}>Selected range</span>
        </>
      ) : (
        <>
          <span
            suppressHydrationWarning
            className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
              hasChange ? (isPositive ? "text-up" : "text-down") : "text-fg-muted"
            }`}
          >
            {chartLoading || !hasChange || anim.abs == null || anim.pct == null
              ? "—"
              : `${isPositive ? "+" : ""}${formatCryptoUsdChangeAbs(anim.abs, anim.price)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
          </span>
          <span className={periodLabelClass}>{periodText}</span>
        </>
      )}
    </div>
  );

  const changeRow = buildChangeRow(desktopPeriodLabel);
  const mobileChangeRow = buildChangeRow(mobilePeriodLabel);

  // Stock-style pieces: inline change chip (sits right of the price) + date/time row (below).
  const stockStyleChangeText =
    chartLoading || !hasChange || anim.abs == null || anim.pct == null
      ? "—"
      : `${isPositive ? "+" : ""}${formatCryptoUsdChangeAbs(anim.abs, anim.price)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`;

  const stockStyleChangeClass = `text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
    hasChange ? (isPositive ? "text-up" : "text-down") : "text-fg-muted"
  }`;

  const buildStockStyleChangeChip = (periodText: string) => (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0">
      <span suppressHydrationWarning className={stockStyleChangeClass}>
        {stockStyleChangeText}
      </span>
      {!hasSelectionSecondary ? <span className={periodLabelClass}>{periodText}</span> : null}
    </span>
  );

  const stockStyleMetaRow = hasSelectionSecondary ? (
    <div className="flex flex-wrap items-baseline gap-2">
      {chartRangeLabel ? <span className={periodLabelClass}>{chartRangeLabel}</span> : null}
      <span className={periodLabelClass} aria-hidden>
        ·
      </span>
      <span
        suppressHydrationWarning
        className={`text-[15px] font-medium tabular-nums transition-colors duration-200 ease-out ${
          isSelPositive ? "text-up" : "text-down"
        }`}
      >
        {`${isSelPositive ? "+" : ""}${formatCryptoUsdChangeAbs(selectionChangeAbs!, anim.price)} (${isSelPositive ? "+" : ""}${selectionChangePct!.toFixed(2)}%)`}
      </span>
      <span className={periodLabelClass}>Selected range</span>
    </div>
  ) : priceTimestampLabel && !chartEmpty ? (
    <p className={periodLabelClass} suppressHydrationWarning>
      {priceTimestampLabel}
    </p>
  ) : null;

  const stockStylePriceValue = (
    <span
      suppressHydrationWarning
      className={`text-[28px] font-semibold leading-9 tabular-nums text-fg transition-[transform] duration-200 ease-out ${
        chartHovering ? "scale-[1.01]" : "scale-100"
      }`}
    >
      {chartLoading || anim.price == null ? "—" : formatCryptoUsd(anim.price)}
    </span>
  );

  const priceValue = (
    <span
      suppressHydrationWarning
      className={`block text-[28px] font-semibold leading-9 tabular-nums text-fg transition-[transform] duration-200 ease-out ${
        chartHovering ? "scale-[1.01]" : "scale-100"
      }`}
    >
      {chartLoading || anim.price == null ? "—" : formatCryptoUsd(anim.price)}
    </span>
  );

  const mobilePriceValue = (
    <MobileAssetHeaderPrice
      value={price}
      loading={chartLoading}
      variant="crypto"
      chartHovering={chartHovering}
    />
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className={`min-w-0 flex-1 space-y-1 ${priceMotionClass}`}>
          <h1 className="truncate text-[17px] font-semibold leading-6 text-fg">{displayName}</h1>
          {stockStyleLayout ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                {mobilePriceValue}
                {buildStockStyleChangeChip(mobilePeriodLabel)}
              </div>
              {stockStyleMetaRow}
            </>
          ) : (
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
              <h1 className="text-[20px] font-semibold leading-7 text-fg [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
                {displayName}
              </h1>
              {headerLoading ? (
                <div className="mt-1 h-4 max-w-[min(100%,28rem)] rounded bg-skeleton animate-pulse" aria-hidden />
              ) : (
                <p className="mt-1 text-[13px] leading-5 text-fg-muted">
                  <span className="whitespace-normal break-words">{pairLabel}</span>
                </p>
              )}
            </div>
          </div>

          <AssetPageHeaderActions
            watchlistStorageKey={wlKey}
            watchlistLabel={sym}
            transactionSymbol={sym}
            transactionName={displayName}
          />
        </div>

        <div className={`space-y-1 ${priceMotionClass}`}>
          {stockStyleLayout ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                {stockStylePriceValue}
                {buildStockStyleChangeChip(desktopPeriodLabel)}
              </div>
              {stockStyleMetaRow}
            </>
          ) : (
            <>
              {priceValue}
              {changeRow}
            </>
          )}
        </div>
      </div>
    </>
  );
}
