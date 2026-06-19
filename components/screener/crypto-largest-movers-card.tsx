"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { MOBILE_CARD_SURFACE_CLASS } from "@/components/design-system/card-surface-styles";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import { CompanyLogo } from "@/components/screener/company-logo";

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pctClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#71717A]";
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
        "flex min-h-[188px] min-w-0 flex-col gap-[12px] rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-3 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] sm:px-5 sm:py-3",
        MOBILE_CARD_SURFACE_CLASS,
        className,
      )}
    >
      <p className="w-full text-[14px] font-semibold leading-5 text-[#71717A]">{title}</p>

      <div className="flex w-full flex-col gap-[12px]">
        {slice.map((r, i) => (
          <div key={`${title}-${r.symbol}`} className="flex w-full items-center justify-center">
            <div className="flex w-[24px] items-center justify-center">
              <p className="text-[14px] font-semibold leading-5 text-[#71717A]">{i + 1}</p>
            </div>

            <div className="flex min-w-0 flex-1 items-center">
              <div className="flex shrink-0 items-center gap-[8px]">
                <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} symbol={r.symbol} size="sm" />
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-[4px] whitespace-nowrap">
                    <p className="text-[14px] font-medium leading-5 text-[#09090B]">
                      {r.symbol}
                    </p>
                    <p className="text-[12px] font-normal leading-4 text-[#71717A]">{r.name}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center">
              <p className={cn("min-w-0 flex-1 text-right text-[14px] font-normal leading-5", pctClass(r.changePercent1D))}>
                {formatPct(r.changePercent1D)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

