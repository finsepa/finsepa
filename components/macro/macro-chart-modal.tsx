"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { SegmentedControl } from "@/components/design-system";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";
import { cn } from "@/lib/utils";
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  useEffect(() => {
    if (!open) return;
    setChartVariant(initialChartVariant);
  }, [open, initialChartVariant]);

  if (!open) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        maxWidthClass="w-full max-w-[min(960px,calc(100vw-2rem))]"
        maxHeightClass="max-h-[min(92vh,900px)]"
        bodyScroll={false}
        header={
          <div className="flex w-full items-center justify-between gap-3">
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
            <AppModalCloseButton onClick={onClose} />
          </div>
        }
        headerClassName="border-b border-[#E4E4E7] px-5 py-4"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        cardClassName="overflow-hidden"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 border-b border-[#E4E4E7] px-5 py-3">
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
              height={360}
              variant={chartVariant}
              visualWeight="prominent"
              heightMode="total"
            />
          </div>
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
