"use client";

import { useCallback, useEffect, useState } from "react";

import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "@/lib/icons";
import {
  findOrphanSnaptradeConnection,
  linkedSnaptradeAuthorizationIds,
} from "@/lib/snaptrade/orphan-connection";
import { cn } from "@/lib/utils";

export function PortfolioPendingBrokerageSyncButton({
  portfolioId,
  portfolios,
  onSync,
  className,
}: {
  portfolioId: string;
  portfolios: ReadonlyArray<{ id: string; snaptrade?: { authorizationId?: string | null } | null }>;
  onSync: (portfolioId: string, authorizationId: string) => void | Promise<void>;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [orphanAuthId, setOrphanAuthId] = useState<string | null>(null);

  const selected = portfolios.find((p) => p.id === portfolioId);
  const hasLinkedSnaptrade = Boolean(selected?.snaptrade);

  useEffect(() => {
    if (hasLinkedSnaptrade) {
      setOrphanAuthId(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/snaptrade/connections", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { connections?: Array<{ id: string; createdDate?: string | null }> } | null) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.connections) ? data.connections : [];
        const orphan = findOrphanSnaptradeConnection(rows, linkedSnaptradeAuthorizationIds(portfolios));
        setOrphanAuthId(orphan?.id?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setOrphanAuthId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hasLinkedSnaptrade, portfolios, portfolioId]);

  const onClick = useCallback(() => {
    if (loading || !orphanAuthId) return;
    setLoading(true);
    void Promise.resolve(onSync(portfolioId, orphanAuthId)).finally(() => setLoading(false));
  }, [loading, onSync, orphanAuthId, portfolioId]);

  if (hasLinkedSnaptrade || !orphanAuthId) return null;

  return (
    <TopbarDelayedTooltip
      label="Brokerage is connected — tap to import holdings and transactions into this portfolio."
      multiline
      align="trailing"
      className={cn("shrink-0", className)}
    >
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className={cn(
          topbarSquircleIconClass,
          "hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
          loading && "pointer-events-none opacity-60",
        )}
        aria-label="Sync connected brokerage"
      >
        {loading ?
          <Spinner className="size-5 text-fg-muted" />
        : <RefreshCw className="h-5 w-5" strokeWidth={2} aria-hidden />}
      </button>
    </TopbarDelayedTooltip>
  );
}
