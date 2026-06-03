"use client";

import { CompanyPicker, type CompanyPick } from "@/components/charting/company-picker";

/** Ticker/Company row for New Transaction — global-search-style shell + portaled picker (stocks + crypto). */
export function TransactionCompanyField({
  value,
  onChange,
}: {
  value: CompanyPick | null;
  onChange: (next: CompanyPick | null) => void;
}) {
  return (
    <CompanyPicker
      variant="inline-search"
      selected={value}
      onClearSelection={() => onChange(null)}
      onPick={(p) => onChange(p)}
      maxExtraCompanies={99}
      excludeSymbols={[]}
      menuPortal
      menuAlign="leading"
      shellClassName="rounded-[10px]"
      placeholder="Start entering a ticker, company, or crypto name"
    />
  );
}
