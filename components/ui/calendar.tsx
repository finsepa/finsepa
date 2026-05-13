"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayButton, DayPicker, Dropdown as DayPickerDropdown, getDefaultClassNames, UI } from "react-day-picker";

import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

const defaultClassNames = getDefaultClassNames();

/** Tailwind layers on top of rdp-* defaults (shadcn/ui calendar pattern, Finsepa colors). */
const calendarPresets: Partial<Record<string, string>> = {
  root: "w-fit min-w-[280px] max-w-full shrink-0 bg-white p-3",
  months: "relative flex w-full flex-col gap-4 md:flex-row",
  month: "flex w-full flex-col gap-4",
  /** Reset global `.rdp-month_caption` bold/large defaults; center nav + dropdown caption. */
  month_caption:
    "relative z-[1] flex h-9 w-full items-center justify-center gap-2 px-9 text-sm font-medium text-[#09090B]",
  dropdowns: "relative z-[2] flex items-center justify-center gap-2",
  /** Wrapper for custom {@link FinsepaCalendarDropdown} (Finsepa listbox — no native `<select>` chrome). */
  dropdown_root: "relative inline-flex shrink-0",
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

type DayPickerDropdownProps = React.ComponentProps<typeof DayPickerDropdown>;

type FinsepaCalendarDropdownProps = DayPickerDropdownProps & {
  /** Equal-width month/year row (no max-width cap, no trailing chevron). */
  stretch?: boolean;
};

/**
 * Month/year caption controls — matches {@link FormListboxSelect} (gray trigger + white menu),
 * replacing the native `<select>` so OS pickers / glass overlays do not appear.
 */
function FinsepaCalendarDropdown({
  options,
  className,
  classNames: rdpClassNames,
  components: _rdpComponents,
  disabled,
  value,
  onChange,
  style,
  stretch = false,
  "aria-label": ariaLabel,
  ...rest
}: FinsepaCalendarDropdownProps) {
  void _rdpComponents;
  void rest;

  const rootClass = rdpClassNames[UI.DropdownRoot];

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const opts = options ?? [];
  const active = opts.find((o) => String(o.value) === String(value)) ?? opts[0];

  React.useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!active) {
    return <div className={cn(rootClass, className)} style={style} aria-hidden />;
  }

  function emitChange(nextValue: string) {
    onChange?.({
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    } as React.ChangeEvent<HTMLSelectElement>);
  }

  return (
    <div
      ref={containerRef}
      className={cn(rootClass, className, stretch && "w-full min-w-0 max-w-none")}
      style={style}
      data-disabled={disabled ? true : undefined}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "relative flex h-9 min-h-9 w-full cursor-pointer items-center rounded-[10px] bg-[#F4F4F5] py-2 text-left text-sm font-normal text-[#09090B] outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/25",
          stretch ? "min-w-0 px-3" : "min-w-[6.5rem] max-w-[10rem] pl-3 pr-9",
          disabled && "cursor-not-allowed opacity-60 hover:bg-[#F4F4F5]",
        )}
      >
        <span className="min-w-0 flex-1 truncate" title={active.label}>
          {active.label}
        </span>
      </button>
      {!stretch ? (
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-2.5 top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-[#09090B] transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
      {open ? (
        <div
          className={cn(
            dropdownMenuPanelClassName(),
            "absolute left-0 top-[calc(100%+4px)] z-[200] min-w-full max-h-60 w-max max-w-[min(18rem,calc(100vw-2rem))] overflow-y-auto py-2",
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
          {opts.map((opt) => {
            const selected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  emitChange(String(opt.value));
                  setOpen(false);
                }}
                className={dropdownMenuPlainItemRowClassName({ selected })}
              >
                <span className="min-w-0 flex-1 truncate text-left">{opt.label}</span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {selected ? <Check className="h-4 w-4 text-[#2563EB]" strokeWidth={2} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
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
        "transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25",
        modifiers.today && !modifiers.selected && "bg-[#F4F4F5] font-medium",
        modifiers.outside && !modifiers.selected && "text-[#A1A1AA] opacity-80 hover:bg-[#FAFAFA] hover:opacity-100",
        modifiers.selected &&
          "bg-white font-semibold text-[#09090B] shadow-[inset_0_0_0_2px_#2563EB] hover:bg-[#EFF6FF] hover:text-[#09090B] hover:shadow-[inset_0_0_0_2px_#1D4ED8]",
        modifiers.disabled && "pointer-events-none opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /**
   * Month/year caption dropdowns fill the caption row (Finsepa transaction-style).
   * Hides the decorative chevron and widens triggers to the grid.
   */
  captionDropdownStretch?: boolean;
};

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
  captionDropdownStretch = false,
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
        Dropdown: (dropdownProps) => (
          <FinsepaCalendarDropdown {...dropdownProps} stretch={captionDropdownStretch} />
        ),
      }}
      {...props}
    />
  );
}

export { CalendarDayButton };
