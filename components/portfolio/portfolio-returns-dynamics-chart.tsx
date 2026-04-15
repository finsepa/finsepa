"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, LineChart } from "lucide-react";

import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type {
  PeriodReturnGranularity,
  PortfolioPeriodReturnBar,
} from "@/lib/portfolio/portfolio-period-returns-types";
import { cn } from "@/lib/utils";

const PORTFOLIO_BAR = "#2563EB";
const BENCHMARK_BAR = "#EA580C";
const NEGATIVE_ZONE = "rgba(254, 242, 242, 0.92)";

/** Total SVG height — primary plot area (bars + x-axis). */
const CHART_PLOT_HEIGHT_PX = 320;
/** Always six labeled ticks on the Y axis (five equal steps). */
const Y_AXIS_TICK_COUNT = 6;
const Y_AXIS_STEP_COUNT = Y_AXIS_TICK_COUNT - 1;

const GRANULARITY_OPTIONS: TabSwitcherOption<PeriodReturnGranularity>[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const BENCHMARK_OPTIONS: { ticker: string; label: string }[] = [
  { ticker: "SPY", label: "S&P 500" },
  { ticker: "QQQ", label: "Nasdaq-100" },
];

function formatPctAxis(n: number): string {
  const rounded =
    Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 10) / 10;
  const intLike = Math.abs(rounded - Math.round(rounded)) < 1e-6;
  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: intLike ? 0 : 1,
      signDisplay: "exceptZero",
    }).format(rounded) + "%"
  );
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 5;
  const exp = Math.floor(Math.log10(rough));
  const f = rough / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

function formatTooltipPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      signDisplay: "exceptZero",
    }).format(n) + "%"
  );
}

function niceYRange(
  values: number[],
): { yMin: number; yMax: number; ticks: number[] } {
  const G = Y_AXIS_STEP_COUNT;

  let lo = 0;
  let hi = 0;
  let any = false;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    any = true;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }

  if (!any) {
    const yMin = -10;
    const step = 10;
    const ticks = Array.from({ length: Y_AXIS_TICK_COUNT }, (_, k) => yMin + k * step);
    return { yMin, yMax: yMin + G * step, ticks };
  }

  const pad = Math.max((hi - lo) * 0.12, 1);
  const loP = Math.min(lo - pad, 0);
  const hiP = Math.max(hi + pad, 0);
  const spanNeed = Math.max(hiP - loP, 1e-6);

  let step = niceStep(spanNeed / G);
  if (!Number.isFinite(step) || step <= 0) step = 5;

  let yMin = Math.floor(loP / step) * step;
  let yMax = yMin + G * step;
  let guard = 0;
  while (yMax < hiP - 1e-9 && guard++ < 80) {
    const bumped = niceStep(step * 1.15);
    step = bumped <= step ? step * 2 : bumped;
    yMin = Math.floor(loP / step) * step;
    yMax = yMin + G * step;
  }

  guard = 0;
  while (yMin > loP + 1e-9 && guard++ < 80) {
    yMin -= step;
    yMax -= step;
  }

  guard = 0;
  while (yMax < hiP - 1e-9 && guard++ < 80) {
    yMin += step;
    yMax += step;
  }

  const ticks = Array.from({ length: Y_AXIS_TICK_COUNT }, (_, k) => yMin + k * step);
  return { yMin, yMax, ticks };
}

