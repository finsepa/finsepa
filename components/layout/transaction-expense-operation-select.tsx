"use client";

import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";

export const EXPENSE_OPERATION_VALUES = ["Other expense", "Fees"] as const;
export type ExpenseOperation = (typeof EXPENSE_OPERATION_VALUES)[number];

const OPTIONS: ListboxOption<ExpenseOperation>[] = EXPENSE_OPERATION_VALUES.map((v) => ({
  value: v,
  label: v,
}));

export function TransactionExpenseOperationSelect({
  id,
  value,
  onChange,
  "aria-label": ariaLabel = "Expense type",
}: {
  id?: string;
  value: ExpenseOperation;
  onChange: (next: ExpenseOperation) => void;
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
