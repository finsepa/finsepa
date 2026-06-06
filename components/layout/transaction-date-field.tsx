"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "@/lib/icons";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function startOfCalendarMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * react-day-picker orders month/year from locale (`en-US` → month first).
 * Swap so year appears before month; keep the live caption `<span role="status">` last.
 */
function YearFirstCaptionDropdownNav({
  children,
  className,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const arr = React.Children.toArray(children);
  const statusEls = arr.filter((c) => {
    if (!React.isValidElement(c)) return false;
    const p = c.props as { role?: string };
    return p.role === "status";
  });
  const controls = arr.filter((c) => {
    if (!React.isValidElement(c)) return true;
    const p = c.props as { role?: string };
    return p.role !== "status";
  });
  const month = controls.find((c) => React.isValidElement(c) && c.key === "month");
  const year = controls.find((c) => React.isValidElement(c) && c.key === "year");
  const ordered =
    month != null && year != null ? ([year, month, ...statusEls] as React.ReactNode[]) : arr;

  return (
    <div className={cn(className, "w-full min-w-0")} style={style} {...rest}>
      {ordered}
    </div>
  );
}

/** Date field with popover — uses shadcn-style `Calendar` + `captionLayout="dropdown"` (react-day-picker). */
export function TransactionDateField({
  date,
  onDateChange,
}: {
  date: Date;
  onDateChange: (next: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfCalendarMonth(date));

  const { startMonth, endMonth } = useMemo(() => {
    const y = new Date().getFullYear();
    return {
      startMonth: new Date(y - 100, 0, 1),
      /** Cap navigation at today’s calendar year — no future years in the dropdown. */
      endMonth: new Date(y, 11, 31),
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setMonth(startOfCalendarMonth(date));
  }, [open, date]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-[10px] bg-[#F4F4F5] px-4 text-left text-sm font-normal text-[#09090B] transition-colors hover:bg-[#EBEBEB]",
          )}
        >
          <span className="tabular-nums">{format(date, "MM/dd/yyyy")}</span>
          <CalendarIcon className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[280px] w-[min(100vw-2rem,320px)] shrink-0 overflow-hidden"
        align="start"
        sideOffset={8}
      >
        <Calendar
          mode="single"
          captionLayout="dropdown"
          hideNavigation
          captionDropdownStretch
          showOutsideDays
          startMonth={startMonth}
          endMonth={endMonth}
          className="w-full min-w-0 rounded-lg border-0 bg-transparent p-3"
          classNames={{
            root: "!w-full !min-w-0 !max-w-none",
            months: "!w-full min-w-0",
            month: "!w-full min-w-0",
            month_caption: "!flex !w-full !min-w-0 items-stretch !px-0 !gap-2",
            dropdowns:
              "!relative !z-[2] grid w-full min-w-0 grid-cols-2 gap-2 !items-stretch !justify-normal",
            dropdown_root: "!relative flex w-full min-w-0 max-w-none shrink",
            weekday: "text-[0.8rem] font-normal text-[#71717A]",
            outside: "text-[#A1A1AA]",
          }}
          components={{ DropdownNav: YearFirstCaptionDropdownNav }}
          month={month}
          onMonthChange={(m) => setMonth(startOfCalendarMonth(m))}
          selected={date}
          onSelect={(d) => {
            if (d) {
              onDateChange(d);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
