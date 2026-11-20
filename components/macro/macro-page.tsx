"use client";

import { useCallback, useEffect, useMemo, useState, startTransition, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Folder } from "@/lib/icons";

import { TabSwitcher } from "@/components/design-system";
import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { MacroCardModel } from "@/components/macro/macro-card";
import { MacroChangeDisplay } from "@/components/macro/macro-change-display";
import { formatMacroLatestDate, formatMacroPeriodCaption, formatMacroValue } from "@/components/macro/macro-format";
import {
  BTC_ETF_FLOW_RANGE_IDS,
  DEFAULT_BTC_ETF_FLOW_RANGE,
  DEFAULT_MACRO_RANGE,
  isBtcEtfFlowRangeId,
  isMacroLongRangeId,
  MACRO_RANGE_IDS,
  MACRO_RANGE_LABELS,
  macroModelForWindow,
  prepareMacroPointsForRange,
  type MacroRangeId,
} from "@/components/macro/macro-range";
import { MacroFearGreedChart } from "@/components/macro/macro-fear-greed-chart";
import { MacroSparkline, type MacroChartVariant } from "@/components/macro/macro-sparkline";
import { chartingRailRowClass } from "@/components/charting/charting-rail-row-styles";
import { SIDEBAR_OUTER_EXPANDED_PX } from "@/components/layout/sidebar-layout-context";
import {
  DEFAULT_MACRO_CHART_ID,
  groupMacroChartCards,
  resolveMacroChartId,
  sortMacroChartCards,
  type MacroChartSectionId,
} from "@/lib/macro/macro-chart-order";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import {
  EARNINGS_CARD_PRIOR_LINE_CLASS,
  EARNINGS_CARD_VALUE_CLASS,
} from "@/components/stock/earnings-card-styles";
import {
  dropdownMenuMobileSheetBodyClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { dropdownTriggerFieldClassName } from "@/components/design-system/text-input-styles";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";
import { fearGreedColorForValue } from "@/lib/screener/fear-greed-color";
import { cn } from "@/lib/utils";

const MACRO_SECTION_EXPANDED_KEY = "finsepa-macro-rail-expanded";
/** Row `px-3` (12px) + half the 20px folder icon − half the 1px line — matches Portfolio guide. */
const MACRO_GUIDE_LINE_INSET_PX = 21;
const macroSectionListeners = new Set<() => void>();

function subscribeMacroSectionExpanded(listener: () => void): () => void {
  macroSectionListeners.add(listener);
  return () => macroSectionListeners.delete(listener);
}

function readMacroSectionExpandedMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MACRO_SECTION_EXPANDED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeMacroSectionExpanded(sectionId: string, expanded: boolean): void {
  try {
    const next = { ...readMacroSectionExpandedMap(), [sectionId]: expanded };
    localStorage.setItem(MACRO_SECTION_EXPANDED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  macroSectionListeners.forEach((l) => l());
}

function isMacroSectionExpanded(sectionId: string): boolean {
  const map = readMacroSectionExpandedMap();
  return map[sectionId] !== false;
}

const RANGE_OPTIONS = MACRO_RANGE_IDS.map((id) => ({
  value: id,
  label: MACRO_RANGE_LABELS[id],
}));

const BTC_ETF_RANGE_OPTIONS = BTC_ETF_FLOW_RANGE_IDS.map((id) => ({
  value: id,
  label: MACRO_RANGE_LABELS[id],
}));

const MACRO_WORKSPACE_CHART_HEIGHT_PX = 420;

/** Same white card chrome as Charting / Comparison {@link CompanyRailCard}. */
const macroRailCardClass =
  "flex w-full flex-col overflow-hidden rounded-2xl border border-transparent bg-surface shadow-card [--fs-chart-plot-bg:var(--fs-surface)]";

const macroRailBodyClass =
  "flex max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto overscroll-y-contain p-2";

/** Mobile macro chart picker — always opens a profile-menu-style bottom sheet (never a floating popover). */
function MacroChartMobileSelect({
  sections,
  value,
  onChange,
}: {
  sections: { id: string; title: string; items: { id: string; title: string }[] }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel =
    sections.flatMap((s) => s.items).find((item) => item.id === value)?.title ?? "Select chart";

  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        aria-label="Select macro chart"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex w-full cursor-pointer items-center rounded-[10px] text-left text-sm font-normal text-fg",
          dropdownTriggerFieldClassName,
        )}
      >
        <span className="min-w-0 flex-1 truncate pl-3 pr-11 text-left">{activeLabel}</span>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-fg transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <MobileBottomSheet open={open} onClose={() => setOpen(false)} title="Chart">
        <div className={dropdownMenuMobileSheetBodyClassName} role="listbox" aria-label="Select macro chart">
          {sections.map((section, sectionIndex) => (
            <div key={section.id}>
              {sectionIndex > 0 ? (
                <div className="mx-3 my-1 h-px shrink-0 bg-dropdown-divider" aria-hidden />
              ) : null}
              <div className="flex items-center gap-2 px-4 pb-1 pt-2 text-[12px] font-medium leading-4 text-fg-muted">
                <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{section.title}</span>
              </div>
              {section.items.map((item) => {
                const selected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className={dropdownMenuPlainItemRowClassName({ selected })}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                      <Check
                        className={cn("h-4 w-4 text-fg", !selected && "invisible")}
                        strokeWidth={2}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </MobileBottomSheet>
    </div>
  );
}

type MacroRailSection = {
  id: MacroChartSectionId | "other";
  title: string;
  items: { id: string; title: string }[];
};

/** Portfolio-style collapsible group: folder label + chevron + vertical guide for charts. */
function MacroRailSectionGroup({
  section,
  selectedId,
  onSelect,
}: {
  section: MacroRailSection;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const expanded = useSyncExternalStore(
    subscribeMacroSectionExpanded,
    () => isMacroSectionExpanded(section.id),
    () => true,
  );
  const toggleExpanded = useCallback(() => {
    writeMacroSectionExpanded(section.id, !isMacroSectionExpanded(section.id));
  }, [section.id]);

  const containsSelected = section.items.some((item) => item.id === selectedId);

  useEffect(() => {
    if (containsSelected && !isMacroSectionExpanded(section.id)) {
      writeMacroSectionExpanded(section.id, true);
    }
  }, [containsSelected, section.id]);

  return (
    <div>
      <div className="relative flex w-full">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${section.title}` : `Expand ${section.title}`}
          className={cn(
            "flex h-9 w-full shrink-0 items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium leading-5 text-fg",
            containsSelected && !expanded
              ? "bg-surface-muted"
              : "opacity-70 hover:bg-surface-muted hover:opacity-100",
          )}
        >
          <Folder className="h-5 w-5 shrink-0 text-fg" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{section.title}</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-fg-muted transition-transform duration-200",
              !expanded && "-rotate-90",
            )}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="mt-0.5 flex flex-col gap-0.5 border-l border-stroke py-1"
            style={{ marginLeft: MACRO_GUIDE_LINE_INSET_PX, paddingLeft: 12 }}
          >
            {section.items.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? "true" : undefined}
                  tabIndex={expanded ? undefined : -1}
                  className={cn(
                    chartingRailRowClass,
                    "w-full text-left",
                    active
                      ? "bg-surface-muted text-fg opacity-100"
                      : "opacity-70 hover:opacity-100",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MacroPage({ initialItems }: { initialItems: MacroCardModel[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chartVariant, setChartVariant] = useState<MacroChartVariant>(
    searchParams.get("chart") === "btc_etf_net_flow" ? "bar" : "area",
  );
  const [rangeId, setRangeId] = useState<MacroRangeId>(
    searchParams.get("chart") === "btc_etf_net_flow" ? DEFAULT_BTC_ETF_FLOW_RANGE : DEFAULT_MACRO_RANGE,
  );

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

  const isBtcEtfFlow = selectedId === "btc_etf_net_flow";

  useEffect(() => {
    if (isBtcEtfFlow) {
      setChartVariant("bar");
      if (!isBtcEtfFlowRangeId(rangeId)) setRangeId(DEFAULT_BTC_ETF_FLOW_RANGE);
      return;
    }
    if (!isMacroLongRangeId(rangeId)) setRangeId(DEFAULT_MACRO_RANGE);
  }, [isBtcEtfFlow, rangeId]);

  const rangeOptions = isBtcEtfFlow ? BTC_ETF_RANGE_OPTIONS : RANGE_OPTIONS;

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
    return macroModelForWindow(
      selected,
      prepareMacroPointsForRange(selected.points, rangeId, {
        dailyFlowBars: selected.id === "btc_etf_net_flow",
      }),
    );
  }, [selected, rangeId]);

  const latestValue = windowedModel?.latest?.value ?? null;
  const latestText =
    latestValue == null || !windowedModel ? "—" : formatMacroValue(windowedModel.kind, latestValue);

  const change = windowedModel?.change ?? null;

  const priorPeriodLabel = useMemo(() => {
    if (!windowedModel || windowedModel.points.length < 2) return null;
    const prior = windowedModel.points[windowedModel.points.length - 2]!.time;
    return selected?.id === "btc_etf_net_flow"
      ? formatMacroLatestDate(prior)
      : formatMacroPeriodCaption(prior);
  }, [selected?.id, windowedModel]);

  const latestDateLabel = useMemo(() => {
    if (!windowedModel?.latest?.time) return null;
    return formatMacroLatestDate(windowedModel.latest.time);
  }, [windowedModel]);

  const changeDelta = change?.abs ?? null;

  const chartList = (
    <div className="flex flex-col gap-0.5">
      {sections.map((section) => (
        <MacroRailSectionGroup
          key={section.id}
          section={section}
          selectedId={selectedId}
          onSelect={selectChart}
        />
      ))}
    </div>
  );

  const chartToolbar = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <TabSwitcher
        size="sm"
        options={rangeOptions}
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
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 px-4 py-4 sm:px-9 sm:py-6">
      {sorted.length > 0 ? (
        <div className="min-w-0 md:hidden">
          <MacroChartMobileSelect
            sections={sections}
            value={selectedId ?? sorted[0]?.id ?? ""}
            onChange={selectChart}
          />
        </div>
      ) : null}

      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1 space-y-5">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-stroke bg-surface px-4 py-10 text-center text-sm text-fg-muted">
              No macro data available from EODHD right now.
            </div>
          ) : selected && windowedModel ? (
            <div className={cn("min-w-0 p-4 sm:p-5", MOBILE_ELEVATED_CARD_CLASS)}>
              <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <h2 className="mb-2 text-xl font-semibold leading-7 tracking-tight text-fg">
                    {selected.title}
                  </h2>
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
                        {selected.id !== "crypto_fear_greed" && change && changeDelta != null ? (
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
                      {latestDateLabel ? (
                        <p className={EARNINGS_CARD_PRIOR_LINE_CLASS}>As on {latestDateLabel}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[14px] leading-5 text-fg-muted">No data for this range.</p>
                  )}
                </div>
                {chartToolbar}
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
                  dailyFlowAxis={isBtcEtfFlow}
                />
              )}
            </div>
          ) : null}
        </div>

        {sorted.length > 0 ? (
          <aside
            className="hidden w-[240px] shrink-0 self-start md:block"
            style={{ maxWidth: `${SIDEBAR_OUTER_EXPANDED_PX}px` }}
            aria-label="Macro charts"
          >
            <div className={macroRailCardClass}>
              <div className={macroRailBodyClass}>{chartList}</div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
