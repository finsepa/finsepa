"use client";

import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";

export type CashDirection = "in" | "out" | "other_income" | "other_expense";

const OPTIONS: ListboxOption<CashDirection>[] = [
  { value: "in", label: "Cash In" },
  { value: "out", label: "Cash Out" },
  { value: "other_income", label: "Other income" },
  { value: "other_expense", label: "Other expense" },
];

/** Stored on `PortfolioTransaction.operation` for cash rows. */
export function cashOperationLabel(d: CashDirection): string {
  return OPTIONS.find((o) => o.value === d)?.label ?? "Cash In";
}

/** Signed ledger `sum` for a cash amount entered as a positive number. */
export function cashSignedAmount(d: CashDirection, amountPositive: number): number {
  return d === "in" || d === "other_income" ? amountPositive : -amountPositive;
}

export function cashDirectionFromOperation(operation: string): CashDirection {
  const op = operation.trim();
  if (op === "Cash In") return "in";
  if (op === "Cash Out") return "out";
  if (op === "Other income") return "other_income";
  if (op === "Other expense") return "other_expense";
  const u = op.toLowerCase();
  if (u.includes("cash out")) return "out";
  if (u.includes("other expense")) return "other_expense";
  if (u.includes("other income")) return "other_income";
  return "in";
}

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
