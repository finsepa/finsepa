"use client";

import { SegmentedControl, type SegmentedControlOption } from "@/components/design-system";
import { LineChart } from "@/lib/icons";

export type ChartType = "line" | "candles";

function CandlesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className={className} aria-hidden>
      <path d="M7 3v3M7 15v6M17 3v5M17 17v4" />
      <rect x="4.5" y="6" width="5" height="9" rx="1" />
      <rect x="14.5" y="8" width="5" height="9" rx="1" />
    </svg>
  );
}

const OPTIONS: readonly SegmentedControlOption<ChartType>[] = [
  { value: "line", label: <LineChart className="size-4" aria-hidden />, "aria-label": "Line chart" },
  { value: "candles", label: <CandlesIcon className="size-4" />, "aria-label": "Candlestick chart" },
];

export function ChartTypeToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: ChartType;
  onChange: (value: ChartType) => void;
  disabled?: boolean;
}) {
  return (
    <SegmentedControl
      options={OPTIONS.map((o) => ({ ...o, disabled }))}
      value={value}
      onChange={onChange}
      size="sm"
      aria-label="Chart type"
    />
  );
}
