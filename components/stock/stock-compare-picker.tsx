"use client";

import { CompanyPicker, type CompanyPick } from "@/components/charting/company-picker";

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
 * Overview toolbar: one field-shaped control — “Compare” prefix, chips, and chevron.
 * Shell matches {@link FormListboxSelect} (gray fill, no border/shadow); chips stay lightly outlined.
 */
export function StockComparePicker({ baseTicker, values, onAdd, onRemove }: Props) {
  const excludeSymbols = [baseTicker.trim().toUpperCase(), ...values.map((v) => v.symbol.trim().toUpperCase())];
  const maxExtra = Math.max(0, MAX_OVERVIEW_COMPARE - values.length);

  return (
    <CompanyPicker onPick={onAdd} disabled={false} maxExtraCompanies={maxExtra} excludeSymbols={excludeSymbols} includeCrypto={false}>
      {({ open, setOpen, atCapacity }) => (
        <div className="relative min-w-[min(100%,220px)] max-w-full flex-1 sm:max-w-[min(100%,560px)]">
          <div
            tabIndex={0}
            aria-label="Compare stocks, open picker to add companies"
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
            className={`relative flex h-9 w-full cursor-pointer items-center rounded-[10px] bg-[#F4F4F5] py-2 pl-4 pr-10 text-left text-sm font-normal outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#09090B]/10 ${
              atCapacity ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 select-none text-sm font-normal leading-5 text-[#71717A]">Compare</span>
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
          </div>
          <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#09090B]" />
        </div>
      )}
    </CompanyPicker>
  );
}
