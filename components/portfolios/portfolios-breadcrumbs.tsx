"use client";

import Link from "next/link";

const breadcrumbLinkClass =
  "min-w-0 truncate transition-colors hover:text-[#0F0F0F] hover:underline";

const breadcrumbSep = (
  <span className="shrink-0 select-none" aria-hidden>
    /
  </span>
);

/** Breadcrumb row for `/portfolios/[id]` — matches stock/crypto asset pages. */
export function PortfoliosBreadcrumbs({ currentLabel }: { currentLabel?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center px-4 py-3 text-[14px] text-[#71717A] max-md:border-b-0 md:border-b md:border-[#E4E4E7] sm:px-9"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href="/portfolios" className={`shrink-0 ${breadcrumbLinkClass}`}>
          Portfolios
        </Link>
        {currentLabel ? (
          <>
            {breadcrumbSep}
            <span className="min-w-0 truncate font-medium text-[#0F0F0F]" aria-current="page">
              {currentLabel}
            </span>
          </>
        ) : null}
      </div>
    </nav>
  );
}
