"use client";

import { SegmentedControl, type SegmentedControlOption } from "./segmented-control";

/**
 * Charting / analytics tab switcher — thin alias over {@link SegmentedControl} for Annual / Quarterly
 * and similar compact toolbars.
 */
export type TabSwitcherOption<T extends string = string> = SegmentedControlOption<T>;

export function TabSwitcher<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
  fullWidth = true,
}: {
  options: readonly TabSwitcherOption<T>[];
  value: T;
  onChange: (next: T) => void;
  "aria-label"?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <SegmentedControl
      options={options}
      value={value}
      onChange={onChange}
      size="md"
      fullWidth={fullWidth}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
