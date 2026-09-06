"use client";

import type { ChartScreenshotExportOptions } from "@/lib/chart/chart-screenshot-export-options";
import type { ChartScreenshotSnapshotVariant } from "@/lib/chart/chart-screenshot-types";
import { PillSwitch } from "@/components/ui/pill-switch";
import { cn } from "@/lib/utils";

type SettingRowProps = {
  label: string;
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
};

function SettingRow({ label, pressed, onPressedChange, disabled }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-medium leading-5 text-fg">{label}</span>
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
  variant = "charting",
}: {
  value: ChartScreenshotExportOptions;
  onChange: (next: ChartScreenshotExportOptions) => void;
  disabled?: boolean;
  variant?: ChartScreenshotSnapshotVariant;
}) {
  const patch = (partial: Partial<ChartScreenshotExportOptions>) => {
    onChange({ ...value, ...partial });
  };

  if (variant === "keyStatsMetric") {
    return (
      <div className="flex h-full flex-col px-5 py-4">
        <SettingRow
          label="Show values"
          pressed={value.showValues}
          onPressedChange={(showValues) => patch({ showValues })}
          disabled={disabled}
        />
        <SettingRow
          label="Avg. line"
          pressed={value.showAvgLine ?? false}
          onPressedChange={(showAvgLine) => patch({ showAvgLine })}
          disabled={disabled}
        />
        <SettingRow
          label="Max line"
          pressed={value.showMaxLine ?? false}
          onPressedChange={(showMaxLine) => patch({ showMaxLine })}
          disabled={disabled}
        />
        <SettingRow
          label="Min line"
          pressed={value.showMinLine ?? false}
          onPressedChange={(showMinLine) => patch({ showMinLine })}
          disabled={disabled}
        />
      </div>
    );
  }

  if (variant === "portfolioAllocation") {
    return (
      <div className="flex h-full flex-col px-5 py-4">
        <SettingRow
          label="Show slice labels"
          pressed={value.showAllocationSliceLabels ?? true}
          onPressedChange={(showAllocationSliceLabels) => patch({ showAllocationSliceLabels })}
          disabled={disabled}
        />
        <SettingRow
          label="Show legend"
          pressed={value.showAllocationLegend ?? true}
          onPressedChange={(showAllocationLegend) => patch({ showAllocationLegend })}
          disabled={disabled}
        />
        <SettingRow
          label="Show values"
          pressed={value.showValues}
          onPressedChange={(showValues) => patch({ showValues })}
          disabled={disabled || !(value.showAllocationLegend ?? true)}
        />
      </div>
    );
  }

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
