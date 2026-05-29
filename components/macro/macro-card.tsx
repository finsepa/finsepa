"use client";

import { useMemo, useState } from "react";
import { Maximize2, TrendingDown, TrendingUp } from "lucide-react";

import { MacroChartModal } from "@/components/macro/macro-chart-modal";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";
import type { MacroRangeId } from "@/components/macro/macro-range";
import { formatMacroChange, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
import {
  EARNINGS_CARD_LABEL_CLASS,
  EARNINGS_CARD_PRIOR_LINE_CLASS,
  EARNINGS_CARD_VALUE_CLASS,
  MULTICHART_CARD_CHART_HEIGHT_PX,
  MULTICHART_CARD_CLASS,
} from "@/components/stock/earnings-card-styles";

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
  rangeId,
}: {
  model: MacroCardModel;
  chartVariant?: MacroChartVariant;
  rangeId: MacroRangeId;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const latestValue = model.latest?.value ?? null;
  const latestText = latestValue == null ? "—" : formatMacroValue(model.kind, latestValue);

  const changeText = useMemo(() => {
    if (!model.change) return null;
    return formatMacroChange(model.kind, model.change.abs, model.change.pct);
  }, [model.change, model.kind]);

  const priorPeriodLabel = useMemo(() => {
    if (model.points.length < 2) return null;
    return formatMacroPeriodCaption(model.points[model.points.length - 2]!.time);
  }, [model.points]);

  const changeDelta = model.change?.abs ?? null;

  return (
    <>
      <div id={`macro-card-${model.id}`} className={MULTICHART_CARD_CLASS}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={EARNINGS_CARD_LABEL_CLASS}>{model.title}</p>
            {latestValue != null && Number.isFinite(latestValue) ? (
              <div className="mt-1 flex min-w-0 flex-col items-start gap-0.5">
                <span className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{latestText}</span>
                {changeText && changeDelta != null ? (
                  <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-['Inter'] text-[14px] font-medium tabular-nums leading-5">
                    {changeDelta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" strokeWidth={2.25} aria-hidden />
                    ) : changeDelta < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" strokeWidth={2.25} aria-hidden />
                    ) : null}
                    <span className={changeDelta >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}>{changeText}</span>
                    {priorPeriodLabel ? (
                      <span className={EARNINGS_CARD_PRIOR_LINE_CLASS}>vs {priorPeriodLabel}</span>
                    ) : null}
                  </span>
                ) : null}
              </div>
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

        <MacroSparkline
          title={model.title}
          kind={model.kind}
          points={model.points}
          height={MULTICHART_CARD_CHART_HEIGHT_PX}
          heightMode="total"
          variant={chartVariant}
          rangeId={rangeId}
        />
      </div>

      <MacroChartModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        model={model}
        chartVariant={chartVariant}
        rangeId={rangeId}
      />
    </>
  );
}
