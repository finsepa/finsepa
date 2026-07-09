"use client";

import { CompanyPicker, type CompanyPick } from "@/components/charting/company-picker";
import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
} from "@/components/design-system/topbar-control-classes";
import { IntersectCircle } from "@/lib/icons";
import { cn } from "@/lib/utils";

const MAX_OVERVIEW_COMPARE = 12;

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  baseTicker: string;
  values: readonly CompanyPick[];
  onAdd: (pick: CompanyPick) => void;
  onRemove: (symbol: string) => void;
};

/**
 * Overview toolbar: white icon trigger when empty; chips + chevron when symbols are selected.
 */
export function StockComparePicker({ baseTicker, values, onAdd, onRemove }: Props) {
  const excludeSymbols = [baseTicker.trim().toUpperCase(), ...values.map((v) => v.symbol.trim().toUpperCase())];
  const maxExtra = Math.max(0, MAX_OVERVIEW_COMPARE - values.length);
  const hasPicks = values.length > 0;

  return (
    <CompanyPicker
      onPick={onAdd}
      disabled={false}
      maxExtraCompanies={maxExtra}
      excludeSymbols={excludeSymbols}
      includeCrypto={false}
      includeEtfs
      menuAlign="trailing"
      placeholder="Compare to..."
      wrapClassName="relative min-w-0 w-full sm:w-auto"
    >
      {({ open, setOpen, atCapacity }) => (
        <div
          className={cn(
            "relative min-w-0",
            hasPicks ?
              "w-full sm:min-w-[220px] sm:w-auto sm:max-w-[min(560px,calc(100vw-12rem))]"
            : "w-9 shrink-0",
          )}
        >
          <div
            tabIndex={0}
            aria-label="Compare stocks and ETFs, open picker to add companies"
            aria-expanded={open}
            onKeyDown={(e) => {
              if (atCapacity) return;
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              setOpen(true);
            }}
            onClick={(e) => {
              if (atCapacity) return;
              if ((e.target as HTMLElement).closest("[data-compare-chip-remove]")) return;
              setOpen(true);
            }}
            className={cn(
              "relative flex h-9 cursor-pointer items-center rounded-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#09090B]/10",
              hasPicks
                ? "w-full bg-[#F4F4F5] py-2 pl-4 pr-10 text-left text-sm font-normal hover:bg-[#EBEBEB]"
                : cn(topbarSquircleIconClass, "w-9 justify-center", open && topbarSquircleActiveClass),
              atCapacity && "cursor-not-allowed opacity-50",
            )}
          >
            {hasPicks ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {values.map((v) => (
                <div
                  key={v.symbol.toUpperCase()}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-5 max-w-[220px] shrink-0 items-center gap-0.5 rounded-md border border-[#E4E4E7] bg-white py-0 pl-1.5 pr-0.5 text-[11px] font-medium leading-none text-[#09090B]"
                >
                  <span className="min-w-0 truncate">
                    {v.name} · {v.symbol}
                  </span>
                  <button
                    type="button"
                    data-compare-chip-remove
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(v.symbol);
                    }}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#09090B] hover:bg-black/5"
                    aria-label={`Remove ${v.symbol} from comparison`}
                  >
                    <IconX className="h-3 w-3 text-[#09090B]" />
                  </button>
                </div>
                ))}
              </div>
            ) : (
              <IntersectCircle className="h-5 w-5 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
            )}
          </div>
          {hasPicks ? (
            <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#09090B]" />
          ) : null}
        </div>
      )}
    </CompanyPicker>
  );
}
