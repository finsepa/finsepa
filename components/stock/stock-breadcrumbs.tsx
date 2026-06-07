"use client";

import Link from "next/link";
import { Search } from "@/lib/icons";
import { useRouter, useSearchParams } from "next/navigation";

import { CompanyPicker } from "@/components/charting/company-picker";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const breadcrumbSymbol = symbol;

  const sectorLabel = isEtf ? null : headerMeta?.sector?.trim() || null;
  const industryLabel = isEtf ? null : headerMeta?.industry?.trim() || null;
  const canonicalSector = sectorLabel ? mapProviderSectorToCanonical(sectorLabel) : null;

  const breadcrumbCrumbClass = "min-w-0 truncate";
  const breadcrumbLinkClass = `${breadcrumbCrumbClass} transition-colors hover:text-[#09090B] hover:underline`;
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-[14px] text-[#71717A] max-md:border-b-0 md:border-b md:border-[#E4E4E7] sm:px-9"
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
      <div className="shrink-0">
        <CompanyPicker
          includeCrypto={false}
          alwaysAllowOpen
          menuAlign="trailing"
          menuPortal
          maxExtraCompanies={1}
          excludeSymbols={[symbol]}
          onPick={({ symbol: nextSym }) => {
            const qs =
              typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : searchParams?.toString() ?? "";
            const url = `/stock/${encodeURIComponent(nextSym)}${qs ? `?${qs}` : ""}`;
            router.push(url);
          }}
        >
          {({ open, setOpen }) => (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label={`${breadcrumbSymbol}, search for another ${isEtf ? "ETF" : "stock"}`}
              className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2 text-[12px] font-medium leading-4 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#FAFAFA]"
              title={breadcrumbSymbol}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
              <span className="truncate">{breadcrumbSymbol}</span>
            </button>
          )}
        </CompanyPicker>
      </div>
      </div>
      {!isEtf ? <UsEquityMarketSessionBadge className="shrink-0" /> : null}
    </nav>
  );
}
