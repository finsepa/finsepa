import type { ReactNode } from "react";

import { ASSET_BREADCRUMB_CARD_CLASS } from "@/components/design-system/card-surface-styles";

/** Desktop-only breadcrumbs for asset pages (stock, crypto, index, currency). */
export function AssetBreadcrumbBar({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  if (embedded) {
    return (
      <nav
        aria-label="Breadcrumb"
        className="hidden min-w-0 items-center justify-between gap-3 text-[14px] text-fg-muted md:flex"
      >
        {children}
      </nav>
    );
  }
  return (
    <div className={`px-9 pt-5 ${ASSET_BREADCRUMB_CARD_CLASS}`}>
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center justify-between gap-3 text-[14px] text-fg-muted"
      >
        {children}
      </nav>
    </div>
  );
}
