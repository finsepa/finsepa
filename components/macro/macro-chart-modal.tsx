"use client";

import { useCallback, useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { MacroCardModel } from "@/components/macro/macro-card";
import { formatMacroChange, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";

export function MacroChartModal({
  open,
  onClose,
  model,
  chartVariant,
}: {
  open: boolean;
  onClose: () => void;
  model: MacroCardModel;
  chartVariant: MacroChartVariant;
}) {
  const titleId = useId();

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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex min-h-[min(85vh,820px)] max-h-[min(94vh,940px)] w-full max-w-[min(1000px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[16px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[14px] font-semibold leading-7 text-[#09090B]">
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
            className="shrink-0 rounded-lg p-1.5 text-[#71717A] outline-none transition-colors hover:bg-black/5 hover:text-[#09090B] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto border-t border-[#E4E4E7] px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          <div className="flex min-h-[min(52vh,560px)] flex-1 flex-col justify-center">
            <MacroSparkline
              title={model.title}
              kind={model.kind}
              points={model.points}
              height={520}
              variant={chartVariant}
              visualWeight="prominent"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
