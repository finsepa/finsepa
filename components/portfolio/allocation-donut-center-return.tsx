"use client";

import { useEffect, useRef, useState } from "react";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { Check, ChevronDown } from "@/lib/icons";
import {
  ALLOCATION_RETURN_PERIOD_DEFAULT,
  ALLOCATION_RETURN_PERIODS,
  allocationReturnDietzKey,
  allocationReturnPeriodLabel,
  type AllocationReturnPeriodId,
} from "@/lib/portfolio/allocation-return-period";
import { fetchPortfolioDietzReturnsClient } from "@/lib/portfolio/returns/fetch-dietz-returns-client";
import { cn } from "@/lib/utils";

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAllocationReturnPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pctFmt.format(pct)}%`;
}

export function allocationReturnToneClass(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "text-[#71717A]";
  if (pct > 0) return "text-[#16A34A]";
  if (pct < 0) return "text-[#DC2626]";
  return "text-[#0F0F0F]";
}

function PeriodTrigger({
  period,
  onPeriodChange,
  interactive,
}: {
  period: AllocationReturnPeriodId;
  onPeriodChange?: (next: AllocationReturnPeriodId) => void;
  interactive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!interactive || !onPeriodChange) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[12px] font-medium leading-4 text-[#71717A]">
        {allocationReturnPeriodLabel(period)}
        <ChevronDown className="h-3 w-3 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Return period"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded-md px-0.5 py-0.5 text-[12px] font-medium leading-4 text-[#71717A] outline-none transition-colors hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/10"
      >
        {allocationReturnPeriodLabel(period)}
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 text-[#71717A] transition-transform", open && "rotate-180")}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <TopbarDropdownPortal
        open={open}
        anchorRef={triggerRef}
        align="center"
        placement="auto"
        sheetTitle="Return period"
        onRequestClose={() => setOpen(false)}
        className="w-[8.5rem]"
      >
        <div
          role="listbox"
          aria-label="Return period"
          className={dropdownMenuPanelClassName("max-md:w-full max-md:!border-0")}
        >
          {ALLOCATION_RETURN_PERIODS.map((opt) => {
            const selected = opt.id === period;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onPeriodChange(opt.id);
                  setOpen(false);
                }}
                className={dropdownMenuPlainItemRowClassName({ selected })}
              >
                <span className="min-w-0 flex-1 text-left whitespace-nowrap font-medium">
                  {opt.label}
                </span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  <Check
                    className={cn("h-4 w-4 text-[#0F0F0F]", !selected && "invisible")}
                    strokeWidth={2}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </TopbarDropdownPortal>
    </>
  );
}

/**
 * Donut hole content: period return % + period dropdown (1D / 7D / … / ALL — same as chart).
 */
export function AllocationDonutCenterReturn({
  returnPct,
  period,
  onPeriodChange,
  interactive = true,
  loading = false,
  className,
}: {
  returnPct: number | null;
  period: AllocationReturnPeriodId;
  onPeriodChange?: (next: AllocationReturnPeriodId) => void;
  /** When false (screenshot), show static period label without a menu. */
  interactive?: boolean;
  /** True while Dietz for the selected period is loading — show skeleton, not "—". */
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[7.5rem] flex-col items-center gap-0.5 px-1 text-center", className)}>
      {loading && returnPct == null ? (
        <div className="h-5 w-14 animate-pulse rounded bg-neutral-200 sm:h-[1.125rem]" aria-hidden />
      ) : (
        <div
          className={cn(
            "text-[16px] font-semibold leading-5 tabular-nums tracking-tight sm:text-[18px]",
            allocationReturnToneClass(returnPct),
          )}
        >
          {formatAllocationReturnPct(returnPct)}
        </div>
      )}
      <PeriodTrigger period={period} onPeriodChange={onPeriodChange} interactive={interactive} />
    </div>
  );
}

/** Fetch Dietz % for the allocation center period. */
export function useAllocationPeriodReturn(
  transactions: PortfolioTransaction[],
  period: AllocationReturnPeriodId,
): { pct: number | null; loading: boolean } {
  const [pct, setPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(() => transactions.length > 0);
  const loadedPeriodRef = useRef<AllocationReturnPeriodId | null>(null);

  useEffect(() => {
    if (transactions.length === 0) {
      setPct(null);
      setLoading(false);
      loadedPeriodRef.current = null;
      return;
    }
    let cancelled = false;
    const dietzKey = allocationReturnDietzKey(period);
    const periodChanged = loadedPeriodRef.current !== period;
    if (periodChanged || loadedPeriodRef.current == null) {
      if (periodChanged) setPct(null);
      setLoading(true);
    }
    const run = async () => {
      try {
        const data = await fetchPortfolioDietzReturnsClient(transactions, [dietzKey]);
        if (cancelled) return;
        const row = data[dietzKey];
        setPct(row?.pct ?? null);
        loadedPeriodRef.current = period;
        setLoading(false);
      } catch {
        if (cancelled) return;
        // Keep prior pct on transient failure only when period did not change.
        if (periodChanged) setPct(null);
        setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [transactions, period]);

  return { pct, loading };
}

export { ALLOCATION_RETURN_PERIOD_DEFAULT };
