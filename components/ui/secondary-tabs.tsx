"use client";

import { cn } from "@/lib/utils";

/**
 * Design system: secondary tab row (e.g. Screener Companies / Gainers & Losers,
 * Portfolio Overview Assets / Allocation). Active tab uses a soft gray pill.
 */
export type SecondaryTabItem<T extends string = string> = {
  id: T;
  label: string;
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
          "flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden pb-0.5 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0",
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
                "shrink-0 whitespace-nowrap rounded-[10px] px-3 py-2 text-[13px] font-medium leading-5 text-[#09090B] transition-colors duration-100 sm:px-5 sm:text-[14px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                active ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]/80",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
