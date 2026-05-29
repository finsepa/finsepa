"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { SegmentedControl } from "@/components/design-system";
import type { MacroCardModel } from "@/components/macro/macro-card";
import { formatMacroChange, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
import type { MacroRangeId } from "@/components/macro/macro-range";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";

const VARIANT_OPTIONS = [
  { value: "area" as const, label: "Area" },
  { value: "bar" as const, label: "Bars" },
];

export function MacroChartModal({
  open,
  onClose,
  model,
  chartVariant: initialChartVariant,
  rangeId,
}: {
  open: boolean;
  onClose: () => void;
  model: MacroCardModel;
  chartVariant: MacroChartVariant;
  rangeId: MacroRangeId;
}) {
  const titleId = useId();
  const [chartVariant, setChartVariant] = useState<MacroChartVariant>(initialChartVariant);

  const changeText = useMemo(() => {
    if (!model.change) return null;
    return formatMacroChange(model.kind, model.change.abs, model.change.pct);
  }, [model.change, model.kind]);

  const changeTone = model.change?.abs == null ? "text-[#71717A]" : model.change.abs >= 0 ? "text-emerald-700" : "text-red-700";

  const periodCaption = model.latest?.time ? formatMacroPeriodCaption(model.latest.time) : null;

  const latestValue = model.latest?.value ?? null;
  const latestText = latestValue == null ? "—" : formatMacroValue(model.kind, latestValue);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  useEffect(() => {
    if (!open) return;
    setChartVariant(initialChartVariant);
  }, [open, initialChartVariant]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[18px] font-semibold leading-7 text-[#09090B]">
              {model.title}
            </h2>
            <div className="mt-0 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-[18px] font-semibold leading-6 tracking-tight text-[#09090B] tabular-nums">{latestText}</span>
              {changeText ? (
                <span className={`text-[12px] font-medium leading-5 tabular-nums ${changeTone}`}>{changeText}</span>
              ) : null}
            </div>
            {periodCaption ? <p className="mt-1 text-[12px] leading-4 text-[#71717A]">{periodCaption}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-5 py-3">
          <SegmentedControl
            options={VARIANT_OPTIONS}
            value={chartVariant}
            onChange={setChartVariant}
            aria-label="Chart type"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className="min-w-0">
            <MacroSparkline
              title={model.title}
              kind={model.kind}
              points={model.points}
              rangeId={rangeId}
              // Fixed overall plot height (incl. x-axis labels) to match Multicharts modal.
              height={360}
              variant={chartVariant}
              visualWeight="prominent"
              heightMode="total"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
