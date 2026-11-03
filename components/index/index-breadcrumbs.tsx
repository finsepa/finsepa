"use client";

import Link from "next/link";

import { CompanyLogo } from "@/components/screener/company-logo";
import { AssetBreadcrumbBar } from "@/components/stock/asset-breadcrumb-bar";
import { SCREENER_INDICES_HREF } from "@/lib/screener/screener-market-url";

export function IndexBreadcrumbs({
  symbol,
  displayName,
}: {
  symbol: string;
  displayName: string;
}) {
  const sym = symbol.trim().toUpperCase();
  const breadcrumbLinkClass = "min-w-0 truncate transition-colors hover:text-fg hover:underline";
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <AssetBreadcrumbBar>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={SCREENER_INDICES_HREF} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Indices
        </Link>
        {breadcrumbSep}
        <span
          className="inline-flex min-w-0 shrink-0 items-center gap-1.5 truncate font-medium text-fg"
          title={displayName}
          aria-current="page"
        >
          <CompanyLogo name={displayName} logoUrl="" symbol={sym} size="xs" />
          {displayName}
        </span>
      </div>
    </AssetBreadcrumbBar>
  );
}
