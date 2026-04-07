"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Single-month calendar — react-day-picker v9 + default styles, Finsepa accent via CSS variables. */
export function Calendar({ className, classNames, components, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn(
        "p-3 [--rdp-accent-color:#09090B] [--rdp-accent-background-color:#F4F4F5] [--rdp-today-color:#09090B]",
        className,
      )}
      classNames={{
        root: cn("w-fit", classNames?.root),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chClass }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4 text-[#09090B]", chClass)} aria-hidden />;
        },
        ...components,
      }}
      {...props}
    />
  );
}
