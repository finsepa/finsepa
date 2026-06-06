"use client";

import { Plus } from "@/lib/icons";

import { CompanyPicker } from "@/components/charting/company-picker";
import { secondaryFillButtonClassName } from "@/components/design-system";

/** + Add Company: screener stocks when opened; `/api/search?scope=equities` when typing (no ETFs). */
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
          className={secondaryFillButtonClassName}
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
