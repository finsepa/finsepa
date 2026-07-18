"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { TabSwitcher } from "@/components/design-system";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";
import type { MacroCardModel } from "@/components/macro/macro-card";
import { formatMacroChange, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
import {
  MACRO_RANGE_IDS,
  MACRO_RANGE_LABELS,
  macroModelForWindow,
  prepareMacroPointsForRange,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { MacroFearGreedChart } from "@/components/macro/macro-fear-greed-chart";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";

const MACRO_MODAL_CHART_HEIGHT_PX = 400;

const RANGE_OPTIONS = MACRO_RANGE_IDS.map((id) => ({
  value: id,
  label: MACRO_RANGE_LABELS[id],
}));

export function MacroChartModal({
  open,
  onClose,
  model,
  chartVariant: initialChartVariant,
  rangeId: pageRangeId,
}: {
  open: boolean;
  onClose: () => void;
  model: MacroCardModel;
  chartVariant: MacroChartVariant;
  rangeId: MacroRangeId;
}) {
  const titleId = useId();
  const [chartVariant, setChartVariant] = useState<MacroChartVariant>(initialChartVariant);
  const [rangeId, setRangeId] = useState<MacroRangeId>(pageRangeId);

  const windowedModel = useMemo(
    () => macroModelForWindow(model, prepareMacroPointsForRange(model.points, rangeId)),
    [model, rangeId],
  );

  const changeText = useMemo(() => {
    if (!windowedModel.change) return null;
    return formatMacroChange(windowedModel.kind, windowedModel.change.abs, windowedModel.change.pct);
  }, [windowedModel.change, windowedModel.kind]);

  const changeTone =
    windowedModel.change?.abs == null
      ? "text-[#71717A]"
      : windowedModel.change.abs >= 0
        ? "text-emerald-700"
        : "text-red-700";

  const periodCaption = windowedModel.latest?.time
    ? formatMacroPeriodCaption(windowedModel.latest.time)
    : null;

  const latestValue = windowedModel.latest?.value ?? null;
  const latestText = latestValue == null ? "—" : formatMacroValue(windowedModel.kind, latestValue);

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
    setRangeId(pageRangeId);
  }, [open, initialChartVariant, pageRangeId]);

  if (!open) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId={titleId}
        title={model.title}
        onClose={onClose}
        maxWidthClass="w-full max-w-[min(960px,calc(100vw-2rem))]"
        maxHeightClass="max-h-[min(92vh,900px)]"
        bodyScroll={false}
        headerClassName="px-5 py-4"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        cardClassName="overflow-hidden"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-[18px] font-semibold leading-6 tracking-tight text-[#0F0F0F] tabular-nums">
                {latestText}
              </span>
              {changeText ? (
                <span className={`text-[12px] font-medium leading-5 tabular-nums ${changeTone}`}>
                  {changeText}
                </span>
              ) : null}
            </div>
            {periodCaption ? (
              <p className="mt-1 text-[12px] leading-4 text-[#71717A]">{periodCaption}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {model.id !== "crypto_fear_greed" ? (
              <MultichartVisualSwitcher
                variant="icon"
                value={chartVariant === "bar" ? "bar" : "line"}
                onChange={(next) => setChartVariant(next === "bar" ? "bar" : "area")}
              />
            ) : null}
            <TabSwitcher
              size="sm"
              options={RANGE_OPTIONS}
              value={rangeId}
              onChange={setRangeId}
              aria-label="Date range"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className="min-w-0">
            {model.id === "crypto_fear_greed" ? (
              <MacroFearGreedChart rangeId={rangeId} height={MACRO_MODAL_CHART_HEIGHT_PX} />
            ) : (
              <MacroSparkline
                title={model.title}
                kind={model.kind}
                points={windowedModel.points}
                rangeId={rangeId}
                height={MACRO_MODAL_CHART_HEIGHT_PX}
                variant={chartVariant}
                visualWeight="prominent"
                heightMode="total"
              />
            )}
          </div>
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
