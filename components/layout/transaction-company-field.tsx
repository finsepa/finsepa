"use client";

import { ChevronDown, X } from "lucide-react";

import { CompanyPicker, type CompanyPick } from "@/components/charting/company-picker";

/** Ticker/Company row for New Transaction — same picker as Charting + Company (screener + search). */
export function TransactionCompanyField({
  value,
  onChange,
}: {
  value: CompanyPick | null;
  onChange: (next: CompanyPick | null) => void;
}) {
  return (
    <CompanyPicker
      onPick={(p) => onChange(p)}
      maxExtraCompanies={99}
      excludeSymbols={[]}
    >
      {({ setOpen, atCapacity }) => (
        <div className="relative w-full">
          <button
            type="button"
            disabled={atCapacity}
            onClick={() => {
              if (atCapacity) return;
              setOpen(true);
            }}
            className="flex h-9 w-full min-w-0 items-center rounded-[10px] bg-[#F4F4F5] py-2 pl-4 pr-11 text-left text-sm transition-colors hover:bg-[#EBEBEB] disabled:opacity-50"
          >
            <span
              className={
                value
                  ? "min-w-0 flex-1 truncate font-medium text-[#09090B]"
                  : "min-w-0 flex-1 truncate text-[#71717A]"
              }
            >
              {value
                ? `${value.name} · ${value.symbol}`
                : "Start entering in the ticker or company name"}
            </span>
          </button>
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#09090B] hover:bg-black/5"
              aria-label="Remove company"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : (
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#09090B]"
              aria-hidden
            />
          )}
        </div>
      )}
    </CompanyPicker>
  );
}