/** Loading UI aligned with {@link DynamicsSvg}: Y-axis gutter, grid, negative band, bar slots, X labels, legend. */
function ReturnsDynamicsChartSkeleton() {
  const barCount = 6;
  /** Pixel heights from baseline — scaled for {@link CHART_PLOT_HEIGHT_PX} plot. */
  const barHeightsPx = [119, 162, 96, 186, 126, 140];
  return (
    <div className="chart-skeleton-shimmer w-full" role="presentation" aria-hidden>
      <div className="flex w-full min-w-0">
        <div className="flex w-11 shrink-0 flex-col justify-between py-3 pr-2">
          {Array.from({ length: Y_AXIS_TICK_COUNT }).map((_, i) => (
            <div key={i} className="skeleton ml-auto h-2.5 w-9 rounded-sm" />
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: CHART_PLOT_HEIGHT_PX }}>
          <div className="pointer-events-none absolute inset-x-0 bottom-[56px] top-3 flex flex-col justify-between">
            {Array.from({ length: Y_AXIS_TICK_COUNT }).map((_, i) => (
              <div key={i} className="h-px w-full bg-[#E4E4E7]" />
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-[56px] top-[52%] rounded-sm"
            style={{ background: "rgba(254, 242, 242, 0.75)" }}
          />
          <div className="absolute inset-x-1 bottom-[56px] top-3 flex items-end justify-between gap-0.5">
            {Array.from({ length: barCount }).map((_, i) => (
              <div
                key={i}
                className="skeleton w-full max-w-[36px] rounded-md rounded-b-none"
                style={{ height: barHeightsPx[i % barHeightsPx.length] }}
              />
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex h-12 items-start justify-between gap-1 border-t border-[#E4E4E7] pt-2">
            {Array.from({ length: barCount }).map((_, i) => (
              <div key={i} className="skeleton h-2 w-10 max-w-[18%] rounded-sm" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
        <div className="skeleton h-3 w-20 rounded-sm" />
        <div className="skeleton h-3 w-32 rounded-sm" />
      </div>
    </div>
  );
}

function BenchmarkSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (ticker: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = BENCHMARK_OPTIONS.find((o) => o.ticker === value) ?? BENCHMARK_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-10 min-w-[10rem]">
      <button
        type="button"
        aria-label="Benchmark"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-full cursor-pointer items-center rounded-[10px] bg-[#F4F4F5] py-2 pl-4 pr-10 text-left text-sm font-normal text-[#09090B] outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
      >
        <span className="min-w-0 flex-1 truncate">{active.label}</span>
      </button>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#09090B] transition-transform",
          open && "rotate-180",
        )}
        strokeWidth={2}
        aria-hidden
      />
      {open ? (
        <div
          className={cn(
            dropdownMenuPanelClassName(),
            "absolute left-0 right-0 top-[calc(100%+4px)] z-[120]",
          )}
          role="listbox"
          aria-label="Benchmark"
        >
          {BENCHMARK_OPTIONS.map((opt) => {
            const selected = value === opt.ticker;
            return (
              <button
                key={opt.ticker}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.ticker);
                  setOpen(false);
                }}
                className={dropdownMenuPlainItemRowClassName({ selected })}
              >
                <span className="min-w-0 flex-1 truncate text-left">{opt.label}</span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {selected ? <Check className="h-4 w-4 text-[#09090B]" strokeWidth={2} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DynamicsSvg({
  bars,
  showBenchmark,
  benchmarkLabel,
}: {
  bars: PortfolioPeriodReturnBar[];
  showBenchmark: boolean;
  benchmarkLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setWidth(Math.floor(w0));
    return () => ro.disconnect();
  }, []);

  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 56;
  const plotW = Math.max(120, width - padL - padR);
  const plotH = CHART_PLOT_HEIGHT_PX;
  const innerW = plotW;
  const innerH = plotH - padT - padB;

  const values = useMemo(() => {
    const v: number[] = [];
    for (const b of bars) {
      if (b.portfolioPct != null && Number.isFinite(b.portfolioPct)) v.push(b.portfolioPct);
      if (showBenchmark && b.benchmarkPct != null && Number.isFinite(b.benchmarkPct)) {
        v.push(b.benchmarkPct);
      }
    }
    return v;
  }, [bars, showBenchmark]);

  const { yMin, yMax, ticks } = niceYRange(values);

  const yFor = useCallback(
    (p: number) => padT + ((yMax - p) / (yMax - yMin)) * innerH,
    [yMax, yMin, innerH, padT],
  );

  const y0 = yFor(0);
  const n = Math.max(1, bars.length);
  const groupW = innerW / n;
  const barW = showBenchmark ? Math.min(28, groupW * 0.32) : Math.min(40, groupW * 0.55);
  const gap = showBenchmark ? groupW * 0.08 : groupW * 0.2;

  const updateHoverFromEvent = useCallback((i: number, clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHover({ i, x: clientX - r.left, y: clientY - r.top });
  }, []);

  const hoveredBar = hover != null ? bars[hover.i] : null;

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      onPointerLeave={() => setHover(null)}
    >
      <svg
        width={width}
        height={plotH}
        className="max-w-full"
        role="img"
        aria-label="Portfolio and benchmark period returns"
      >
        <title>Portfolio and benchmark period returns</title>
        {/* Negative zone below zero */}
        <rect
          x={padL}
          y={y0}
          width={innerW}
          height={Math.max(0, padT + innerH - y0)}
          fill={NEGATIVE_ZONE}
        />

        {/* Grid */}
        {ticks.map((t) => {
          const yy = yFor(t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={padL + innerW}
                y1={yy}
                y2={yy}
                stroke="#E4E4E7"
                strokeWidth={Math.abs(t) < 1e-6 ? 1.25 : 1}
              />
              <text
                x={padL - 8}
                y={yy + 4}
                textAnchor="end"
                className="fill-[#71717A] text-[11px] font-medium tabular-nums"
              >
                {formatPctAxis(t)}
              </text>
            </g>
          );
        })}

        {bars.map((b, i) => {
          const gx = padL + i * groupW + groupW / 2;
          const p = b.portfolioPct;
          const bench = b.benchmarkPct;
          const hasP = p != null && Number.isFinite(p);
          const hasB = showBenchmark && bench != null && Number.isFinite(bench);
          const pairW = hasB ? barW * 2 + gap : barW;
          const startX = gx - pairW / 2;

          const els: ReactNode[] = [];
          if (hasP) {
            const y1 = yFor(p!);
            const up = y1 < y0;
            const hPix = Math.max(1, Math.abs(y0 - y1));
            const yTop = up ? y1 : y0;
            els.push(
              <rect
                key="p"
                x={startX}
                y={yTop}
                width={barW}
                height={hPix}
                rx={4}
                ry={4}
                fill={PORTFOLIO_BAR}
              />,
            );
          }
          if (hasB) {
            const y1b = yFor(bench!);
            const upB = y1b < y0;
            const hPixB = Math.max(1, Math.abs(y0 - y1b));
            const yTopB = upB ? y1b : y0;
            els.push(
              <rect
                key="b"
                x={startX + barW + gap}
                y={yTopB}
                width={barW}
                height={hPixB}
                rx={4}
                ry={4}
                fill={BENCHMARK_BAR}
              />,
            );
          }

          const label =
            b.label.length > 14 && bars.length > 8 ? `${b.label.slice(0, 11)}…` : b.label;

          return (
            <g key={`${b.periodStart}-${b.periodEnd}`}>
              {els}
              <text
                x={gx}
                y={plotH - 28}
                textAnchor="middle"
                className="fill-[#71717A] text-[10px] font-medium"
                transform={bars.length > 16 ? `rotate(-35 ${gx} ${plotH - 28})` : undefined}
              >
                {label}
              </text>
            </g>
          );
        })}

        {bars.map((b, i) => {
          const xHit = padL + i * groupW;
          return (
            <rect
              key={`hit-${b.periodStart}-${b.periodEnd}`}
              x={xHit}
              y={0}
              width={groupW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onPointerEnter={(e) => updateHoverFromEvent(i, e.clientX, e.clientY)}
              onPointerMove={(e) => updateHoverFromEvent(i, e.clientX, e.clientY)}
            />
          );
        })}
      </svg>

      {hoveredBar != null && hover != null ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 min-w-[10rem] max-w-[min(calc(100vw-2rem),240px)] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2.5 shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
          style={{
            left: hover.x,
            top: hover.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <p className="text-[11px] font-semibold leading-4 text-[#09090B]">{hoveredBar.label}</p>
          <p className="mt-1.5 text-[11px] leading-4 text-[#71717A]">
            <span className="font-semibold" style={{ color: PORTFOLIO_BAR }}>
              Portfolio
            </span>
            <span className="tabular-nums text-[#09090B]"> {formatTooltipPct(hoveredBar.portfolioPct)}</span>
          </p>
          {showBenchmark ? (
            <p className="mt-0.5 text-[11px] leading-4 text-[#71717A]">
              <span className="font-semibold" style={{ color: BENCHMARK_BAR }}>
                {benchmarkLabel}
              </span>
              <span className="tabular-nums text-[#09090B]"> {formatTooltipPct(hoveredBar.benchmarkPct)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#71717A]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PORTFOLIO_BAR }} />
          Portfolio
        </span>
        {showBenchmark ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BENCHMARK_BAR }} />
            {benchmarkLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PortfolioReturnsDynamicsChartInner({
  transactions,
  canLoad,
}: {
  transactions: PortfolioTransaction[];
  canLoad: boolean;
}) {
  const [granularity, setGranularity] = useState<PeriodReturnGranularity>("annually");
  const [benchmarkTicker, setBenchmarkTicker] = useState("SPY");
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [bars, setBars] = useState<PortfolioPeriodReturnBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const benchmarkLabel = BENCHMARK_OPTIONS.find((o) => o.ticker === benchmarkTicker)?.label ?? "Benchmark";

  const load = useCallback(async () => {
    if (!canLoad) {
      setBars([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/period-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transactions,
          granularity,
          benchmark: benchmarkTicker,
        }),
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as { bars?: PortfolioPeriodReturnBar[] };
      setBars(Array.isArray(json.bars) ? json.bars : []);
    } catch {
      setError("Could not load period returns");
      setBars([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, transactions, granularity, benchmarkTicker]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasRenderable = bars.some(
    (b) =>
      (b.portfolioPct != null && Number.isFinite(b.portfolioPct)) ||
      (b.benchmarkPct != null && Number.isFinite(b.benchmarkPct)),
  );

  return (
    <section className="mb-10 w-full min-w-0">
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <h2 className="shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">
          Dynamics of portfolio returns
        </h2>
        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <BenchmarkSelect value={benchmarkTicker} onChange={setBenchmarkTicker} />

          <button
            type="button"
            role="switch"
            aria-checked={showBenchmark}
            onClick={() => setShowBenchmark((v) => !v)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
              showBenchmark ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
            )}
          >
            <span className="sr-only">Show benchmark comparison</span>
            <span
              className={cn(
                "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
                showBenchmark ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>

          <div className="max-w-full min-w-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabSwitcher
              aria-label="Return period"
              className="w-max min-w-0 justify-end"
              options={GRANULARITY_OPTIONS}
              value={granularity}
              onChange={setGranularity}
            />
          </div>
        </div>
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="min-h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to compare your period returns with a benchmark.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading ? (
          <ReturnsDynamicsChartSkeleton />
        ) : error ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6">
            <p className="text-sm text-[#71717A]">{error}</p>
          </div>
        ) : !hasRenderable ? (
          <Empty variant="plain" className="min-h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">Not enough data</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Try a wider period or add more history to see annual or quarterly bars.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DynamicsSvg bars={bars} showBenchmark={showBenchmark} benchmarkLabel={benchmarkLabel} />
        )}
      </div>
    </section>
  );
}

export const PortfolioReturnsDynamicsChart = memo(PortfolioReturnsDynamicsChartInner);
