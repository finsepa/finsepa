"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { AssetPageHeaderActions } from "@/components/asset/asset-page-header-actions";
import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { CryptoBreadcrumbs } from "@/components/crypto/crypto-breadcrumbs";
import { CryptoDetailTabNav } from "@/components/crypto/crypto-detail-tab-nav";
import { CurrencyBreadcrumbs } from "@/components/currency/currency-breadcrumbs";
import { ScreenerRankBadge } from "@/components/earnings/screener-rank-badge";
import { IndexBreadcrumbs } from "@/components/index/index-breadcrumbs";
import { SkeletonBox } from "@/components/markets/skeleton";
import { CompanyLogo } from "@/components/screener/company-logo";
import { ChartControls } from "@/components/stock/chart-controls";
import { KeyIndicatorsSkeleton } from "@/components/stock/key-indicators-skeleton";
import { StockBreadcrumbs } from "@/components/stock/stock-breadcrumbs";
import { StockDetailTabNav } from "@/components/stock/stock-detail-tab-nav";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { getStockListingSubtitleParts } from "@/lib/market/stock-header-meta";
import {
  getPendingAssetShell,
  parseAssetPathname,
  pendingAssetShellMatchesPath,
  subscribePendingAssetShell,
  type PendingAssetShell,
  type PendingAssetShellKind,
} from "@/lib/navigation/pending-asset-shell";
import { cryptoWatchlistKey, indexWatchlistKey } from "@/lib/watchlist/constants";
import { cn } from "@/lib/utils";

