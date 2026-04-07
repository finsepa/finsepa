"use client";

import { memo } from "react";
import { MoreHorizontal } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pct.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function PortfolioHoldingsTableInner({
  holdings,
  className,
}: {
  holdings: PortfolioHolding[];
  className?: string;
}) {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  const rows = holdings.map((h) => {
    const retUsd = h.currentValue - h.costBasis;
    const retPct = h.costBasis > 0 ? ((h.currentValue - h.costBasis) / h.costBasis) * 100 : 0;
    const weightPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
    return { holding: h, retUsd, retPct, weightPct };
  });

  const sorted = [...rows].sort((a, b) => b.weightPct - a.weightPct);

  return (
    <div
      className={cn(
        "w-full overflow-x-auto border-t border-[#E4E4E7] pb-8",
        className,
      )}
    >
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className="min-h-[44px] border-b border-[#E4E4E7] bg-white text-[14px] font-medium leading-5 text-[#71717A]">
            <th className="whitespace-nowrap px-4 py-3 text-left">Asset</th>
            <th className="whitespace-nowrap px-4 py-3 text-center">Average price</th>
            <th className="whitespace-nowrap px-4 py-3 text-center">Cost basis</th>
            <th className="whitespace-nowrap px-4 py-3 text-center">Current value</th>
            <th className="whitespace-nowrap px-4 py-3 text-center">Return % (tot.)</th>
            <th className="whitespace-nowrap px-4 py-3 text-center">Return (tot.)</th>
            <th className="whitespace-nowrap px-4 py-3 text-center">Weight</th>
            <th className="w-12 px-4 py-3 text-right" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ holding: h, retUsd, retPct, weightPct }) => (
            <tr
              key={h.id}
              className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 last:border-b-0 hover:bg-neutral-50"
            >
              <td className="align-middle px-4 py-0">
                <div className="flex items-center gap-3">
                  <CompanyLogo name={h.name} logoUrl={h.logoUrl ?? ""} symbol={h.symbol} />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{h.name}</div>
                    <div className="text-[12px] font-normal leading-4 text-[#71717A]">{h.symbol}</div>
                  </div>
                </div>
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-center font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
                {usd.format(h.avgPrice)}
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-center font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
                {usd0.format(h.costBasis)}
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-center">
                <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
                  {usd0.format(h.currentValue)}
                </div>
                <div className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
                  {usd.format(h.marketPrice)}
                </div>
              </td>
              <td
                className={`align-middle whitespace-nowrap px-4 py-3 text-center text-[14px] font-medium leading-5 tabular-nums ${
                  retPct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {formatSignedPct(retPct)}
              </td>
              <td
                className={`align-middle whitespace-nowrap px-4 py-3 text-center text-[14px] font-medium leading-5 tabular-nums ${
                  retUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {formatSignedUsd(retUsd)}
              </td>
              <td className="align-middle whitespace-nowrap px-4 py-3 text-center font-['Inter'] text-[14px] leading-5 tabular-nums text-[#09090B]">
                {pct.format(weightPct)}%
              </td>
              <td className="align-middle px-4 py-3 text-right">
                <button
                  type="button"
                  aria-label="More"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PortfolioHoldingsTable = memo(PortfolioHoldingsTableInner);
