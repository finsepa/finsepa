"use client";

import type { ChartScreenshotExportOptions } from "@/lib/chart/chart-screenshot-export-options";
import { cn } from "@/lib/utils";

function PillSwitch({
  pressed,
  onPressedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 disabled:cursor-not-allowed disabled:opacity-40",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed && "translate-x-4",
        )}
        aria-hidden
      />
    </button>
  );
}

type SettingRowProps = {
  label: string;
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
};

function SettingRow({ label, pressed, onPressedChange, disabled }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      <PillSwitch
        pressed={pressed}
        onPressedChange={onPressedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

export function ChartScreenshotExportSettings({
  value,
  onChange,
  disabled,
}: {
  value: ChartScreenshotExportOptions;
  onChange: (next: ChartScreenshotExportOptions) => void;
  disabled?: boolean;
}) {
  const patch = (partial: Partial<ChartScreenshotExportOptions>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="flex h-full flex-col px-5 py-4">
      <SettingRow
        label="Show values"
        pressed={value.showValues}
        onPressedChange={(showValues) => patch({ showValues })}
        disabled={disabled}
      />
      <SettingRow
        label="Show vertical legend"
        pressed={value.showVerticalLegend}
        onPressedChange={(showVerticalLegend) => patch({ showVerticalLegend })}
        disabled={disabled}
      />
      <SettingRow
        label="Show horizontal legend"
        pressed={value.showHorizontalLegend}
        onPressedChange={(showHorizontalLegend) => patch({ showHorizontalLegend })}
        disabled={disabled}
      />
    </div>
  );
}
