"use client";

import { useMemo, useState } from "react";

import { TabSwitcher } from "@/components/design-system";
import { MacroCard, type MacroCardModel } from "@/components/macro/macro-card";
import type { MacroChartVariant } from "@/components/macro/macro-sparkline";
import {
  DEFAULT_MACRO_RANGE,
  MACRO_RANGE_IDS,
  MACRO_RANGE_LABELS,
  macroModelForWindow,
  prepareMacroPointsForRange,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { sortMacroChartCards } from "@/lib/macro/macro-chart-order";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";

const RANGE_OPTIONS = MACRO_RANGE_IDS.map((id) => ({
  value: id,
  label: MACRO_RANGE_LABELS[id],
}));

export function MacroPage({ initialItems }: { initialItems: MacroCardModel[] }) {
  const [chartVariant, setChartVariant] = useState<MacroChartVariant>("area");
  const [rangeId, setRangeId] = useState<MacroRangeId>(DEFAULT_MACRO_RANGE);

  const chartVisual: MultichartVisual = chartVariant === "bar" ? "bar" : "line";

  const sorted = useMemo(() => sortMacroChartCards(initialItems), [initialItems]);

  const windowed = useMemo(() => {
    return sorted.map((m) => macroModelForWindow(m, prepareMacroPointsForRange(m.points, rangeId)));
  }, [sorted, rangeId]);

  return (
    <div className="min-w-0 space-y-6 px-4 py-4 sm:px-9 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Macro charts</h1>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <MultichartVisualSwitcher
            variant="icon"
            value={chartVisual}
            onChange={(next) => setChartVariant(next === "bar" ? "bar" : "area")}
          />
          <TabSwitcher
            size="sm"
            options={RANGE_OPTIONS}
            value={rangeId}
            onChange={setRangeId}
            aria-label="History range"
          />
        </div>
      </div>

      {windowed.length === 0 ? (
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
          No macro data available from EODHD right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {windowed.map((m) => (
            <MacroCard key={m.id} model={m} chartVariant={chartVariant} rangeId={rangeId} />
          ))}
        </div>
      )}
    </div>
  );
}
