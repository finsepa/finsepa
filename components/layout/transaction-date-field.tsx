"use client";

import { format } from "date-fns";
import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Date field with popover calendar (shadcn-style: Popover + DayPicker). */
export function TransactionDateField({
  date,
  onDateChange,
}: {
  date: Date;
  onDateChange: (next: Date) => void;
}) {
  const [open, setOpen] = useState(false);

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
        className="w-auto max-w-[min(100vw-2rem,320px)] shrink-0 overflow-hidden rounded-xl border border-[#E4E4E7] bg-white p-0 shadow-[0px_10px_16px_0px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
        align="start"
        sideOffset={8}
      >
        <Calendar
          mode="single"
          showOutsideDays
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
