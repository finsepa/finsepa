"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { SkeletonBox } from "@/components/markets/skeleton";
import { EarningsCountdownBars } from "@/components/stock/earnings-countdown-bars";
import {
  formatPortfolioEarningsDateLabel,
  type PortfolioEarningsDateEntry,
} from "@/lib/portfolio/portfolio-earnings-dates";
import type { PortfolioHoldingAssetLinkTab } from "@/lib/crypto/crypto-picker-universe";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioAssetSymbolCaption } from "@/lib/portfolio/custom-asset-symbol";
import {
  fetchPortfolioEarningsDatesClient,
  peekPortfolioEarningsDatesClient,
  portfolioEarningsSymbolsKey,
} from "@/lib/portfolio/portfolio-earnings-dates-client";
import {
  portfolioHoldingDisplayName,
  usePortfolioHoldingDisplayNames,
} from "@/lib/portfolio/use-portfolio-holding-display-names";
import type { EarningsCalendarItem } from "@/lib/market/earnings-calendar-types";
import { isStockDetailEtf } from "@/lib/stock/stock-etf";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

const EM_DASH = "\u2014";

/** Matches screener / holdings company column. */
const HOLDING_COMPANY_NAME_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover:underline group-hover/row:underline";

const EARNINGS_GRID =
  "grid min-w-[640px] grid-cols-[minmax(200px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)] items-center gap-x-2";

function holdingLookupKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isCryptoOrEtfHolding(symbol: string): boolean {
  const cryptoKey = cryptoRouteBase(symbol);
  if (isSupportedCryptoAssetSymbol(cryptoKey)) return true;
  return isStockDetailEtf(holdingLookupKey(symbol));
}

function formatDaysLeftLabel(daysLeft: number): string {
  return String(daysLeft);
}

function earningsPreviewItemFromHolding(args: {
  holding: PortfolioHolding;
  companyName: string;
  logoUrl: string | null;
  entry: PortfolioEarningsDateEntry | undefined;
}): EarningsCalendarItem {
  const ticker = holdingLookupKey(args.holding.symbol);
  return {
    ticker,
    companyName: args.companyName || ticker,
    logoUrl: args.logoUrl ?? "",
    screenerRank: null,
    reportDate: args.entry?.earningsDateYmd?.trim() || "",
    timing: "unknown",
    timingLabel: "",
  };
}

function DaysLeftCell({
  daysLeft,
  loading,
  align = "left",
}: {
  daysLeft: number | null;
  loading: boolean;
  align?: "left" | "right";
}) {
  if (loading) {
    return (
      <div
        className={cn("flex items-center gap-2.5", align === "right" && "justify-end")}
        aria-hidden
      >
        <SkeletonBox className="h-4 w-7 rounded" />
        <div className="flex items-center gap-1">
          {Array.from({ length: 12 }).map((_, index) => (
            <SkeletonBox key={index} className="h-3 w-[3px] rounded-[1px]" />
          ))}
        </div>
      </div>
    );
  }
  if (daysLeft == null) {
    return <span className="tabular-nums text-fg">{EM_DASH}</span>;
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5",
        align === "right" && "justify-end",
      )}
    >
      <span className="inline-block w-7 shrink-0 text-center font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg">
        {formatDaysLeftLabel(daysLeft)}
      </span>
      <EarningsCountdownBars daysLeft={daysLeft} />
    </div>
  );
}

