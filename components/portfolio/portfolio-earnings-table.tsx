"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CompanyLogo } from "@/components/screener/company-logo";
import { SkeletonBox } from "@/components/markets/skeleton";
import { EarningsCountdownBars } from "@/components/stock/earnings-countdown-bars";
import {
  formatPortfolioEarningsDateLabel,
  type PortfolioEarningsDateEntry,
} from "@/lib/portfolio/portfolio-earnings-dates";
import {
  portfolioHoldingAssetHref,
  type PortfolioHoldingAssetLinkTab,
} from "@/lib/crypto/crypto-picker-universe";
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
import { isStockDetailEtf } from "@/lib/stock/stock-etf";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

const EM_DASH = "\u2014";

/** Matches screener / holdings company column. */
const HOLDING_COMPANY_NAME_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-[#0F0F0F] underline-offset-2 decoration-[#71717A] group-hover:underline";

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
    return <span className="tabular-nums text-[#0F0F0F]">{EM_DASH}</span>;
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5",
        align === "right" && "justify-end",
      )}
    >
      <span className="inline-block w-7 shrink-0 text-center font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-[#0F0F0F]">
        {formatDaysLeftLabel(daysLeft)}
      </span>
      <EarningsCountdownBars daysLeft={daysLeft} />
    </div>
  );
}

function PortfolioEarningsTableInner({
  holdings,
  className,
  assetLinkTab = "overview",
}: {
  holdings: PortfolioHolding[];
  className?: string;
  assetLinkTab?: PortfolioHoldingAssetLinkTab;
}) {
  const router = useRouter();
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

  return (
    <div
      className={cn(
        "w-full overflow-x-visible max-md:pb-4 sm:overflow-x-auto sm:border-t sm:border-[#E4E4E7] sm:pb-8",
        className,
      )}
    >
      <div className="sm:hidden">
        <div>
          {sortedHoldings.map((h) => {
            const assetHref = portfolioHoldingAssetHref(h.symbol, { tab: assetLinkTab });
            const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
            const caption = portfolioAssetSymbolCaption(h.symbol);
            const companyName = portfolioHoldingDisplayName(h, resolvedCompanyNames);
            const { earningsLabel, daysLeft, metaLoading } = rowMeta(h.symbol);

            const left = (
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                <div className="min-w-0">
                  <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                  <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">{caption}</div>
                </div>
              </div>
            );

            return (
              <div
                key={h.id}
                className={cn(
                  "group flex min-h-[56px] items-center justify-between gap-3 border-b border-[#E4E4E7] px-4 py-[10px]",
                  assetHref && "cursor-pointer",
                )}
                onClick={assetHref ? () => router.push(assetHref) : undefined}
                onKeyDown={
                  assetHref ?
                    (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      router.push(assetHref);
                    }
                  : undefined
                }
                tabIndex={assetHref ? 0 : undefined}
                role={assetHref ? "link" : undefined}
                aria-label={assetHref ? `Open ${companyName}` : undefined}
              >
                {assetHref ?
                  <Link
                    href={assetHref}
                    className="min-w-0 flex-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {left}
                  </Link>
                : <div className="min-w-0 flex-1">{left}</div>}
                <div className="flex min-w-0 shrink-0 flex-col items-end gap-1">
                  <DaysLeftCell daysLeft={daysLeft} loading={metaLoading} />
                  <div className="font-['Inter'] text-[12px] font-medium leading-4 tabular-nums text-[#71717A]">
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

      <table className="hidden w-full min-w-[640px] border-separate border-spacing-0 sm:table">
        <thead>
          <tr className="min-h-[40px] bg-white text-[14px] font-medium leading-5 text-[#71717A]">
            <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-left">Asset</th>
            <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-left">Days left</th>
            <th className="whitespace-nowrap border-b border-[#E4E4E7] px-4 py-[10px] text-right">
              Earnings date
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedHoldings.map((h) => {
            const assetHref = portfolioHoldingAssetHref(h.symbol, { tab: assetLinkTab });
            const logo = displayLogoUrlForPortfolioSymbol(h.symbol);
            const caption = portfolioAssetSymbolCaption(h.symbol);
            const companyName = portfolioHoldingDisplayName(h, resolvedCompanyNames);
            const { earningsLabel, daysLeft, metaLoading } = rowMeta(h.symbol);
            const assetInner = (
              <>
                <CompanyLogo name={companyName} logoUrl={logo} symbol={h.symbol} />
                <div className="min-w-0 text-left">
                  <div className={HOLDING_COMPANY_NAME_CLASS}>{companyName}</div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">{caption}</div>
                </div>
              </>
            );
            return (
              <tr
                key={h.id}
                className={cn(
                  "group relative h-[56px] max-h-[56px] transition-colors duration-75 hover:bg-neutral-50",
                  assetHref && "cursor-pointer",
                )}
                onClick={assetHref ? () => router.push(assetHref) : undefined}
                onKeyDown={
                  assetHref ?
                    (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      router.push(assetHref);
                    }
                  : undefined
                }
                tabIndex={assetHref ? 0 : undefined}
                role={assetHref ? "link" : undefined}
                aria-label={assetHref ? `Open ${companyName}` : undefined}
              >
                <td className="border-b border-[#E4E4E7] px-4 py-[10px] align-middle">
                  {assetHref ?
                    <Link
                      href={assetHref}
                      className="flex min-w-0 items-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {assetInner}
                    </Link>
                  : <div className="flex min-w-0 items-center gap-3">{assetInner}</div>}
                </td>
                <td className="border-b border-[#E4E4E7] px-4 py-[10px] align-middle">
                  <DaysLeftCell
                    daysLeft={daysLeft}
                    loading={metaLoading}
                  />
                </td>
                <td className="border-b border-[#E4E4E7] px-4 py-[10px] text-right align-middle font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-[#0F0F0F]">
                  {earningsLabel === "…" ?
                    <SkeletonBox className="ml-auto h-4 w-24 rounded" />
                  : earningsLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const PortfolioEarningsTable = memo(PortfolioEarningsTableInner);
