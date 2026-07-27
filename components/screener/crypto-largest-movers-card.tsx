"use client";

import { useMemo } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import { CompanyLogo } from "@/components/screener/company-logo";

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pctClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#5C5D5F]";
  return value >= 0 ? "text-[#16A34A]" : "text-[#B91C1C]";
}

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
      <p className="h-5 w-full text-[14px] font-semibold leading-5 text-[#5C5D5F]">{title}</p>

      <div className="flex w-full flex-col gap-[12px]">
        {slice.map((r, i) => (
          <Link
            key={`${title}-${r.symbol}`}
            href={`/crypto/${encodeURIComponent(r.symbol)}`}
            prefetch={false}
            aria-label={`Open ${r.name} (${r.symbol})`}
            className="group flex w-full items-center gap-[8px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/20"
          >
            <p className="shrink-0 text-left text-[14px] font-semibold leading-5 tabular-nums text-[#5C5D5F]">
              {i + 1}
            </p>
            <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} symbol={r.symbol} size="sm" />
            <div className="flex min-w-0 flex-1 items-center gap-[4px] whitespace-nowrap">
              <p className="text-[14px] font-medium leading-5 text-[#141414] group-hover:underline">
                {r.symbol}
              </p>
              <p className="truncate text-[12px] font-normal leading-4 text-[#5C5D5F] group-hover:underline">
                {r.name}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 text-right text-[14px] font-normal leading-5 tabular-nums",
                pctClass(r.changePercent1D),
              )}
            >
              {formatPct(r.changePercent1D)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

