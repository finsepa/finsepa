"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { TabSwitcher } from "@/components/design-system";
import type { MacroCardModel } from "@/components/macro/macro-card";
import { formatMacroChange, formatMacroLatestDate, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
import {
  DEFAULT_MACRO_RANGE,
  MACRO_RANGE_IDS,
  MACRO_RANGE_LABELS,
  macroModelForWindow,
  prepareMacroPointsForRange,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { MacroFearGreedChart } from "@/components/macro/macro-fear-greed-chart";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";
import {
  chartingRailRowClass,
  companyRailListClass,
  companyRailRowClass,
  companyRailScrollClass,
  companyRailSectionsClass,
  companyRailTitleClass,
} from "@/components/charting/charting-rail-row-styles";
import { SIDEBAR_OUTER_EXPANDED_PX } from "@/components/layout/sidebar-layout-context";
import {
  DEFAULT_MACRO_CHART_ID,
  groupMacroChartCards,
  resolveMacroChartId,
  sortMacroChartCards,
} from "@/lib/macro/macro-chart-order";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import {
  EARNINGS_CARD_PRIOR_LINE_CLASS,
  EARNINGS_CARD_VALUE_CLASS,
} from "@/components/stock/earnings-card-styles";
import { fearGreedColorForValue } from "@/lib/screener/fear-greed-color";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = MACRO_RANGE_IDS.map((id) => ({
  value: id,
  label: MACRO_RANGE_LABELS[id],
}));

const MACRO_WORKSPACE_CHART_HEIGHT_PX = 420;

export function MacroPage({ initialItems }: { initialItems: MacroCardModel[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chartVariant, setChartVariant] = useState<MacroChartVariant>("area");
  const [rangeId, setRangeId] = useState<MacroRangeId>(DEFAULT_MACRO_RANGE);

  const chartVisual: MultichartVisual = chartVariant === "bar" ? "bar" : "line";

  const sorted = useMemo(() => sortMacroChartCards(initialItems), [initialItems]);
  const sections = useMemo(() => groupMacroChartCards(sorted), [sorted]);

  const urlChartId = useMemo(
    () => resolveMacroChartId(sorted, searchParams.get("chart") ?? DEFAULT_MACRO_CHART_ID),
    [sorted, searchParams],
  );

  // Optimistic selection so the active row highlights instantly on click,
  // before the URL round-trip lands. URL stays the source of truth on nav.
  const [selectedId, setSelectedId] = useState<string | null>(urlChartId);

  useEffect(() => {
    setSelectedId(urlChartId);
  }, [urlChartId]);

  useEffect(() => {
    if (selectedId === "btc_etf_net_flow") setChartVariant("bar");
  }, [selectedId]);

  const selected = useMemo(
    () => sorted.find((item) => item.id === selectedId) ?? null,
    [sorted, selectedId],
  );

  const selectChart = useCallback(
    (id: string) => {
      setSelectedId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("chart", id);
      // Keep URL in sync without blocking the paint of the active row.
      startTransition(() => {
        router.replace(`/macro?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  const windowedModel = useMemo(() => {
    if (!selected) return null;
    return macroModelForWindow(selected, prepareMacroPointsForRange(selected.points, rangeId));
  }, [selected, rangeId]);

  const latestValue = windowedModel?.latest?.value ?? null;
  const latestText =
    latestValue == null || !windowedModel ? "—" : formatMacroValue(windowedModel.kind, latestValue);

  const changeText = useMemo(() => {
    if (!windowedModel?.change) return null;
    return formatMacroChange(windowedModel.kind, windowedModel.change.abs, windowedModel.change.pct);
  }, [windowedModel]);

  const priorPeriodLabel = useMemo(() => {
    if (!windowedModel || windowedModel.points.length < 2) return null;
    return formatMacroPeriodCaption(windowedModel.points[windowedModel.points.length - 2]!.time);
  }, [windowedModel]);

  const latestDateLabel = useMemo(() => {
    if (!windowedModel?.latest?.time) return null;
    return formatMacroLatestDate(windowedModel.latest.time);
  }, [windowedModel]);

  const changeDelta = windowedModel?.change?.abs ?? null;

  return (
    <div className="flex min-w-0 max-md:flex-col md:absolute md:inset-0 md:overflow-hidden">
      <aside
        className="hidden min-h-0 shrink-0 flex-col overflow-hidden border-r border-[#E4E4E7] bg-white md:flex"
        style={{ width: SIDEBAR_OUTER_EXPANDED_PX }}
        aria-label="Macro charts"
      >
        <div className={companyRailScrollClass}>
          <div className={companyRailSectionsClass}>
            {sections.map((section) => (
              <div key={section.id}>
                <div className={companyRailRowClass}>
                  <span className={companyRailTitleClass}>
                    <span className="truncate">{section.title}</span>
                  </span>
                </div>
                <div className={companyRailListClass}>
                  {section.items.map((item) => {
                    const active = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectChart(item.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          chartingRailRowClass,
                          "w-full text-left",
                          active && "bg-[#F4F4F5]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h1 className="text-[20px] font-semibold leading-8 tracking-tight text-[#0F0F0F]">
              {selected?.title ?? "Macro"}
            </h1>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <TabSwitcher
                size="sm"
                options={RANGE_OPTIONS}
                value={rangeId}
                onChange={setRangeId}
                aria-label="Date range"
              />
              {selected?.id !== "crypto_fear_greed" ? (
                <MultichartVisualSwitcher
                  variant="icon"
                  value={chartVisual}
                  onChange={(next) => setChartVariant(next === "bar" ? "bar" : "area")}
                />
              ) : null}
            </div>
          </div>

          {sorted.length > 0 ? (
            <label className="flex flex-col gap-1.5 md:hidden">
              <span className="text-[12px] font-medium leading-4 text-[#71717A]">Chart</span>
              <select
                className="h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-[14px] font-medium text-[#0F0F0F] outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/10"
                value={selectedId ?? ""}
                onChange={(e) => selectChart(e.target.value)}
                aria-label="Select macro chart"
              >
                {sections.map((section) => (
                  <optgroup key={section.id} label={section.title}>
                    {section.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : null}

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-[#E4E4E7] bg-white px-4 py-10 text-center text-sm text-[#71717A]">
              No macro data available from EODHD right now.
            </div>
          ) : selected && windowedModel ? (
            <div className="min-w-0">
              <div className="mb-4 min-w-0">
                {latestValue != null && Number.isFinite(latestValue) ? (
                  <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span
                        className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}
                        style={
                          selected.id === "crypto_fear_greed"
                            ? { color: fearGreedColorForValue(latestValue) }
                            : undefined
                        }
                      >
                        {latestText}
                      </span>
                      {selected.id !== "crypto_fear_greed" && changeText && changeDelta != null ? (
                        <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 font-['Inter'] text-[14px] font-medium tabular-nums leading-5">
                          <span className={changeDelta >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}>
                            {changeText}
                          </span>
                          {priorPeriodLabel ? (
                            <span className={EARNINGS_CARD_PRIOR_LINE_CLASS}>vs {priorPeriodLabel}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    {latestDateLabel ? (
                      <p className={EARNINGS_CARD_PRIOR_LINE_CLASS}>As on {latestDateLabel}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[14px] leading-5 text-[#71717A]">No data for this range.</p>
                )}
              </div>

              {selected.id === "crypto_fear_greed" ? (
                <MacroFearGreedChart rangeId={rangeId} height={MACRO_WORKSPACE_CHART_HEIGHT_PX} />
              ) : (
                <MacroSparkline
                  title={selected.title}
                  kind={windowedModel.kind}
                  points={windowedModel.points}
                  height={MACRO_WORKSPACE_CHART_HEIGHT_PX}
                  heightMode="total"
                  variant={chartVariant}
                  rangeId={rangeId}
                  visualWeight="prominent"
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