function formatShellPrice(price: number, kind: PendingAssetShellKind): string {
  if (kind === "currency") {
    const digits = price >= 20 ? 2 : 4;
    return price.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  if (kind === "crypto" && price > 0 && price < 1) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShellChangePct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function usePendingAssetShellSnapshot(): PendingAssetShell | null {
  return useSyncExternalStore(subscribePendingAssetShell, getPendingAssetShell, () => null);
}

function noop() {}

function ShellHeader({
  kind,
  symbol,
  pending,
}: {
  kind: PendingAssetShellKind;
  symbol: string;
  pending: PendingAssetShell | null;
}) {
  const stockMeta = kind === "stock" ? getStockDetailMetaFromTicker(symbol) : null;
  const displayName =
    pending?.name?.trim() ||
    stockMeta?.name?.trim() ||
    (kind === "crypto" ? eodhdCryptoSpotTickerDisplay(symbol) : symbol);
  const displaySym =
    kind === "crypto" ? eodhdCryptoSpotTickerDisplay(symbol) : symbol;
  const logoUrl = pending?.logoUrl ?? stockMeta?.logoUrl ?? "";
  const hasPrice = pending?.price != null && Number.isFinite(pending.price);
  const hasChange = pending?.changePct != null && Number.isFinite(pending.changePct);
  const up = hasChange && pending!.changePct! > 0;
  const down = hasChange && pending!.changePct! < 0;
  const screenerRank =
    pending?.screenerRank != null && pending.screenerRank > 0 ? pending.screenerRank : null;

  const listingSubtitle = kind === "stock" ? null : displaySym;

  const wlKey =
    kind === "crypto"
      ? cryptoWatchlistKey(symbol)
      : kind === "index"
        ? indexWatchlistKey(symbol)
        : symbol;

  const titleWithRank = (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <span className="[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
        {displayName}
      </span>
      {screenerRank != null ? <ScreenerRankBadge rank={screenerRank} /> : null}
    </span>
  );

  const priceBlock = hasPrice ? (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[28px] font-semibold leading-9 tabular-nums text-fg">
        {formatShellPrice(pending!.price!, kind)}
      </span>
      {hasChange ? (
        <span
          className={cn(
            "text-[15px] font-medium tabular-nums",
            up ? "text-up" : down ? "text-down" : "text-fg-muted",
          )}
        >
          {formatShellChangePct(pending!.changePct!)}
        </span>
      ) : null}
    </div>
  ) : (
    <div className="space-y-1" aria-busy="true" aria-label="Loading price">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <SkeletonBox className="h-9 w-[7.5rem] rounded-md" />
        <SkeletonBox className="h-5 w-[5rem] rounded-md" />
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className="truncate text-[16px] font-medium leading-5 text-fg">
            <span className="inline-flex min-w-0 max-w-full items-center gap-2">
              <span className="truncate">{displayName}</span>
              {screenerRank != null ? <ScreenerRankBadge rank={screenerRank} size="sm" /> : null}
            </span>
          </h1>
          {priceBlock}
        </div>
        <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={symbol} size="lg" className="rounded-2xl" />
      </div>

      <div className="hidden space-y-5 md:block">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <CompanyLogo
              name={displayName}
              logoUrl={logoUrl}
              symbol={symbol}
              size="lg"
              className="rounded-2xl shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]"
            />
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold leading-7 text-fg">{titleWithRank}</h1>
              <p className="mt-0.5 text-[13px] leading-5 text-fg-muted">
                {kind === "stock" ? (
                  (() => {
                    const parts = getStockListingSubtitleParts({
                      ticker: symbol,
                      exchange: pending?.exchange,
                      countryIso: pending?.countryIso ?? (pending ? "US" : null),
                    });
                    return (
                      <>
                        {parts.ticker}
                        {parts.exchange ? <> · {parts.exchange}</> : null}
                        {parts.countryFlag ? (
                          <>
                            {" · "}
                            <span
                              className="inline-block align-[-2px] text-[16px] leading-none"
                              aria-hidden
                            >
                              {parts.countryFlag}
                            </span>
                          </>
                        ) : null}
                      </>
                    );
                  })()
                ) : (
                  listingSubtitle
                )}
              </p>
            </div>
          </div>
          <AssetPageHeaderActions
            watchlistStorageKey={wlKey}
            watchlistLabel={displaySym}
            transactionSymbol={symbol}
            transactionName={displayName}
            hideAddTrade={kind === "index" || kind === "currency"}
          />
        </div>
        {priceBlock}
      </div>
    </>
  );
}

function ShellBreadcrumbs({
  kind,
  symbol,
  pending,
}: {
  kind: PendingAssetShellKind;
  symbol: string;
  pending: PendingAssetShell | null;
}) {
  if (kind === "crypto") return <CryptoBreadcrumbs symbol={symbol} />;
  if (kind === "index") {
    return <IndexBreadcrumbs displayName={pending?.name?.trim() || symbol} />;
  }
  if (kind === "currency") {
    return <CurrencyBreadcrumbs displayName={pending?.name?.trim() || symbol} />;
  }
  return <StockBreadcrumbs ticker={symbol} headerMeta={null} />;
}

/** Shared loading chrome for asset routes — static nav paints immediately; chart body skeletons. */
export function StockPageSkeleton() {
  const pathname = usePathname();
  const pending = usePendingAssetShellSnapshot();
  const parsed = parseAssetPathname(pathname);
  const showOptimistic = pendingAssetShellMatchesPath(pending, pathname);
  const kind = parsed?.kind ?? pending?.kind ?? null;
  const symbol = parsed?.symbol ?? pending?.symbol ?? null;

  // Soft-nav / known asset path: real breadcrumbs, tabs, chart toggles.
  if (kind && symbol) {
    const hideMarketCap = kind === "index" || kind === "currency";
    return (
      <div className="relative min-w-0" aria-busy aria-label={`Loading ${symbol}`}>
        <ShellBreadcrumbs kind={kind} symbol={symbol} pending={showOptimistic ? pending : null} />
        <div className="space-y-5 px-4 py-0 max-md:pt-4 sm:space-y-5 sm:px-9 sm:pt-5 sm:pb-6">
          <ShellHeader kind={kind} symbol={symbol} pending={showOptimistic ? pending : null} />

          {kind === "stock" ? (
            <div className="max-md:hidden pointer-events-none">
              <StockDetailTabNav activeTab="overview" onTabChange={noop} />
            </div>
          ) : null}
          {kind === "crypto" ? (
            <div className="pointer-events-none">
              <CryptoDetailTabNav activeTab="overview" onTabChange={noop} />
            </div>
          ) : null}

          <div className="pointer-events-none">
            <ChartControls
              activeRange="1D"
              onRangeChange={noop}
              chartSeries="price"
              onChartSeriesChange={noop}
              hideMarketCapSeries={hideMarketCap}
            >
              <div className="relative min-h-[320px] w-full">
                <AssetChartSkeleton heightPx={320} className="h-full" />
              </div>
            </ChartControls>
          </div>

          {kind === "stock" || kind === "crypto" ? <KeyIndicatorsSkeleton /> : null}

          {kind === "stock" ? (
            <div className="grid w-full gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(MOBILE_INSET_CARD_CLASS, "space-y-3 p-4")}>
                  <SkeletonBox className="h-4 w-24 rounded" />
                  <div className="space-y-2.5">
                    <SkeletonBox className="h-3.5 w-full rounded" />
                    <SkeletonBox className="h-3.5 w-[85%] rounded" />
                    <SkeletonBox className="h-3.5 w-[70%] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Fallback (no path symbol yet): anonymous skeleton.
  return (
    <div
      className="relative w-full min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6"
      aria-busy
      aria-label="Loading asset page"
    >
      <div className="space-y-2">
        <SkeletonBox className="h-4 w-56 max-w-full rounded-md" />
        <SkeletonBox className="h-9 w-72 max-w-full rounded-md" />
        <SkeletonBox className="h-6 w-40 max-w-full rounded-md" />
      </div>
      <SkeletonBox className="h-10 w-full rounded-md" />
      <div className="flex gap-2">
        <SkeletonBox className="h-9 w-24 rounded-[10px]" />
        <SkeletonBox className="h-9 w-28 rounded-[10px]" />
        <SkeletonBox className="h-9 w-20 rounded-[10px]" />
      </div>
      <SkeletonBox className="h-[min(420px,50vh)] w-full rounded-lg" />
      <KeyIndicatorsSkeleton />
    </div>
  );
}
