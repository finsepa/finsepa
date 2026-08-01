"use client";

/**
 * Design system: secondary tab row (e.g. Screener Companies / Gainers & Losers,
 * Portfolio Overview Assets / Allocation). Active tab uses a soft gray pill.
 * Dark: `surface-subtle` fill + light shadow (no stroke) — same as sidebar nav active.
 * No hover wash — inactive stays muted until selected.
 */
export type SecondaryTabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Optional count/chip rendered after the label (e.g. asset count). */
  badge?: string | number;
};

const tabBaseClass =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] px-[12px] text-[13px] font-medium leading-5 transition-[color,background-color,box-shadow] duration-100 sm:text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2";

const tabActiveClass =
  `${tabBaseClass} bg-surface-subtle text-fg dark:shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]`;

const tabInactiveClass = `${tabBaseClass} bg-transparent text-fg-muted`;

const tabListClass =
  "flex flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden pb-0.5 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0";

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
    <div className={className}>
      <div
        className={listClassName ? `${tabListClass} ${listClassName}` : tabListClass}
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
              suppressHydrationWarning
              onClick={() => onValueChange(item.id)}
              className={active ? tabActiveClass : tabInactiveClass}
            >
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                {item.badge != null && item.badge !== "" ? (
                  <span
                    suppressHydrationWarning
                    className={
                      active
                        ? "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[6px] text-[11px] font-medium tabular-nums leading-none text-fg transition-colors duration-100 bg-surface dark:bg-panel"
                        : "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[6px] text-[11px] font-medium tabular-nums leading-none text-fg transition-colors duration-100 bg-stroke"
                    }
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
