"use client";

import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/design-system";

export type FinancialsStatementView = "income" | "balance" | "cashflow" | "ratios";

const OPTIONS: readonly SegmentedControlOption<FinancialsStatementView>[] = [
  { value: "income", label: "Income" },
  { value: "balance", label: "Balance Sheet" },
  { value: "cashflow", label: "Cash Flow" },
  { value: "ratios", label: "Ratios" },
];

/** Same control as chart time range — {@link SegmentedControl} from design system. */
export function StockFinancialsSegmentedToggle({
  value,
  onChange,
}: {
  value: FinancialsStatementView;
  onChange: (next: FinancialsStatementView) => void;
}) {
  return (
    <div className="-mx-1 min-w-0 max-w-full flex-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:max-w-none sm:flex-initial sm:overflow-visible sm:pb-0">
      <SegmentedControl
        options={OPTIONS}
        value={value}
        onChange={onChange}
        size="sm"
        aria-label="Financial statement category"
        className="min-w-min flex-nowrap"
      />
    </div>
  );
}
