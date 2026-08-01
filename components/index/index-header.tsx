"use client";

import { useMemo } from "react";

import { AssetPageHeaderActions } from "@/components/asset/asset-page-header-actions";
import { MobileAssetHeaderPrice } from "@/components/chart/mobile-asset-header-price";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { useSetMobileAssetTopbarSubtitle } from "@/components/layout/mobile-asset-topbar-context";
import { CompanyLogo } from "@/components/screener/company-logo";
import { isPositivePriceChange, reconcilePriceChangePair } from "@/lib/chart/reconcile-price-change";
import { formatSignedPercent2dp } from "@/lib/market/key-stats-basic-format";
import { indexWatchlistKey } from "@/lib/watchlist/constants";

type Props = {
  symbol: string;
  displayName: string;
  displayCode: string;
  periodLabel: string;
  periodLabelOverride?: string | null;
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
};

function formatIndexLevel(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAbsChange(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function IndexHeader({
  symbol,
  displayName,
  displayCode,
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
}: Props) {
  const wlKey = indexWatchlistKey(symbol);

  useSetMobileAssetTopbarSubtitle({
    line1: displayName,
    line2: headerLoading ? null : displayCode,
    line2Loading: headerLoading,
  });

  const springTarget = useMemo(() => {
    const reconciled = reconcilePriceChangePair(price, changeAbs, changePct);
    return { price, abs: reconciled.abs, pct: reconciled.pct };
  }, [price, changeAbs, changePct]);

  const anim = useSpringTriplet(springTarget, { stiffness: 520, damping: 38, epsilon: 1e-4 });
  const hasChange =
    anim.abs != null && anim.pct != null && Number.isFinite(anim.abs) && Number.isFinite(anim.pct);
  const isPositive = isPositivePriceChange(anim.abs, anim.pct);
  const hasSelectionSecondary =
    selectionChangeAbs != null &&
    selectionChangePct != null &&
    Number.isFinite(selectionChangeAbs) &&
    Number.isFinite(selectionChangePct);

  const periodLabelClass = "text-[13px] text-fg-muted";
  const desktopPeriodLabel = periodLabelOverride ?? periodLabel;
  const mobilePeriodLabel =
    chartHovering && scrubPeriodLabel?.trim() ? scrubPeriodLabel.trim() : desktopPeriodLabel;

  const logoMark = (
    <CompanyLogo
      name={displayName}
      logoUrl=""
      symbol={displayCode}
      size="lg"
      className="rounded-2xl shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]"
    />
  );

  const changeClass = `text-[15px] font-medium tabular-nums ${
    hasChange ? (isPositive ? "text-up" : "text-down") : "text-fg-muted"
  }`;

  const changeRow = (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={changeClass} suppressHydrationWarning>
        {chartLoading || !hasChange
          ? "—"
          : `${formatAbsChange(anim.abs)} (${formatSignedPercent2dp(anim.pct!)})`}
      </span>
      <span className={periodLabelClass}>{mobilePeriodLabel}</span>
      {chartRangeLabel ? <span className={periodLabelClass}>{chartRangeLabel}</span> : null}
      {hasSelectionSecondary ? (
        <span className={periodLabelClass}>
          Selection {formatAbsChange(selectionChangeAbs)} ({formatSignedPercent2dp(selectionChangePct!)})
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-[17px] font-semibold leading-6 text-fg">{displayName}</h1>
          <MobileAssetHeaderPrice value={anim.price} loading={headerLoading || chartLoading} />
          {changeRow}
          {!chartEmpty && priceTimestampLabel ? (
            <p className="text-[12px] leading-4 text-fg-muted">{priceTimestampLabel}</p>
          ) : null}
        </div>
        {logoMark}
      </div>

      <div className="hidden space-y-3 md:block">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {logoMark}
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold leading-7 text-fg">{displayName}</h1>
              <p className="mt-1 text-[13px] leading-5 text-fg-muted">{displayCode}</p>
            </div>
          </div>
          <AssetPageHeaderActions
            watchlistStorageKey={wlKey}
            watchlistLabel={displayName}
            transactionSymbol={displayCode}
            transactionName={displayName}
            hideAddTrade
          />
        </div>

        <div className="space-y-1">
          <p className="text-[32px] font-semibold leading-9 tabular-nums text-fg" suppressHydrationWarning>
            {headerLoading || (chartLoading && anim.price == null) ? "—" : formatIndexLevel(anim.price)}
          </p>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={changeClass} suppressHydrationWarning>
              {chartLoading || !hasChange
                ? "—"
                : `${formatAbsChange(anim.abs)} (${formatSignedPercent2dp(anim.pct!)})`}
            </span>
            <span className={periodLabelClass}>{desktopPeriodLabel}</span>
            {chartRangeLabel ? <span className={periodLabelClass}>{chartRangeLabel}</span> : null}
          </div>
          {!chartEmpty && priceTimestampLabel ? (
            <p className="text-[12px] leading-4 text-fg-muted">{priceTimestampLabel}</p>
          ) : null}
          {hasSelectionSecondary ? (
            <p className="text-[12px] font-medium tabular-nums text-fg-muted">
              Selection {formatAbsChange(selectionChangeAbs)} ({formatSignedPercent2dp(selectionChangePct!)})
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
