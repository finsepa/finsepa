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
  const [isRealTimeConnection, setIsRealTimeConnection] = useState<boolean | null>(
    snaptrade.isRealTimeConnection ?? null,
  );

  useEffect(() => {
    setIsRealTimeConnection(snaptrade.isRealTimeConnection ?? null);
  }, [snaptrade.authorizationId, snaptrade.isRealTimeConnection]);

  useEffect(() => {
    if (!snaptrade.authorizationId || snaptrade.isRealTimeConnection !== undefined) return;
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
  }, [snaptrade.authorizationId, snaptrade.isRealTimeConnection]);

  const brokerageName = snaptrade.brokerageName?.trim() || "Connected brokerage";
  const accountCount = snaptrade.accountIds.length;
  const explanation = useMemo(
    () => brokerageSyncExplanationBullets(isRealTimeConnection),
    [isRealTimeConnection],
  );

  const accountLine =
    accountCount === 0 ? "Account linked"
    : accountCount === 1 ? "1 account linked"
    : `${accountCount} accounts linked`;

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">Brokerage connection</span>
      <div className="rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-3">
        <div className="flex items-start gap-3">
          <PortfolioBrokerageLogo snaptrade={snaptrade} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#09090B]">{brokerageName}</p>
            <p className="mt-0.5 text-xs text-[#71717A]">
              SnapTrade · {accountLine}
            </p>
            <p className="mt-1 text-xs text-[#71717A]">{formatPortfolioLastSyncLine(snaptrade.syncedAt)}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-[#E4E4E7] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#71717A]">How sync works</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[#52525B]">
            {explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
