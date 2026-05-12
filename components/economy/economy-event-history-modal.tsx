"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { formatEconomyMetric } from "@/lib/market/economy-format-display";
import type { EconomyCalendarEvent } from "@/lib/market/economy-calendar-types";

type HistoryPoint = {
  date: string;
  period: string | null;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
};

const BAR_COLOR = "#2563EB";
const HOVER_COLUMN_BG = "rgba(59, 130, 246, 0.14)";
const CHART_HEIGHT = 400;
const BAR_WIDTH_PX = 14;
const Y_AXIS_W_PX = 50;
const AXIS_ROW_PX = 40;
const AXIS_LABEL_ROTATE_DEG = -42;

const historyRowGrid = "grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] gap-x-2";

function formatPeriodLabel(dateStr: string, period: string | null): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr.split(" ")[0]}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dateStr;
  const monthYear = d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (period) return `${period} (${monthYear})`;
  return monthYear;
}

function formatAxisLabel(dateStr: string, period: string | null): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr.split(" ")[0]}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dateStr.slice(0, 7);
  if (period) {
    const yy = String(d.getUTCFullYear()).slice(2);
    return `${period} '${yy}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function formatYAxisValue(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
  if (!Number.isInteger(n)) return `${n.toFixed(2)}%`;
  return String(n);
}

const NICE_STEP_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

function niceCeilStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  const exp = Math.floor(Math.log10(step));
  const base = 10 ** exp;
  const f = step / base;
  for (const c of NICE_STEP_FACTORS) {
    if (c >= f) return c * base;
  }
  return 10 * base;
}

function axisMaxForFiveTicks(rawMax: number): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  const padded = rawMax * 1.04;
  const step = niceCeilStep(padded / 4);
  return step * 4;
}

function computeTooltipPlacement(
  focusX: number,
  containerW: number,
): { anchorX: number; side: "left" | "right" } {
  const pad = 8;
  const gap = 10;
  const estW = Math.min(280, Math.max(140, containerW - 2 * pad));
  if (focusX - gap - estW >= pad) return { anchorX: focusX, side: "left" };
  let anchorX = focusX;
  if (anchorX + gap + estW > containerW - pad) anchorX = containerW - pad - gap - estW;
  return { anchorX: Math.max(pad, anchorX), side: "right" };
}

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
};

function EconomyHistoryBarChart({
  points,
  eventLabel,
}: {
  points: HistoryPoint[];
  eventLabel: string;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const { values, labels, axisLabels, maxV, yTicks } = useMemo(() => {
    const vals: number[] = [];
    const labs: string[] = [];
    const axisLabs: string[] = [];
    for (const pt of points) {
      const v = pt.actual ?? pt.previous;
      if (v == null || !Number.isFinite(v)) continue;
      vals.push(v);
      labs.push(formatPeriodLabel(pt.date, pt.period));
      axisLabs.push(formatAxisLabel(pt.date, pt.period));
    }
    const rawMax = vals.length ? Math.max(...vals.map(Math.abs)) : 0;
    const top = axisMaxForFiveTicks(rawMax || 1);
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => (top * (tickCount - 1 - i)) / (tickCount - 1));
    return { values: vals, labels: labs, axisLabels: axisLabs, maxV: top, yTicks: ticks };
  }, [points]);

  const n = values.length;
  const plotGridTemplate = n > 0 ? `repeat(${n}, minmax(0, 1fr))` : undefined;
  const plotHeight = CHART_HEIGHT - AXIS_ROW_PX;

  const clearHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  const handleBarHover = (
    e: MouseEvent<HTMLElement>,
    i: number,
    label: string,
    value: number,
  ) => {
    const plot = plotRef.current;
    if (!plot) return;
    const plotR = plot.getBoundingClientRect();
    const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const focusX = col.left + col.width / 2 - plotR.left;
    const { anchorX, side } = computeTooltipPlacement(focusX, Math.max(1, Math.floor(plotR.width)));
    setHoveredIndex(i);
    setTip({
      anchorX,
      y: e.clientY - plotR.top,
      side,
      periodLabel: label,
      valueLine: `${eventLabel}: ${formatEconomyMetric(value)}`,
    });
  };

  if (n === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
        style={{ height: CHART_HEIGHT }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-visible">
      <div className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible" style={{ height: CHART_HEIGHT }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div
            ref={plotRef}
            className="relative min-h-0 min-w-0 flex-1"
            onPointerLeave={clearHover}
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[8%]" aria-hidden>
              {yTicks.map((_, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-[#F4F4F5]"
                    style={{ top: `${pct}%` }}
                  />
                );
              })}
            </div>

            <div
              className="absolute inset-x-0 top-[8%] bottom-[8%] grid min-h-0 w-full min-w-0 items-stretch px-0"
              style={{ gridTemplateColumns: plotGridTemplate }}
              role="img"
              aria-label={`${eventLabel} bar chart`}
            >
              {values.map((v, i) => {
                const hPct = maxV > 0 ? (Math.max(0, Math.abs(v)) / maxV) * 100 : 0;
                return (
                  <div
                    key={`${axisLabels[i]}-${i}`}
                    className="relative z-0 flex h-full min-h-0 min-w-0 flex-col items-center justify-end px-0.5"
                    onMouseEnter={(e) => handleBarHover(e, i, labels[i]!, v)}
                    onMouseMove={(e) => handleBarHover(e, i, labels[i]!, v)}
                  >
                    {hoveredIndex === i && (
                      <div
                        className="pointer-events-none absolute inset-0 z-0"
                        style={{ backgroundColor: HOVER_COLUMN_BG }}
                        aria-hidden
                      />
                    )}
                    <div className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-end">
                      <div
                        className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none transition-[height] duration-75"
                        style={{
                          width: BAR_WIDTH_PX,
                          maxWidth: "100%",
                          height: `${hPct}%`,
                          minHeight: hPct > 0 ? 2 : 0,
                          backgroundColor: BAR_COLOR,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {tip && (
              <div
                className="pointer-events-none absolute z-30 max-w-[min(280px,calc(100%-16px))] rounded-lg bg-[#09090B] px-3 py-2.5 pr-3.5 text-left text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                style={{
                  left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
                  top: tip.y,
                  transform:
                    tip.side === "left"
                      ? "translate(calc(-100% - 10px), -50%)"
                      : "translate(10px, -50%)",
                }}
              >
                {tip.side === "left" ? (
                  <span
                    className="absolute top-1/2 left-full -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-[#09090B]"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="absolute top-1/2 right-full -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#09090B]"
                    aria-hidden
                  />
                )}
                <p className="text-[12px] font-semibold leading-4 text-white">{tip.periodLabel}</p>
                <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#71717A]">
                  {tip.valueLine}
                </p>
              </div>
            )}
          </div>

          <div
            className="relative h-full shrink-0 pl-3 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
            style={{ width: Y_AXIS_W_PX }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[8%]">
              {yTicks.map((t, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <span
                    key={i}
                    className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                    style={{ top: `${pct}%` }}
                  >
                    {formatYAxisValue(t)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: AXIS_ROW_PX }}>
          <div
            className="mb-2 grid min-w-0 flex-1 items-end justify-items-stretch px-0"
            style={{ gridTemplateColumns: plotGridTemplate }}
          >
            {axisLabels.map((axisLab, i) => {
              const show = n <= 24 || i % Math.ceil(n / 24) === 0 || i === n - 1;
              return (
                <div
                  key={`${axisLab}-${i}`}
                  className="flex min-h-0 min-w-0 items-end justify-center overflow-visible px-0.5 pb-0.5"
                  title={labels[i]}
                >
                  {show && (
                    <span
                      className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                      style={{
                        transform: `rotate(${AXIS_LABEL_ROTATE_DEG}deg)`,
                        transformOrigin: "center bottom",
                      }}
                    >
                      {axisLab}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ width: Y_AXIS_W_PX }} className="shrink-0 pl-3" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function EconomyEventHistoryModal({
  open,
  onClose,
  event,
  country,
}: {
  open: boolean;
  onClose: () => void;
  event: EconomyCalendarEvent;
  country: string;
}) {
  const titleId = useId();

  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventLabel = useMemo(() => {
    let t = event.type;
    const c = (event.comparison ?? "").toLowerCase();
    if (c === "yoy") t += " YoY";
    else if (c === "mom") t += " MoM";
    else if (c === "qoq") t += " QoQ";
    return t;
  }, [event.type, event.comparison]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPoints([]);

    const params = new URLSearchParams({ type: event.type, country });
    if (event.comparison) params.set("comparison", event.comparison);

    fetch(`/api/economy/history?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((json: { points?: HistoryPoint[] }) => {
        if (cancelled) return;
        setPoints(Array.isArray(json.points) ? json.points : []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load historical data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, event.type, event.comparison, country]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
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

  const latestActual = points.length > 0 ? points[points.length - 1]! : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[18px] font-semibold leading-7 text-[#09090B]">
              {eventLabel}
            </h2>
            {latestActual && (
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-[13px] leading-5 text-[#71717A]">
                {latestActual.actual != null && (
                  <span>
                    Actual: <span className="font-medium text-[#09090B]">{formatEconomyMetric(latestActual.actual)}</span>
                  </span>
                )}
                {latestActual.estimate != null && (
                  <span>
                    Forecast: <span className="font-medium text-[#09090B]">{formatEconomyMetric(latestActual.estimate)}</span>
                  </span>
                )}
                {latestActual.previous != null && (
                  <span>
                    Prior: <span className="font-medium text-[#09090B]">{formatEconomyMetric(latestActual.previous)}</span>
                  </span>
                )}
              </div>
            )}
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

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center text-[14px] text-[#71717A]" style={{ height: CHART_HEIGHT }}>
              Loading historical data…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center text-[14px] text-[#71717A]" style={{ height: CHART_HEIGHT }}>
              {error}
            </div>
          ) : points.length === 0 ? (
            <div className="flex items-center justify-center text-[14px] text-[#71717A]" style={{ height: CHART_HEIGHT }}>
              No historical data available
            </div>
          ) : (
            <EconomyHistoryBarChart points={points} eventLabel={eventLabel} />
          )}
        </div>

        {!loading && points.length > 0 && (
          <div className="max-h-[240px] shrink-0 overflow-y-auto border-t border-[#E4E4E7]">
            <div className="divide-y divide-[#E4E4E7] bg-white">
              <div className={`${historyRowGrid} sticky top-0 z-10 min-h-[44px] items-center bg-white px-2 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}>
                <div className="min-w-0 text-left">Date</div>
                <div className="min-w-0 w-full text-right">Actual</div>
                <div className="min-w-0 w-full text-right">Forecast</div>
                <div className="min-w-0 w-full text-right">Prior</div>
              </div>
              {[...points].reverse().map((pt, i) => (
                <div
                  key={`${pt.date}-${i}`}
                  className={`${historyRowGrid} min-h-[48px] items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4`}
                >
                  <div className="min-w-0 truncate text-left text-[14px] font-normal leading-5 text-[#71717A]">
                    {formatPeriodLabel(pt.date, pt.period)}
                  </div>
                  <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-[#09090B]">
                    {formatEconomyMetric(pt.actual)}
                  </div>
                  <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {formatEconomyMetric(pt.estimate)}
                  </div>
                  <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                    {formatEconomyMetric(pt.previous)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
