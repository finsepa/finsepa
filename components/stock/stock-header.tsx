"use client";

import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSpringTriplet } from "@/components/chart/use-spring-numbers";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import {
  formatWatchlistsCountLabel,
  type StockDetailHeaderMeta,
} from "@/lib/market/stock-header-meta";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import { formatUsdAmountGrouped2dp, formatUsdCompact, formatUsdPrice } from "@/lib/market/key-stats-basic-format";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { UsEquityMarketSessionBadge } from "@/components/stock/us-equity-market-session-badge";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";
import { CompanyPicker } from "@/components/charting/company-picker";
import { mapProviderSectorToCanonical } from "@/lib/screener/screener-gics-sectors";
import { screenerSectorCompaniesHref } from "@/lib/screener/screener-sector-url";
import { screenerIndustryDrillHref } from "@/lib/screener/screener-industry-url";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openNewTransactionWithPreset } = usePortfolioWorkspace();
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const exchange = headerMeta?.exchange?.trim() ?? "";
  const breadcrumbSymbol = exchange ? `${symbol} · ${exchange}` : symbol;
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
    const id = requestAnimationFrame(() => setWatchlistMetaReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

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

  const sectorLabel = headerMeta?.sector?.trim() || null;
  const industryLabel = headerMeta?.industry?.trim() || null;
  const canonicalSector = sectorLabel ? mapProviderSectorToCanonical(sectorLabel) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 text-[14px] text-[#71717A]">
        <Link href="/screener" className="transition-colors hover:text-[#09090B]">
          Stocks
        </Link>
        {sectorLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            {canonicalSector ? (
              <Link href={screenerSectorCompaniesHref(canonicalSector)} className="transition-colors hover:text-[#09090B]">
                {sectorLabel}
              </Link>
            ) : (
              <span>{sectorLabel}</span>
            )}
          </>
        )}
        {industryLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            {canonicalSector ? (
              <Link href={screenerIndustryDrillHref(canonicalSector, industryLabel)} className="transition-colors hover:text-[#09090B]">
                {industryLabel}
              </Link>
            ) : (
              <span>{industryLabel}</span>
            )}
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <CompanyPicker
          includeCrypto={false}
          maxExtraCompanies={1}
          excludeSymbols={[symbol]}
          onPick={({ symbol: nextSym }) => {
            const qs =
              typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : searchParams?.toString() ?? "";
            const url = `/stock/${encodeURIComponent(nextSym)}${qs ? `?${qs}` : ""}`;
            router.push(url);
          }}
        >
          {({ open, setOpen, atCapacity }) => (
            <button
              type="button"
              onClick={() => {
                if (atCapacity) return;
                setOpen((o) => !o);
              }}
              aria-expanded={open}
              aria-haspopup="listbox"
              className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2 text-[12px] font-medium leading-4 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#FAFAFA]"
              title={breadcrumbSymbol}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
              <span className="truncate">{breadcrumbSymbol}</span>
            </button>
          )}
        </CompanyPicker>
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
            <h1 className="text-[20px] font-semibold leading-7 text-[#09090B] [display:-webkit-box] [-webkit-line-clamp:1] sm:[-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">
              {titleName}
            </h1>
            {headerMetaLoading ? (
              <div className="mt-0.5 h-4 w-24 rounded bg-neutral-200/80 animate-pulse" aria-hidden />
            ) : (
              <p className="mt-0.5 text-[13px] leading-5 text-[#71717A]">
                {symbol}
                {watchlistMetaReady && headerMeta?.watchlistCount != null ? (
                  <>
                    <span className="text-[#71717A]"> · </span>
                    {formatWatchlistsCountLabel(headerMeta.watchlistCount)}
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
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#09090B] text-[13px] font-semibold text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12)] transition-colors hover:bg-[#27272A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/25 sm:w-auto sm:gap-1.5 sm:px-3.5"
            aria-label="Add Trade"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="hidden sm:inline">Add Trade</span>
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
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
            {chartLoading || anim.price == null
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
                {chartLoading || !hasChange || anim.abs == null || anim.pct == null
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
                {chartLoading || !hasChange || anim.abs == null || anim.pct == null
                  ? "—"
                  : headerChartMetric === "marketCap"
                    ? `${isPositive ? "+" : ""}${formatUsdCompact(anim.abs)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`
                    : `${isPositive ? "+" : ""}${formatUsdAmountGrouped2dp(anim.abs)} (${isPositive ? "+" : ""}${anim.pct.toFixed(2)}%)`}
              </span>
              <span className="text-[13px] text-[#71717A]">{periodLabelOverride ?? periodLabel}</span>
            </>
          )}
        </div>
        {chartLoading ? (
          <div className="mt-0.5 text-[12px] text-[#71717A]">Loading…</div>
        ) : chartEmpty ? null : priceTimestampLabel ? (
          <div className="mt-0.5 text-[12px] leading-4 text-[#71717A]">{priceTimestampLabel}</div>
        ) : null}
        </div>
        <UsEquityMarketSessionBadge className="inline-flex shrink-0 self-end" />
      </div>
    </div>
  );
}
