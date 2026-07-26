"use client";

import { Search, X } from "@/lib/icons";

export function SuperinvestorTransactionsSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative min-w-[200px] max-w-full flex-1 sm:w-[260px] sm:flex-none">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C5D5F]"
        strokeWidth={1.5}
        aria-hidden
      />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type to search..."
        className="h-9 w-full rounded-[10px] border-0 bg-[#F4F4F5] py-2 pl-9 pr-9 text-sm text-[#141414] placeholder:text-[#5C5D5F] outline-none focus:ring-2 focus:ring-[#141414]/10"
        aria-label="Search activity by company name or ticker"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5C5D5F] transition-colors hover:bg-[#EBEBEB] hover:text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/10"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
