"use client";

import Link from "next/link";

import { CompanyLogo } from "@/components/screener/company-logo";
import { AssetBreadcrumbBar } from "@/components/stock/asset-breadcrumb-bar";
import { SCREENER_CURRENCIES_HREF } from "@/lib/screener/screener-market-url";

export function CurrencyBreadcrumbs({
  symbol,
  displayName,
  displayCode,
}: {
  symbol: string;
  displayName: string;
  displayCode?: string;
}) {
  const logoSymbol = (displayCode ?? symbol).trim().toUpperCase() || symbol.trim().toUpperCase();
  const breadcrumbLinkClass = "min-w-0 truncate transition-colors hover:text-fg hover:underline";
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <AssetBreadcrumbBar>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={SCREENER_CURRENCIES_HREF} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Currencies
        </Link>
        {breadcrumbSep}
        <span
          className="inline-flex min-w-0 shrink-0 items-center gap-1.5 truncate font-medium text-fg"
          title={displayName}
          aria-current="page"
        >
          <CompanyLogo name={displayName} logoUrl="" symbol={logoSymbol} size="xs" />
          {displayName}
        </span>
      </div>
    </AssetBreadcrumbBar>
  );
}
