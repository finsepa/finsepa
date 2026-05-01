"use client";

import { useMemo, useState } from "react";
import { BarChart3, LineChart } from "lucide-react";

import { MacroCard, type MacroCardModel } from "@/components/macro/macro-card";
import type { MacroChartVariant } from "@/components/macro/macro-sparkline";
import {
  DEFAULT_MACRO_RANGE,
  MACRO_RANGE_IDS,
  MACRO_RANGE_LABELS,
  macroModelForWindow,
  sliceMacroPointsByRange,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { cn } from "@/lib/utils";

export function MacroPage({ initialItems }: { initialItems: MacroCardModel[] }) {
  const [chartVariant, setChartVariant] = useState<MacroChartVariant>("area");
  const [rangeId, setRangeId] = useState<MacroRangeId>(DEFAULT_MACRO_RANGE);

  const sorted = useMemo(
    () => [...initialItems].sort((a, b) => a.title.localeCompare(b.title)),
    [initialItems],
  );

  const windowed = useMemo(() => {
    return sorted.map((m) => macroModelForWindow(m, sliceMacroPointsByRange(m.points, rangeId)));
  }, [sorted, rangeId]);

  return (
    <div className="min-w-0 space-y-6 px-4 py-4 sm:px-9 sm:py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[24px] font-semibold leading-9 tracking-tight text-[#09090B]">Macro charts</h1>

        <div className="flex w-full flex-wrap items-center justify-start gap-3 lg:w-auto lg:justify-end">
          <div className="flex shrink-0 rounded-[10px] bg-[#F4F4F5] p-0.5">
            <button
              type="button"
              onClick={() => setChartVariant("area")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-[10px] transition-colors",
                chartVariant === "area"
                  ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12),0px_1px_1px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#52525B] hover:text-[#09090B]",
              )}
              aria-pressed={chartVariant === "area"}
              aria-label="Area chart"
            >
              <LineChart className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setChartVariant("bar")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-[10px] transition-colors",
                chartVariant === "bar"
                  ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12),0px_1px_1px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#52525B] hover:text-[#09090B]",
              )}
              aria-pressed={chartVariant === "bar"}
              aria-label="Bar chart"
            >
              <BarChart3 className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex max-w-full flex-wrap items-center gap-0 rounded-[10px] bg-[#F4F4F5] p-0.5">
            {MACRO_RANGE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRangeId(id)}
                className={cn(
                  "rounded-[10px] px-4 py-1.5 text-sm font-medium transition-colors",
                  rangeId === id
                    ? "bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12),0px_1px_1px_0px_rgba(10,10,10,0.07)]"
                    : "text-[#71717A] hover:text-[#09090B]",
                )}
              >
                {MACRO_RANGE_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {windowed.length === 0 ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
          No macro data available from EODHD right now.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {windowed.map((m) => (
            <MacroCard key={m.id} model={m} chartVariant={chartVariant} />
          ))}
        </div>
      )}
    </div>
  );
}
