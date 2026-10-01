"use client";

import Link from "next/link";

const breadcrumbLinkClass =
  "min-w-0 truncate transition-colors hover:text-fg hover:underline";

const breadcrumbSep = (
  <span className="shrink-0 select-none" aria-hidden>
    /
  </span>
);

/** Breadcrumb for `/home/[portfolioId]` — Home → selected portfolio. */
export function PortfolioHomeBreadcrumbs({ currentLabel }: { currentLabel?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-3 text-[14px] text-fg-muted sticky top-0 z-50 max-md:relative max-md:border-b-0 md:border-b md:border-stroke-shell md:bg-panel sm:flex-nowrap sm:px-9"
    >
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
    </nav>
  );
}
