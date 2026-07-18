"use client";

import Link from "next/link";

import { UsEquityMarketSessionBadge } from "@/components/stock/us-equity-market-session-badge";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { mapProviderSectorToCanonical } from "@/lib/screener/screener-gics-sectors";
import { SCREENER_ETFS_HREF } from "@/lib/screener/screener-market-url";
import { screenerIndustryDrillHref } from "@/lib/screener/screener-industry-url";
import { screenerSectorCompaniesHref } from "@/lib/screener/screener-sector-url";

type Props = {
  ticker: string;
  headerMeta: StockDetailHeaderMeta | null;
  isEtf?: boolean;
};

export function StockBreadcrumbs({ ticker, headerMeta, isEtf = false }: Props) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const breadcrumbSymbol = meta.ticker;

  const sectorLabel = isEtf ? null : headerMeta?.sector?.trim() || null;
  const industryLabel = isEtf ? null : headerMeta?.industry?.trim() || null;
  const canonicalSector = sectorLabel ? mapProviderSectorToCanonical(sectorLabel) : null;

  const breadcrumbCrumbClass = "min-w-0 truncate";
  const breadcrumbLinkClass = `${breadcrumbCrumbClass} transition-colors hover:text-[#0F0F0F] hover:underline`;
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden min-w-0 items-center justify-between gap-3 px-4 py-3 text-[14px] text-[#71717A] md:flex md:border-b md:border-[#E4E4E7] sm:px-9"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
      <Link
        href={isEtf ? SCREENER_ETFS_HREF : "/screener"}
        className={`shrink-0 ${breadcrumbLinkClass}`}
      >
        {isEtf ? "ETF's" : "Stocks"}
      </Link>
      {sectorLabel ? (
        <>
          {breadcrumbSep}
          {canonicalSector ? (
            <Link
              href={screenerSectorCompaniesHref(canonicalSector)}
              className={`${breadcrumbLinkClass} max-w-[38%] min-w-0 sm:max-w-[min(200px,28vw)]`}
              title={sectorLabel}
            >
              {sectorLabel}
            </Link>
          ) : (
            <span
              className={`${breadcrumbCrumbClass} max-w-[38%] min-w-0 sm:max-w-[min(200px,28vw)]`}
              title={sectorLabel}
            >
              {sectorLabel}
            </span>
          )}
        </>
      ) : null}
      {industryLabel ? (
        <>
          {breadcrumbSep}
          {canonicalSector ? (
            <Link
              href={screenerIndustryDrillHref(canonicalSector, industryLabel)}
              className={`${breadcrumbLinkClass} min-w-0 max-w-[42%] sm:max-w-[min(240px,32vw)]`}
              title={industryLabel}
            >
              {industryLabel}
            </Link>
          ) : (
            <span
              className={`${breadcrumbCrumbClass} min-w-0 max-w-[42%] sm:max-w-[min(240px,32vw)]`}
              title={industryLabel}
            >
              {industryLabel}
            </span>
          )}
        </>
      ) : null}
      {breadcrumbSep}
      <span
        className={`${breadcrumbCrumbClass} shrink-0 font-medium text-[#0F0F0F]`}
        title={breadcrumbSymbol}
        aria-current="page"
      >
        {breadcrumbSymbol}
      </span>
      </div>
      <UsEquityMarketSessionBadge className="shrink-0" />
    </nav>
  );
}
