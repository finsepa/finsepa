"use client";

import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";

import { MacroChartModal } from "@/components/macro/macro-chart-modal";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";
import { formatMacroChange, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";

export type MacroCardModel = {
  id: string;
  title: string;
  kind: "percent" | "usd" | "index" | "number";
  points: Array<{ time: string; value: number }>;
  latest: { time: string; value: number } | null;
  change: { abs: number; pct: number | null } | null;
};

export function MacroCard({
  model,
  chartVariant = "area",
}: {
  model: MacroCardModel;
  chartVariant?: MacroChartVariant;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const latestValue = model.latest?.value ?? null;
  const latestText = latestValue == null ? "—" : formatMacroValue(model.kind, latestValue);

  const changeText = useMemo(() => {
    if (!model.change) return null;
    return formatMacroChange(model.kind, model.change.abs, model.change.pct);
  }, [model.change, model.kind]);

  const changeTone = model.change?.abs == null ? "text-[#71717A]" : model.change.abs >= 0 ? "text-emerald-700" : "text-red-700";

  const periodCaption = model.latest?.time ? formatMacroPeriodCaption(model.latest.time) : null;

  return (
    <>
      <div
        id={`macro-card-${model.id}`}
        className="rounded-[16px] border border-[#E4E4E7] bg-white px-5 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold leading-7 text-[#09090B]">{model.title}</div>
            <div className="mt-0 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <div className="text-[18px] font-semibold leading-6 tracking-tight text-[#09090B] tabular-nums">{latestText}</div>
              {changeText ? (
                <div className={`text-[12px] font-medium leading-5 tabular-nums ${changeTone}`}>{changeText}</div>
              ) : null}
            </div>
            {periodCaption ? (
              <div className="mt-1 text-[12px] leading-4 text-[#71717A]">{periodCaption}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 rounded-lg p-1.5 text-[#71717A] outline-none transition-colors hover:bg-black/5 hover:text-[#09090B] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            aria-label={`Open ${model.title} in full view`}
          >
            <Maximize2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="mt-4 w-full min-w-0">
          <MacroSparkline title={model.title} kind={model.kind} points={model.points} height={168} variant={chartVariant} />
        </div>
      </div>

      <MacroChartModal open={modalOpen} onClose={() => setModalOpen(false)} model={model} chartVariant={chartVariant} />
    </>
  );
}
