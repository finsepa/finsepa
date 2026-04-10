"use client";

import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";

export type IncomeOperation = "Dividend" | "Other Income";

const OPTIONS: ListboxOption<IncomeOperation>[] = [
  { value: "Dividend", label: "Dividend" },
  { value: "Other Income", label: "Other Income" },
];

export function TransactionIncomeOperationSelect({
  id,
  value,
  onChange,
  "aria-label": ariaLabel = "Income type",
}: {
  id?: string;
  value: IncomeOperation;
  onChange: (next: IncomeOperation) => void;
  "aria-label"?: string;
}) {
  return (
    <FormListboxSelect
      id={id}
      value={value}
      onChange={onChange}
      options={OPTIONS}
      aria-label={ariaLabel}
    />
  );
}
