"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

const defaultClassNames = getDefaultClassNames();

/** Tailwind layers on top of rdp-* defaults (shadcn/ui calendar pattern, Finsepa colors). */
const calendarPresets: Partial<Record<string, string>> = {
  root: "w-fit min-w-[280px] max-w-full shrink-0 bg-white p-3",
  months: "relative flex w-full flex-col gap-4 md:flex-row",
  month: "flex w-full flex-col gap-4",
  month_caption: "flex h-9 w-full items-center justify-center px-9",
  nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 px-0.5",
  button_previous:
    "inline-flex size-9 items-center justify-center rounded-md border border-transparent bg-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
  button_next:
    "inline-flex size-9 items-center justify-center rounded-md border border-transparent bg-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
  caption_label: "select-none text-sm font-medium text-[#09090B]",
  month_grid: "mx-auto w-full border-collapse",
  weekday: "w-9 p-0 text-center text-[0.8rem] font-normal text-[#71717A]",
  day: "relative p-0 text-center",
  outside: "text-[#A1A1AA]",
  disabled: "text-[#A1A1AA] opacity-50",
  hidden: "invisible",
  /** Counteracts default `.rdp-selected { font-size: large }` from react-day-picker styles */
  selected: "!text-sm font-normal",
};

function mergeCalendarClassNames(
  user?: Partial<Record<string, string | undefined>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(defaultClassNames) as (keyof typeof defaultClassNames)[]) {
    const base = defaultClassNames[key];
    const preset = calendarPresets[key as string];
    const fromUser = user?.[key];
    out[key] = cn(base, preset, fromUser);
  }
  if (user) {
    for (const key of Object.keys(user)) {
      if (out[key] === undefined && user[key] != null) {
        out[key] = user[key]!;
      }
    }
  }
  return out;
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex size-9 items-center justify-center rounded-md p-0 text-sm font-normal text-[#09090B]",
        "transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        modifiers.today && !modifiers.selected && "bg-[#F4F4F5] font-medium",
        modifiers.outside && !modifiers.selected && "text-[#A1A1AA] opacity-80 hover:bg-[#FAFAFA] hover:opacity-100",
        modifiers.selected && "bg-[#09090B] font-medium text-white hover:bg-[#09090B] hover:text-white",
        modifiers.disabled && "pointer-events-none opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * shadcn/ui-style calendar (Popover + DayPicker): default nav bar, caption label, custom day button.
 * @see https://ui.shadcn.com/docs/components/radix/date-picker
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  formatters,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("group/calendar", className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={mergeCalendarClassNames(classNames)}
      components={{
        Root: ({ className: rootClass, rootRef, ...rootProps }) => (
          <div ref={rootRef} data-slot="calendar" className={rootClass} {...rootProps} />
        ),
        Chevron: ({ className: chClass, orientation }) => {
          const c = cn("size-4", chClass);
          if (orientation === "left") {
            return <ChevronLeft className={c} aria-hidden />;
          }
          if (orientation === "right") {
            return <ChevronRight className={c} aria-hidden />;
          }
          return <ChevronDown className={c} aria-hidden />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

export { CalendarDayButton };
