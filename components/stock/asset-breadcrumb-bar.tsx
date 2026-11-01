import type { ReactNode } from "react";

import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

/** Desktop-only breadcrumb card for asset pages (stock, crypto, index, currency). */
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
    <div className="hidden px-9 pt-5 md:block">
      <nav
        aria-label="Breadcrumb"
        className={cn(
          "flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-[14px] text-fg-muted",
          MOBILE_ELEVATED_CARD_CLASS,
        )}
      >
        {children}
      </nav>
    </div>
  );
}
