"use client";

import { useEffect, useMemo, useState } from "react";

import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import type { PortfolioSnaptradeLink } from "@/components/portfolio/portfolio-types";
import { formatPortfolioSyncTooltipLines } from "@/lib/snaptrade/sync-copy";
import { Loader2, RefreshCw } from "@/lib/icons";
import { cn } from "@/lib/utils";

type PortfolioSyncStatusIconProps = {
  portfolioId: string;
  snaptrade?: PortfolioSnaptradeLink | null;
  /** `title`: inline after the portfolio page title. `menu`: inside the portfolio picker dropdown. */
  variant?: "title" | "menu";
  className?: string;
};

export function PortfolioSyncStatusIcon({
  portfolioId,
  snaptrade,
  variant = "title",
  className,
}: PortfolioSyncStatusIconProps) {
  const { openSnaptradeSyncModal } = usePortfolioWorkspace();
  const [isRealTimeConnection, setIsRealTimeConnection] = useState<boolean | null>(
    snaptrade?.isRealTimeConnection ?? null,
  );

  useEffect(() => {
    setIsRealTimeConnection(snaptrade?.isRealTimeConnection ?? null);
  }, [snaptrade?.authorizationId, snaptrade?.isRealTimeConnection]);

  useEffect(() => {
    if (!snaptrade?.authorizationId || snaptrade.isRealTimeConnection !== undefined) return;
    const ac = new AbortController();
    void fetch(
      `/api/snaptrade/brokerage-logo?authorizationId=${encodeURIComponent(snaptrade.authorizationId)}`,
      { cache: "no-store", signal: ac.signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { isRealTimeConnection?: unknown } | null) => {
        if (typeof data?.isRealTimeConnection === "boolean") {
          setIsRealTimeConnection(data.isRealTimeConnection);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => ac.abort();
  }, [snaptrade?.authorizationId, snaptrade?.isRealTimeConnection]);

  const tooltipLabel = useMemo(() => {
    if (!snaptrade?.syncedAt) return "";
    return formatPortfolioSyncTooltipLines({
      syncedAt: snaptrade.syncedAt,
      brokerageName: snaptrade.brokerageName,
      isRealTimeConnection,
    });
  }, [snaptrade?.syncedAt, snaptrade?.brokerageName, isRealTimeConnection]);

  if (!snaptrade?.syncedAt) return null;

  return (
    <TopbarDelayedTooltip
      label={tooltipLabel}
      multiline
      align={variant === "menu" ? "trailing" : "center"}
      className={cn("shrink-0", className)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openSnaptradeSyncModal(portfolioId);
        }}
        className={cn(
          "inline-flex items-center justify-center text-[#71717A]",
          variant === "title" ?
            "h-9 w-9 rounded-[10px] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
          : "h-9 w-9 rounded-lg hover:bg-[#F4F4F5] hover:text-[#09090B]",
        )}
        aria-label={tooltipLabel.replace(/\n/g, ". ")}
      >
        <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      </button>
    </TopbarDelayedTooltip>
  );
}
