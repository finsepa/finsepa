"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import { CompanyLogo } from "@/components/screener/company-logo";
import { ChangePct } from "@/components/screener/change-pct";
import { IntentPrefetchLink } from "@/components/layout/intent-prefetch-link";

export function CryptoLargestMoversCard({
  title,
  rows,
  className,
}: {
  title: "Largest Gainers" | "Largest Losers";
  rows: CryptoTop10Row[];
  className?: string;
}) {
  const slice = useMemo(() => rows.slice(0, 4), [rows]);

  return (
    <div
      className={cn(
        "flex min-h-[188px] min-w-0 flex-col gap-[12px] px-4 py-3 sm:px-5 sm:py-3",
        MOBILE_PANEL_CARD_CLASS,
        className,
      )}
    >
      <p className="h-5 w-full text-[14px] font-semibold leading-5 text-fg-muted">{title}</p>

      <div className="flex w-full flex-col gap-[12px]">
        {slice.map((r, i) => (
          <IntentPrefetchLink
            key={`${title}-${r.symbol}`}
            href={`/crypto/${encodeURIComponent(r.symbol)}`}
            prefetch={false}
            pendingAsset={{
              kind: "crypto",
              symbol: r.symbol,
              name: r.name,
              changePct: r.changePercent1D,
              logoUrl: r.logoUrl,
            }}
            aria-label={`Open ${r.name} (${r.symbol})`}
            className="group flex w-full items-center gap-[8px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-fg/20"
          >
            <p className="shrink-0 text-left text-[14px] font-semibold leading-5 tabular-nums text-fg-muted">
              {i + 1}
            </p>
            <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} symbol={r.symbol} size="sm" />
            <div className="flex min-w-0 flex-1 items-center gap-[4px] whitespace-nowrap">
              <p className="text-[14px] font-medium leading-5 text-fg group-hover:underline">
                {r.symbol}
              </p>
              <p className="truncate text-[12px] font-normal leading-4 text-fg group-hover:underline">
                {r.name}
              </p>
            </div>
            <ChangePct
              value={r.changePercent1D}
              className="w-auto shrink-0"
              textClassName="text-[14px] font-normal leading-5"
            />
          </IntentPrefetchLink>
        ))}
      </div>
    </div>
  );
}
