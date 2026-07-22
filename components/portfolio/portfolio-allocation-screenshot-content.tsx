"use client";

import { useMemo } from "react";

import { ChartScreenshotPortfolioHeader } from "@/components/chart/chart-screenshot-portfolio-header";
import { AllocationDonutCenterReturn } from "@/components/portfolio/allocation-donut-center-return";
import { AllocationDonutChart } from "@/components/portfolio/allocation-donut-chart";
import type { AllocationDonutRow } from "@/lib/portfolio/allocation-donut-rows";
import {
  ALLOCATION_RETURN_PERIOD_DEFAULT,
  type AllocationReturnPeriodId,
} from "@/lib/portfolio/allocation-return-period";
import { cn } from "@/lib/utils";

const pct1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function AllocationLegendColumn({
  rows,
  showValues,
  className,
}: {
  rows: AllocationDonutRow[];
  showValues: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex w-full min-w-0 flex-col gap-2.5", className)}>
      {rows.map((r) => (
        <li key={r.id} className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: r.color }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left text-[14px] leading-5 text-[#0F0F0F]">
            {r.name}
          </span>
          {showValues ? (
            <span className="shrink-0 text-right tabular-nums text-[14px] font-medium leading-5 text-[#0F0F0F]">
              {pct1.format(r.weightPct)}%
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PortfolioAllocationScreenshotContent({
  rows,
  portfolioName,
  portfolioLogoUrl,
  avatarImageSrc,
  avatarInitials,
  returnPct = null,
  returnPeriod = ALLOCATION_RETURN_PERIOD_DEFAULT,
  showSliceLabels,
  showLegend,
  showLegendValues,
  className,
}: {
  rows: AllocationDonutRow[];
  portfolioName: string;
  portfolioLogoUrl?: string | null;
  avatarImageSrc: string | null;
  avatarInitials: string;
  returnPct?: number | null;
  returnPeriod?: AllocationReturnPeriodId;
  showSliceLabels: boolean;
  showLegend: boolean;
  showLegendValues: boolean;
  className?: string;
}) {
  const { left, right } = useMemo(() => {
    const mid = Math.ceil(rows.length / 2);
    return { left: rows.slice(0, mid), right: rows.slice(mid) };
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className={cn("flex w-full min-w-0 flex-col", className)}>
      <ChartScreenshotPortfolioHeader
        portfolioName={portfolioName}
        logoUrl={portfolioLogoUrl}
        avatarImageSrc={avatarImageSrc}
        avatarInitials={avatarInitials}
        compact
      />
      <div className="mt-5 box-border flex min-w-0 items-center gap-5 rounded-[12px] border border-[#E4E4E7] bg-white px-5 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        <AllocationDonutChart
          rows={rows}
          center={
            <AllocationDonutCenterReturn
              returnPct={returnPct}
              period={returnPeriod}
              interactive={false}
            />
          }
          className="mx-0 shrink-0"
          chartSizePx={280}
          badgeOverflowPadPx={showSliceLabels ? 18 : 8}
          showExternalLabels={showSliceLabels}
        />
        {showLegend ? (
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-10 gap-y-0">
            <AllocationLegendColumn rows={left} showValues={showLegendValues} />
            <AllocationLegendColumn rows={right} showValues={showLegendValues} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
