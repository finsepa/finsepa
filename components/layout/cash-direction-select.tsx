"use client";

import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";

export type CashDirection = "in" | "out";

const OPTIONS: ListboxOption<CashDirection>[] = [
  { value: "in", label: "Cash In" },
  { value: "out", label: "Cash Out" },
];

export function CashDirectionSelect({
  id,
  value,
  onChange,
  "aria-label": ariaLabel = "Operation type",
}: {
  id?: string;
  value: CashDirection;
  onChange: (next: CashDirection) => void;
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
