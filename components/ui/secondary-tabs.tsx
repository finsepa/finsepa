"use client";

import { cn } from "@/lib/utils";

/**
 * Design system: secondary tab row (e.g. Screener Companies / Gainers & Losers,
 * Portfolio Overview Assets / Allocation). Active tab uses a soft gray pill.
 */
export type SecondaryTabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Optional count/chip rendered after the label (e.g. asset count). */
  badge?: string | number;
};

export function SecondaryTabs<T extends string>({
  items,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
  listClassName,
}: {
  items: readonly SecondaryTabItem<T>[];
  value: T;
  onValueChange: (id: T) => void;
  "aria-label"?: string;
  className?: string;
  listClassName?: string;
}) {
  return (
    <div className={cn(className)}>
      <div
        className={cn(
          "flex flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden pb-0.5 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0",
          listClassName,
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(item.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-[10px] border border-solid px-[12px] py-2 text-[13px] font-medium leading-5 transition-[color,opacity,background-color,border-color] duration-100 sm:text-[14px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15 focus-visible:ring-offset-2",
                active
                  ? "border-[#E8E8EB] bg-[#F1F1F2] text-[#141414] opacity-100"
                  : "border-transparent bg-transparent text-[#141414] opacity-80 hover:bg-[#F1F1F2] hover:opacity-100",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                {item.badge != null && item.badge !== "" ? (
                  <span
                    className={cn(
                      "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[6px] text-[11px] font-medium tabular-nums leading-none text-[#141414] transition-colors duration-100",
                      active ? "bg-white" : "bg-[#E4E4E7]",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
