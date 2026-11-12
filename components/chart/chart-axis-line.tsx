import { cn } from "@/lib/utils";

/** Text sizing of the standard period axis label (11px, 12px from `sm`, no leading). */
export const PERIOD_AXIS_LABEL_TEXT_CLASS = "text-[11px] leading-none sm:text-[12px]";

/**
 * Full-width x-axis line joining the `.chart-axis-tick` marks. Render it inside the label row with the
 * same vertical position classes (`className`) and text sizing (`labelClassName`) as the row's labels:
 * the line is drawn just above this invisible stand-in label, so it meets the tick tops.
 */
export function ChartAxisLine({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  return (
    <span aria-hidden className={cn("chart-axis-line pointer-events-none absolute inset-x-0 flex", className)}>
      <span className={cn("invisible inline-block", labelClassName)}>0</span>
    </span>
  );
}
