"use client";

import { useMemo, useState } from "react";
import { Maximize2 } from "@/lib/icons";

import { MacroChangeDisplay } from "@/components/macro/macro-change-display";
import { MacroChartModal } from "@/components/macro/macro-chart-modal";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";
import {
  macroModelForWindow,
  prepareMacroPointsForRange,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
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

  const windowedModel = useMemo(
    () =>
      macroModelForWindow(
        model,
        prepareMacroPointsForRange(model.points, rangeId, {
          dailyFlowBars: model.id === "btc_etf_net_flow",
        }),
      ),
    [model, rangeId],
  );

  const latestValue = windowedModel.latest?.value ?? null;
  const latestText = latestValue == null ? "—" : formatMacroValue(windowedModel.kind, latestValue);

  const change = windowedModel.change;

  const priorPeriodLabel = useMemo(() => {
    if (windowedModel.points.length < 2) return null;
    return formatMacroPeriodCaption(windowedModel.points[windowedModel.points.length - 2]!.time);
  }, [windowedModel.points]);

  const changeDelta = change?.abs ?? null;

  return (
    <>
      <div id={`macro-card-${model.id}`} className={MULTICHART_CARD_CLASS}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={EARNINGS_CARD_LABEL_CLASS}>{model.title}</p>
            {latestValue != null && Number.isFinite(latestValue) ? (
              <div className="mt-1 flex min-w-0 flex-col items-start gap-0.5">
                <span className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{latestText}</span>
                {change && changeDelta != null ? (
                  <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-['Inter'] text-[14px] font-medium leading-5">
                    <MacroChangeDisplay
                      kind={windowedModel.kind}
                      abs={change.abs}
                      pct={change.pct}
                    />
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
            className="shrink-0 rounded-lg p-1.5 text-fg-muted outline-none transition-colors hover:bg-black/5 hover:text-fg focus-visible:ring-2 focus-visible:ring-fg/10"
            aria-label={`Open ${model.title} in full view`}
          >
            <Maximize2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <MacroSparkline
          title={model.title}
          kind={model.kind}
          points={windowedModel.points}
          height={MULTICHART_CARD_CHART_HEIGHT_PX}
          heightMode="total"
          variant={chartVariant}
          rangeId={rangeId}
          dailyFlowAxis={model.id === "btc_etf_net_flow"}
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