function PortfolioEarningsTableInner({
  holdings,
  className,
  assetLinkTab: _assetLinkTab = "overview",
}: {
  holdings: PortfolioHolding[];
  className?: string;
  /** Kept for call-site compatibility; asset click opens the earnings preview modal. */
  assetLinkTab?: PortfolioHoldingAssetLinkTab;
}) {
  void _assetLinkTab;
  const resolvedCompanyNames = usePortfolioHoldingDisplayNames(holdings);
  const equityHoldings = useMemo(
    () => holdings.filter((holding) => !isCryptoOrEtfHolding(holding.symbol)),
    [holdings],
  );

  const stockSymbolsKey = useMemo(
    () =>
      portfolioEarningsSymbolsKey(
        equityHoldings.map((holding) => holdingLookupKey(holding.symbol)),
      ),
    [equityHoldings],
  );
  const cachedPayload =
    typeof window === "undefined" ? null : peekPortfolioEarningsDatesClient(stockSymbolsKey);
  const [bySymbol, setBySymbol] = useState<Record<string, PortfolioEarningsDateEntry> | null>(
    () => cachedPayload?.bySymbol ?? null,
  );
  const [previewItem, setPreviewItem] = useState<EarningsCalendarItem | null>(null);

  const sortedHoldings = useMemo(() => {
    const withMeta = equityHoldings.map((h) => {
      const entry = bySymbol?.[holdingLookupKey(h.symbol)];
      if (entry?.notApplicable) {
        return { holding: h, daysLeft: null as number | null };
      }
      return { holding: h, daysLeft: entry?.daysLeft ?? null };
    });

    withMeta.sort((a, b) => {
      const aDays = a.daysLeft;
      const bDays = b.daysLeft;
      // Soonest first; missing / N/A (—) last.
      if (aDays == null && bDays == null) {
        return portfolioHoldingDisplayName(a.holding, resolvedCompanyNames).localeCompare(
          portfolioHoldingDisplayName(b.holding, resolvedCompanyNames),
          undefined,
          { sensitivity: "base" },
        );
      }
      if (aDays == null) return 1;
      if (bDays == null) return -1;
      if (aDays !== bDays) return aDays - bDays;
      return portfolioHoldingDisplayName(a.holding, resolvedCompanyNames).localeCompare(
        portfolioHoldingDisplayName(b.holding, resolvedCompanyNames),
        undefined,
        { sensitivity: "base" },
      );
    });

    return withMeta.map((row) => row.holding);
  }, [equityHoldings, resolvedCompanyNames, bySymbol]);

  useEffect(() => {
    let cancelled = false;
    void fetchPortfolioEarningsDatesClient(stockSymbolsKey).then((payload) => {
      if (cancelled) return;
      setBySymbol(payload?.bySymbol ?? {});
    });
    return () => {
      cancelled = true;
    };
  }, [stockSymbolsKey]);

  function rowMeta(symbol: string): {
    earningsLabel: string;
    daysLeft: number | null;
    metaLoading: boolean;
  } {
    const entry = bySymbol?.[holdingLookupKey(symbol)];
    if (entry?.notApplicable) {
      return { earningsLabel: EM_DASH, daysLeft: null, metaLoading: false };
    }
    const metaLoading = entry == null;
    const display = formatPortfolioEarningsDateLabel({
      earningsDateDisplay: entry?.earningsDateDisplay ?? null,
      fiscalQuarter: entry?.fiscalQuarter ?? null,
    });
    const earningsLabel = display ? display : metaLoading ? "…" : EM_DASH;
    return { earningsLabel, daysLeft: entry?.daysLeft ?? null, metaLoading };
  }

  function openEarningsPreview(holding: PortfolioHolding) {
    const companyName = portfolioHoldingDisplayName(holding, resolvedCompanyNames);
    const logo = displayLogoUrlForPortfolioSymbol(holding.symbol);
    setPreviewItem(
      earningsPreviewItemFromHolding({
        holding,
        companyName,
        logoUrl: logo,
        entry: bySymbol?.[holdingLookupKey(holding.symbol)],
      }),
    );
  }

  return (
    <div className={cn("w-full max-md:pb-4 sm:pb-2", className)}>
      <div className="sm:hidden">
        <div>
          {sortedHoldings.map((h) => {
            const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
            const caption = portfolioAssetSymbolCaption(h.symbol);
            const companyName = portfolioHoldingDisplayName(h, resolvedCompanyNames);
            const { earningsLabel, daysLeft, metaLoading } = rowMeta(h.symbol);

            return (
              <div
                key={h.id}
                className="group flex min-h-[56px] cursor-pointer items-center justify-between gap-3 border-b border-[#EFEFEF] px-4 py-[10px]"
                onClick={() => openEarningsPreview(h)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  openEarningsPreview(h);
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open earnings for ${companyName}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                  <div className="min-w-0">
                    <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                    <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">{caption}</div>
                  </div>
                </div>
                <div className="flex min-w-0 shrink-0 flex-col items-end gap-1">
                  <DaysLeftCell daysLeft={daysLeft} loading={metaLoading} />
                  <div className="font-['Inter'] text-[12px] font-medium leading-4 tabular-nums text-fg-muted">
                    {earningsLabel === "…" ?
                      <SkeletonBox className="ml-auto h-3 w-20 rounded" />
                    : earningsLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden sm:block">
        <ScreenerTableScroll className="sm:pb-6" minWidthClassName="min-w-[640px]">
          <div className="bg-surface">
            <div
              className={cn(
                SCREENER_TABLE_HEADER_STICKY_CLASS,
                SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                "md:border-b-0",
              )}
            >
              <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                <div
                  className={cn(
                    EARNINGS_GRID,
                    "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                  )}
                >
                  <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Asset</div>
                  <div className="text-left">Days left</div>
                  <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                    Earnings date
                  </div>
                </div>
              </div>
              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
            </div>

            {sortedHoldings.map((h, i) => {
              const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
              const caption = portfolioAssetSymbolCaption(h.symbol);
              const companyName = portfolioHoldingDisplayName(h, resolvedCompanyNames);
              const { earningsLabel, daysLeft, metaLoading } = rowMeta(h.symbol);
              return (
                <div key={h.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                  <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                    <div
                      className={cn(
                        EARNINGS_GRID,
                        "min-h-[56px] cursor-pointer text-[14px] font-normal leading-5",
                        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                      )}
                      onClick={() => openEarningsPreview(h)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        openEarningsPreview(h);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open earnings for ${companyName}`}
                    >
                      <div className={cn("flex min-w-0 items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
                        <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                        <div className="min-w-0 text-left">
                          <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                          <div className="text-[12px] font-normal leading-4 text-fg-muted">{caption}</div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <DaysLeftCell daysLeft={daysLeft} loading={metaLoading} />
                      </div>
                      <div
                        className={cn(
                          "min-w-0 w-full text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg",
                          TABLE_END_ALIGNED_PAD_CLASS,
                        )}
                      >
                        {earningsLabel === "…" ?
                          <SkeletonBox className="ml-auto h-4 w-24 rounded" />
                        : earningsLabel}
                      </div>
                    </div>
                  </div>
                  {i < sortedHoldings.length - 1 ? (
                    <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        </ScreenerTableScroll>
      </div>

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}

export const PortfolioEarningsTable = memo(PortfolioEarningsTableInner);
