"use client";

import { memo, useMemo } from "react";

import { AllocationDonutChart } from "@/components/portfolio/allocation-donut-chart";
import { PortfolioHoldingsEmptyState } from "@/components/portfolio/portfolio-holdings-empty-state";
import { useAllocationCenterAvatar } from "@/components/portfolio/use-allocation-center-avatar";
import { UserAvatar } from "@/components/user/user-avatar";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { AllocationDonutRow } from "@/lib/portfolio/allocation-donut-rows";
import { buildPortfolioAllocationRows } from "@/lib/portfolio/portfolio-allocation-rows";
import { cn } from "@/lib/utils";

const pct1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function AllocationColumn({
  rows,
  className,
}: {
  rows: AllocationDonutRow[];
  className?: string;
}) {
  return (
    <ul className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      {rows.map((r) => (
        <li key={r.id} className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: r.color }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left text-[14px] leading-5 text-[#09090B]">
            {r.name}
          </span>
          <span className="shrink-0 text-right tabular-nums text-[14px] font-medium leading-5 text-[#09090B]">
            {pct1.format(r.weightPct)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function PortfolioAllocationViewInner({
  holdings,
  transactions,
  readOnly = false,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  readOnly?: boolean;
}) {
  const rows = useMemo(() => buildPortfolioAllocationRows(holdings, transactions), [holdings, transactions]);
  const { imageSrc, initials } = useAllocationCenterAvatar();

  const { left, right } = useMemo(() => {
    const mid = Math.ceil(rows.length / 2);
    return { left: rows.slice(0, mid), right: rows.slice(mid) };
  }, [rows]);

  if (rows.length === 0) {
    return <PortfolioHoldingsEmptyState readOnly={readOnly} />;
  }

  return (
    <div className="rounded-[12px] border border-[#E4E4E7] bg-white py-5 pl-6 pr-8 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] max-md:rounded-none max-md:border-0 max-md:p-0 max-md:shadow-none sm:pr-10 lg:pr-12">
      <div className="flex flex-col md:hidden">
        <div className="flex justify-center overflow-visible px-4 -mt-1 pt-0">
          <AllocationDonutChart
            rows={rows}
            center={<UserAvatar imageSrc={imageSrc} initials={initials} size="xl" />}
            badgeOverflowPadPx={18}
            className="mx-auto shrink-0"
          />
        </div>
        <div className="px-4 pb-4 pt-0">
          <AllocationColumn rows={rows} />
        </div>
      </div>

      <div className="hidden flex-col items-stretch gap-8 md:flex lg:flex-row lg:items-center lg:gap-6">
        <AllocationDonutChart
          rows={rows}
          center={<UserAvatar imageSrc={imageSrc} initials={initials} size="xl" />}
          className="mx-auto shrink-0 lg:mx-0 lg:-mr-2"
        />

        <div className="mx-auto grid min-w-0 max-w-4xl flex-1 grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-x-10 lg:gap-x-12">
          <AllocationColumn rows={left} />
          <AllocationColumn rows={right} />
        </div>
      </div>
    </div>
  );
}

export const PortfolioAllocationView = memo(PortfolioAllocationViewInner);
