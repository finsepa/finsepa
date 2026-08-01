"use client";

import Link from "next/link";

import { SCREENER_INDICES_HREF } from "@/lib/screener/screener-market-url";

export function IndexBreadcrumbs({ displayName }: { displayName: string }) {
  const breadcrumbLinkClass = "min-w-0 truncate transition-colors hover:text-fg hover:underline";
  const breadcrumbSep = (
    <span className="shrink-0 select-none" aria-hidden>
      /
    </span>
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden min-w-0 items-center gap-3 px-4 py-3 text-[14px] text-fg-muted md:flex md:border-b md:border-stroke-shell sm:px-9"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={SCREENER_INDICES_HREF} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Indices
        </Link>
        {breadcrumbSep}
        <span className="min-w-0 shrink-0 truncate font-medium text-fg" title={displayName} aria-current="page">
          {displayName}
        </span>
      </div>
    </nav>
  );
}
