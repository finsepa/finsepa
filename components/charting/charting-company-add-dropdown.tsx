"use client";

import { Plus } from "lucide-react";

import { CompanyPicker } from "@/components/charting/company-picker";

/** + Add Company: screener page 1+2 list when opened (then `/api/search` when typing). */
export function ChartingCompanyAddDropdown({
  onPickStock,
  disabled,
  maxExtraCompanies,
  excludeSymbols = [],
}: {
  onPickStock: (symbol: string) => void;
  disabled?: boolean;
  /** Max additional symbols (primary is separate). */
  maxExtraCompanies: number;
  /** Hide these tickers from the screener list (e.g. primary + already compared). */
  excludeSymbols?: string[];
}) {
  return (
    <CompanyPicker
      onPick={({ symbol }) => onPickStock(symbol)}
      disabled={disabled}
      maxExtraCompanies={maxExtraCompanies}
      excludeSymbols={excludeSymbols}
      includeCrypto={false}
    >
      {({ open, setOpen, atCapacity }) => (
        <button
          type="button"
          onClick={() => {
            if (atCapacity) return;
            setOpen((o) => {
              if (o) return false;
              return true;
            });
          }}
          disabled={atCapacity}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B] transition-colors hover:bg-[#EBEBEB] disabled:pointer-events-none disabled:opacity-50"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          Add Company
        </button>
      )}
    </CompanyPicker>
  );
}
