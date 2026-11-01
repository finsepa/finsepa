"use client";

import Link from "next/link";

import { AssetBreadcrumbBar } from "@/components/stock/asset-breadcrumb-bar";

const breadcrumbLinkClass =
  "min-w-0 truncate transition-colors hover:text-fg hover:underline";

const breadcrumbSep = (
  <span className="shrink-0 select-none" aria-hidden>
    /
  </span>
);

function Crumbs({ currentLabel }: { currentLabel?: string }) {
  return (
    <>
      <Link href="/home" className={`shrink-0 ${breadcrumbLinkClass}`}>
        Home
      </Link>
      {currentLabel ? (
        <>
          {breadcrumbSep}
          <span className="min-w-0 truncate font-medium text-fg" aria-current="page">
            {currentLabel}
          </span>
        </>
      ) : null}
    </>
  );
}

/** Breadcrumb for `/home/[portfolioId]` — Home → selected portfolio (desktop card like asset pages). */
export function PortfolioHomeBreadcrumbs({ currentLabel }: { currentLabel?: string }) {
  return (
    <>
      <AssetBreadcrumbBar>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Crumbs currentLabel={currentLabel} />
        </div>
      </AssetBreadcrumbBar>
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-3 text-[14px] text-fg-muted md:hidden"
      >
        <Crumbs currentLabel={currentLabel} />
      </nav>
    </>
  );
}
