"use client";

import { memo } from "react";
import { ArrowUp, MoreHorizontal, Settings } from "lucide-react";

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
    <div className={cn("w-full overflow-x-auto pb-8", className)}>
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E4E4E7] text-left text-[#71717A]">
            <th className="pb-3 pr-4 font-medium">
              <span className="inline-flex items-center gap-1">
                Asset
                <Settings className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </span>
            </th>
            <th className="whitespace-nowrap pb-3 pr-4 font-medium">Average price</th>
            <th className="whitespace-nowrap pb-3 pr-4 font-medium">Cost basis</th>
            <th className="whitespace-nowrap pb-3 pr-4 font-medium">Current value</th>
            <th className="whitespace-nowrap pb-3 pr-4 font-medium">Return % (tot.)</th>
            <th className="whitespace-nowrap pb-3 pr-4 font-medium">Return (tot.)</th>
            <th className="whitespace-nowrap pb-3 pr-4 font-medium">
              <span className="inline-flex items-center gap-1">
                Weight
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </span>
            </th>
            <th className="w-12 pb-3 pr-0 font-medium" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ holding: h, retUsd, retPct, weightPct }) => (
            <tr key={h.id} className="border-b border-[#E4E4E7]">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <CompanyLogo name={h.name} logoUrl={h.logoUrl ?? ""} symbol={h.symbol} />
                  <div className="min-w-0">
                    <div className="font-semibold text-[#09090B]">{h.name}</div>
                    <div className="text-xs text-[#71717A]">{h.symbol}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                {usd.format(h.avgPrice)}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                {usd0.format(h.costBasis)}
              </td>
              <td className="whitespace-nowrap py-3 pr-4">
                <div className="font-semibold tabular-nums text-[#09090B]">{usd0.format(h.currentValue)}</div>
                <div className="text-xs tabular-nums text-[#71717A]">{usd.format(h.marketPrice)}</div>
              </td>
              <td
                className={`whitespace-nowrap py-3 pr-4 font-medium tabular-nums ${
                  retPct >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatSignedPct(retPct)}
              </td>
              <td
                className={`whitespace-nowrap py-3 pr-4 font-medium tabular-nums ${
                  retUsd >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatSignedUsd(retUsd)}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-[#09090B]">
                {pct.format(weightPct)}%
              </td>
              <td className="py-3 pr-0 text-right">
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
