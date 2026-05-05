"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { SegmentedControl } from "@/components/design-system";
import type { CryptoFearGreedHistoryPoint } from "@/lib/market/alternative-fear-greed";
import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

function fmtDate(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function fmtYear(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { year: "numeric" });
}

function fmtMonth(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function fmtMonthDay(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scaleLinear(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return (y0 + y1) / 2;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function nearestPointByTs(points: CryptoFearGreedHistoryPoint[], ts: number): CryptoFearGreedHistoryPoint | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid]!.timestamp < ts) lo = mid + 1;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = lo > 0 ? points[lo - 1]! : null;
  if (!b) return a;
  return Math.abs(a.timestamp - ts) <= Math.abs(b.timestamp - ts) ? a : b;
}

export function CryptoFearGreedModal({
  open,
  onClose,
  latestValue,
  latestLabel,
}: {
  open: boolean;
  onClose: () => void;
  latestValue: number | null;
  latestLabel: string;
}) {
  const titleId = useId();
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<StockChartRange>("1M");
  const [loading, setLoading] = useState(false);
  const [allPoints, setAllPoints] = useState<CryptoFearGreedHistoryPoint[]>([]);
  const [hover, setHover] = useState<{
    point: CryptoFearGreedHistoryPoint;
    x: number;
    y: number;
    pageX: number;
    pageY: number;
  } | null>(null);

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
    let cancelled = false;
    setLoading(true);
    fetch("/api/crypto/fear-greed?limit=0", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Request failed"))))
      .then((data: { points?: CryptoFearGreedHistoryPoint[] }) => {
        if (cancelled) return;
        setAllPoints(Array.isArray(data.points) ? data.points : []);
      })
      .catch(() => {
        if (!cancelled) setAllPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const points = useMemo(() => {
    if (!allPoints.length) return [];
    if (range === "ALL") return allPoints;

    const lastTs = allPoints[allPoints.length - 1]!.timestamp;
    const lastDate = new Date(lastTs * 1000);
    const start = (() => {
      if (range === "1D") return lastTs - 1 * 24 * 60 * 60;
      if (range === "5D") return lastTs - 5 * 24 * 60 * 60;
      if (range === "1M") return lastTs - 30 * 24 * 60 * 60;
      if (range === "6M") return lastTs - 183 * 24 * 60 * 60;
      if (range === "YTD") return Math.floor(Date.UTC(lastDate.getUTCFullYear(), 0, 1) / 1000);
      if (range === "1Y") return lastTs - 365 * 24 * 60 * 60;
      if (range === "5Y") return lastTs - 5 * 365 * 24 * 60 * 60;
      return lastTs - 30 * 24 * 60 * 60;
    })();

    return allPoints.filter((p) => p.timestamp >= start);
  }, [allPoints, range]);

  const chart = useMemo(() => {
    const w = 920;
    const h = 400;
    const padX = 44;
    const padY = 22;
    const padBottom = 36;
    const innerW = w - padX * 2;
    const innerH = h - padY - padBottom;

    const xs = points.map((p) => p.timestamp);
    const xMin = xs.length ? Math.min(...xs) : 0;
    const xMax = xs.length ? Math.max(...xs) : 1;
    const yMin = 0;
    const yMax = 100;

    const toX = (ts: number) => scaleLinear(ts, xMin, xMax, padX, padX + innerW);
    const toY = (v: number) => scaleLinear(v, yMin, yMax, padY + innerH, padY);

    const d =
      points.length >= 2
        ? points
            .map((p, i) => {
              const x = toX(p.timestamp);
              const y = toY(p.value);
              return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ")
        : "";

    const last = points.length ? points[points.length - 1]! : null;
    const lastX = last ? toX(last.timestamp) : null;
    const lastY = last ? toY(last.value) : null;

    const tickCount = range === "1D" || range === "5D" ? 5 : range === "1M" ? 6 : 7;
    const ticksX = Array.from({ length: tickCount }, (_, i) => {
      const t = i / (tickCount - 1);
      const ts = xMin + t * (xMax - xMin);
      const label =
        range === "5Y" || range === "ALL"
          ? fmtYear(ts)
          : range === "6M" || range === "1Y" || range === "YTD"
            ? fmtMonth(ts)
            : fmtMonthDay(ts);
      return { ts, x: toX(ts), label };
    });

    const fromX = (x: number) => scaleLinear(x, padX, padX + innerW, xMin, xMax);

    return { w, h, d, last, lastX, lastY, ticksX, padX, padY, padBottom, innerH, innerW, toX, toY, fromX, xMin, xMax };
  }, [points, range]);

  const onChartMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (points.length < 2) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const xClamped = clamp(x, chart.padX, chart.padX + chart.innerW);
      const ts = chart.fromX(xClamped);
      const pt = nearestPointByTs(points, ts);
      if (!pt) return;
      const px = chart.toX(pt.timestamp);
      const py = chart.toY(pt.value);
      setHover({ point: pt, x: px, y: py, pageX: e.clientX, pageY: e.clientY });
    },
    [chart, points],
  );

  const onChartMouseLeave = useCallback(() => setHover(null), []);

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
              Fear &amp; Greed Index
            </h2>
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

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3">
          <h3 className="min-w-0 text-[17px] font-semibold leading-7 text-[#09090B]">
            {latestLabel}: {latestValue == null ? "—" : latestValue}
          </h3>
          <div className="min-w-0 max-w-full overflow-x-auto pb-0.5 sm:max-w-none sm:overflow-visible sm:pb-0">
            <SegmentedControl
              options={STOCK_CHART_RANGES.map((r) => ({ value: r, label: r }))}
              value={range}
              onChange={setRange}
              size="sm"
              aria-label="Date range"
              className="min-w-min flex-nowrap"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex h-[400px] items-center justify-center text-[14px] text-[#71717A]">Loading…</div>
          ) : points.length < 2 ? (
            <div className="flex h-[400px] items-center justify-center text-[14px] text-[#71717A]">
              No history available.
            </div>
          ) : (
            <div className="min-w-0">
              <div ref={chartWrapRef} className="relative w-full">
                <svg
                  viewBox={`0 0 ${chart.w} ${chart.h}`}
                  className="h-[400px] w-full"
                  role="img"
                  aria-label="Fear & Greed history"
                  onMouseMove={onChartMouseMove}
                  onMouseLeave={onChartMouseLeave}
                >
                  {/* grid */}
                  {[0, 25, 50, 75, 100].map((v) => {
                    const y = scaleLinear(v, 0, 100, chart.padY + chart.innerH, chart.padY);
                    return (
                      <g key={v}>
                        <line x1={chart.padX} x2={chart.w - chart.padX} y1={y} y2={y} stroke="#E4E4E7" strokeWidth="1" />
                        <text x={chart.w - chart.padX + 8} y={y + 4} fontSize="12" fill="#71717A">
                          {v}
                        </text>
                      </g>
                    );
                  })}
                  {/* path */}
                  <path d={chart.d} fill="none" stroke="#2563EB" strokeWidth="2.5" />
                  {/* last point */}
                  {chart.lastX != null && chart.lastY != null ? (
                    <circle
                      cx={chart.lastX}
                      cy={chart.lastY}
                      r="5"
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                    />
                  ) : null}

                  {/* hover crosshair */}
                  {hover ? (
                    <g>
                      <line
                        x1={hover.x}
                        x2={hover.x}
                        y1={chart.padY}
                        y2={chart.padY + chart.innerH}
                        stroke="#E4E4E7"
                        strokeWidth="1"
                      />
                      <circle cx={hover.x} cy={hover.y} r="5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2.5" />
                    </g>
                  ) : null}

                  {/* x-axis labels (horizontal) */}
                  {chart.ticksX.map((t, idx) => (
                    <text
                      key={idx}
                      x={t.x}
                      y={chart.h - 10}
                      textAnchor={idx === 0 ? "start" : idx === chart.ticksX.length - 1 ? "end" : "middle"}
                      fontSize="12"
                      fill="#71717A"
                    >
                      {t.label}
                    </text>
                  ))}
                </svg>

                {hover && chartWrapRef.current ? (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute z-10 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
                    style={{
                      left: `clamp(8px, ${hover.x}px, calc(100% - 8px))`,
                      top: 8,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="text-[12px] font-medium leading-4 text-[#71717A]">{fmtDate(hover.point.timestamp)}</div>
                    <div className="mt-1 text-[13px] font-semibold leading-5 text-[#09090B] tabular-nums">
                      {hover.point.value}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

