"use client";

import { useEffect, useMemo, useState } from "react";

import { PortfolioBrokerageLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import type { PortfolioSnaptradeLink } from "@/components/portfolio/portfolio-types";
import {
  brokerageSyncExplanationBullets,
  formatPortfolioLastSyncLine,
} from "@/lib/snaptrade/sync-copy";

export function PortfolioSnaptradeConnectionInfo({
  snaptrade,
}: {
  snaptrade: PortfolioSnaptradeLink;
}) {
  const offline = snaptrade.offline === true;
  const [isRealTimeConnection, setIsRealTimeConnection] = useState<boolean | null>(
    offline ? false : (snaptrade.isRealTimeConnection ?? null),
  );

  useEffect(() => {
    setIsRealTimeConnection(offline ? false : (snaptrade.isRealTimeConnection ?? null));
  }, [offline, snaptrade.authorizationId, snaptrade.isRealTimeConnection]);

  useEffect(() => {
    if (offline) return;
    if (!snaptrade.authorizationId || snaptrade.authorizationId === "offline") return;
    if (snaptrade.isRealTimeConnection !== undefined) return;
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
  }, [offline, snaptrade.authorizationId, snaptrade.isRealTimeConnection]);

  const brokerageName = snaptrade.brokerageName?.trim() || "Connected brokerage";
  const accountCount = snaptrade.accountIds.length;
  const explanation = useMemo(
    () =>
      offline
        ? [
            "This is a frozen offline copy — positions are not live.",
            "Live connection was paused on Free to stop ongoing connection charges.",
            "Upgrade to Pro to reconnect and sync again.",
          ]
        : brokerageSyncExplanationBullets(isRealTimeConnection),
    [isRealTimeConnection, offline],
  );

  const accountLine =
    offline ? "Disconnected · offline snapshot"
    : accountCount === 0 ? "Account linked"
    : accountCount === 1 ? "1 account linked"
    : `${accountCount} accounts linked`;

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-fg">
        {offline ? "Brokerage (offline)" : "Brokerage connection"}
      </span>
      <div className="rounded-[10px] border border-stroke bg-canvas px-3 py-3">
        <div className="flex items-start gap-3">
          <PortfolioBrokerageLogo snaptrade={snaptrade} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{brokerageName}</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Finsepa · {accountLine}
            </p>
            <p className="mt-1 text-xs text-fg-muted">{formatPortfolioLastSyncLine(snaptrade.syncedAt)}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-stroke pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {offline ? "Frozen on Free" : "How sync works"}
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-fg-muted">
            {explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
