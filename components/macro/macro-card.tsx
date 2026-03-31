"use client";

import { useMemo } from "react";

import { MacroSparkline } from "@/components/macro/macro-sparkline";
import { formatMacroChange, formatMacroValue } from "@/components/macro/macro-format";

export type MacroCardModel = {
  id: string;
  title: string;
  kind: "percent" | "usd" | "index" | "number";
  points: Array<{ time: string; value: number }>;
  latest: { time: string; value: number } | null;
  change: { abs: number; pct: number | null } | null;
};

export function MacroCard({ model }: { model: MacroCardModel }) {
  const latestValue = model.latest?.value ?? null;
  const latestText = latestValue == null ? "—" : formatMacroValue(model.kind, latestValue);

  const changeText = useMemo(() => {
    if (!model.change) return null;
    return formatMacroChange(model.kind, model.change.abs, model.change.pct);
  }, [model.change, model.kind]);

  const changeTone = model.change?.abs == null ? "text-[#71717A]" : model.change.abs >= 0 ? "text-emerald-700" : "text-red-700";

  return (
    <div className="rounded-[16px] border border-[#E4E4E7] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{model.title}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-[18px] font-semibold leading-6 tracking-tight text-[#09090B] tabular-nums">
              {latestText}
            </div>
            {changeText ? (
              <div className={`text-[12px] font-medium leading-4 tabular-nums ${changeTone}`}>{changeText}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 h-32 w-full overflow-hidden rounded-md bg-white">
        <MacroSparkline title={model.title} kind={model.kind} points={model.points} height={128} />
      </div>
    </div>
  );
}

