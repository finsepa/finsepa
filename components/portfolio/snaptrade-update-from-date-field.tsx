"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "@/lib/icons";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ymdToLocalDate } from "@/lib/snaptrade/sync-update-from";

function startOfCalendarMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

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

/** Nullable date field — `null` shows “first transaction” (sync full history). */
export function SnaptradeUpdateFromDateField({
  valueYmd,
  onChangeYmd,
}: {
  valueYmd: string | null;
  onChangeYmd: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = valueYmd ? ymdToLocalDate(valueYmd) : null;
  const [month, setMonth] = useState(() =>
    startOfCalendarMonth(selectedDate ?? new Date()),
  );

  const { startMonth, endMonth } = useMemo(() => {
    const y = new Date().getFullYear();
    return {
      startMonth: new Date(y - 100, 0, 1),
      endMonth: new Date(y, 11, 31),
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setMonth(startOfCalendarMonth(selectedDate ?? new Date()));
  }, [open, selectedDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-left text-sm font-normal transition-colors hover:bg-[#FAFAFA]"
        >
          <span className={cn("min-w-0 truncate", valueYmd ? "text-[#09090B]" : "text-[#71717A]")}>
            {valueYmd ? format(ymdToLocalDate(valueYmd), "MM/dd/yyyy") : "first transaction"}
          </span>
          <CalendarIcon className="h-5 w-5 shrink-0 text-[#71717A]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[280px] w-[min(100vw-2rem,320px)] shrink-0 overflow-hidden"
        align="start"
        sideOffset={8}
      >
        <div className="flex flex-col gap-2 p-1">
          {valueYmd ?
            <button
              type="button"
              className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
              onClick={() => {
                onChangeYmd(null);
                setOpen(false);
              }}
            >
              Sync from first transaction
            </button>
          : null}
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
            selected={selectedDate ?? undefined}
            onSelect={(d) => {
              if (d) {
                onChangeYmd(format(d, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
