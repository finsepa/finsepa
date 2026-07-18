"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChartSpline } from "@/lib/icons";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  FUNDAMENTALS_CHART_AXIS_ROW_PX,
  FUNDAMENTALS_CHART_GRID_LINE_COLOR,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cumulativeRealizedGainUsdForAsset } from "@/lib/portfolio/realized-pnl-from-trades";
import {
  portfolioHoldingDisplayName,
  usePortfolioHoldingDisplayNames,
} from "@/lib/portfolio/use-portfolio-holding-display-names";
import { cn } from "@/lib/utils";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";

const PROFIT_BAR = "#22C55E";
const LOSS_BAR = "#EF4444";
const PROFIT_TEXT = "#16A34A";
const LOSS_TEXT = "#DC2626";

const Y_LABEL_W_PX = 76;
const VALUE_LABEL_W_PX = 52;
const ROW_HEIGHT_PX = 36;
const BAR_HEIGHT_PX = 22;
const X_AXIS_TICK_COUNT = 6;
const TOOLTIP_OFFSET_PX = 12;
const TOOLTIP_EST_W_PX = 240;
const TOOLTIP_EST_H_PX = 112;

const CHART_SEGMENT_TRACK_CLASS =
  "flex w-auto min-w-0 flex-nowrap gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5";
const CHART_SEGMENT_BTN_CLASS =
  "flex-none rounded-[10px] px-3 py-1.5 text-center font-sans text-[13px] leading-5 tracking-normal";
const CHART_SEGMENT_ACTIVE_CLASS =
  "bg-white font-medium text-[#0F0F0F] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]";
const CHART_SEGMENT_INACTIVE_CLASS = "font-normal text-[#71717A]";

type MetricMode = "usd" | "pct";

type PerfRow = {
  h: PortfolioHolding;
  unrealizedUsd: number;
  realizedUsd: number;
  totalProfitUsd: number;
  totalProfitPct: number | null;
  symbol: string;
  companyName: string;
  assetHref: string | null;
};

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function niceCeiling(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const frac = n / 10 ** exp;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * 10 ** exp;
}

function formatSignedUsd(n: number): string {
  const s = usd0.format(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct(n: number): string {
  const s = pctFmt.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function formatAxisUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function formatBarLabelUsd(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs >= 100) return `${sign}$${Math.round(abs)}`;
  return formatSignedUsd(n);
}

function formatBarLabelPct(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100) return formatSignedPct(Math.round(n));
  return formatSignedPct(n);
}

function formatAxisPct(n: number): string {
  return `${Math.round(n)}%`;
}

function rowValue(row: PerfRow, metric: MetricMode): number | null {
  if (metric === "usd") return row.totalProfitUsd;
  return row.totalProfitPct;
}

function tooltipNearPointer(clientX: number, clientY: number): { left: number; top: number } {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = clientX + TOOLTIP_OFFSET_PX;
  let top = clientY - TOOLTIP_EST_H_PX - TOOLTIP_OFFSET_PX;
  if (left + TOOLTIP_EST_W_PX > vw - pad) {
    left = clientX - TOOLTIP_EST_W_PX - TOOLTIP_OFFSET_PX;
  }
  if (top < pad) top = clientY + TOOLTIP_OFFSET_PX;
  left = Math.max(pad, Math.min(left, vw - pad - TOOLTIP_EST_W_PX));
  top = Math.max(pad, Math.min(top, vh - pad - TOOLTIP_EST_H_PX));
  return { left, top };
}

function ChartSegmentToggle<T extends string>({
  "aria-label": ariaLabel,
  options,
  value,
  onChange,
  className,
}: {
  "aria-label": string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn(CHART_SEGMENT_TRACK_CLASS, className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            CHART_SEGMENT_BTN_CLASS,
            value === opt.value ? CHART_SEGMENT_ACTIVE_CLASS : CHART_SEGMENT_INACTIVE_CLASS,
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function HoldingsPerformanceBarChart({
  rows,
  metric,
}: {
  rows: PerfRow[];
  metric: MetricMode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<{ i: number; clientX: number; clientY: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const plotHeightPx = Math.max(ROW_HEIGHT_PX, rows.length * ROW_HEIGHT_PX);

  const { xMax, ticks } = useMemo(() => {
    let maxAbs = 0;
    for (const row of rows) {
      const v = rowValue(row, metric);
      if (v != null && Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    const xMax = niceCeiling(maxAbs * 1.08) || 1;
    const ticks = Array.from({ length: X_AXIS_TICK_COUNT }, (_, i) => (xMax * i) / (X_AXIS_TICK_COUNT - 1));
    return { xMax, ticks };
  }, [rows, metric]);

  const updateHover = useCallback((i: number, clientX: number, clientY: number) => {
    setHover({ i, clientX, clientY });
    setTooltipPos(tooltipNearPointer(clientX, clientY));
  }, []);

  useEffect(() => {
    if (!hover) return;
    const reposition = () => {
      setTooltipPos(tooltipNearPointer(hover.clientX, hover.clientY));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [hover]);

  const hovered = hover != null ? rows[hover.i] : null;
  const hoveredValue = hovered ? rowValue(hovered, metric) : null;

  const tooltipEl =
    mounted && hovered && hoveredValue != null ?
      createPortal(
        <div
          role="tooltip"
          className={cn(FUNDAMENTALS_CHART_TOOLTIP_CLASS, "!fixed z-[200] w-[240px]")}
          style={{ left: tooltipPos.left, top: tooltipPos.top }}
        >
          <div className="text-[12px] font-semibold leading-4 text-[#0F0F0F]">{hovered.companyName}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] leading-4">
            <div className="text-[#71717A]">Unrealized</div>
            <div
              className={cn(
                "text-right tabular-nums",
                hovered.unrealizedUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
              )}
            >
              {formatSignedUsd(hovered.unrealizedUsd)}
            </div>
            <div className="text-[#71717A]">Realized</div>
            <div
              className={cn(
                "text-right tabular-nums",
                hovered.realizedUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
              )}
            >
              {formatSignedUsd(hovered.realizedUsd)}
            </div>
            <div className="text-[#71717A]">Total</div>
            <div
              className={cn(
                "text-right font-semibold tabular-nums",
                hovered.totalProfitUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
              )}
            >
              {formatSignedUsd(hovered.totalProfitUsd)}
              {hovered.totalProfitPct != null ? (
                <span className="font-normal text-[#71717A]"> · {formatSignedPct(hovered.totalProfitPct)}</span>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {tooltipEl}
      <div ref={wrapRef} className="relative w-full min-w-0" onPointerLeave={() => setHover(null)}>
        <div
          role="img"
          aria-label="Holdings total profit by asset"
          style={{ height: plotHeightPx + FUNDAMENTALS_CHART_AXIS_ROW_PX }}
        >
          <div className="flex min-h-0 w-full min-w-0" style={{ height: plotHeightPx }}>
            <div className="relative shrink-0" style={{ width: Y_LABEL_W_PX }} aria-hidden={rows.length === 0}>
              {rows.map((row, i) => (
                <div
                  key={row.h.id}
                  className="flex items-center justify-end pr-2 text-[13px] font-medium leading-5 text-[#0F0F0F]"
                  style={{ height: ROW_HEIGHT_PX }}
                  onPointerEnter={(e) => updateHover(i, e.clientX, e.clientY)}
                  onPointerMove={(e) => updateHover(i, e.clientX, e.clientY)}
                >
                  <span className="truncate tabular-nums">{row.symbol}</span>
                </div>
              ))}
            </div>

            <div className="relative min-w-0 flex-1 overflow-hidden">
              <div className="pointer-events-none absolute inset-0 z-0 bg-white" aria-hidden>
                <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              </div>

              {ticks.map((tick) => {
                const leftPct = xMax > 0 ? (tick / xMax) * 100 : 0;
                return (
                  <div
                    key={tick}
                    className="pointer-events-none absolute inset-y-0 z-[1] w-px border-l border-dashed"
                    style={{ left: `${leftPct}%`, borderColor: FUNDAMENTALS_CHART_GRID_LINE_COLOR }}
                    aria-hidden
                  />
                );
              })}

              {rows.map((row, i) => {
                const value = rowValue(row, metric);
                const hasValue = value != null && Number.isFinite(value);
                const absValue = hasValue ? Math.abs(value) : 0;
                const barWidthPct = xMax > 0 ? (absValue / xMax) * 100 : 0;
                const isPositive = hasValue && value >= 0;
                const barColor = isPositive ? PROFIT_BAR : LOSS_BAR;
                const isHovered = hover?.i === i;

                return (
                  <div
                    key={row.h.id}
                    className={cn("relative z-[2] w-full min-w-0", row.assetHref && "cursor-pointer")}
                    style={{ height: ROW_HEIGHT_PX }}
                    onPointerEnter={(e) => updateHover(i, e.clientX, e.clientY)}
                    onPointerMove={(e) => updateHover(i, e.clientX, e.clientY)}
                    onClick={
                      row.assetHref ?
                        () => {
                          router.push(row.assetHref!);
                        }
                      : undefined
                    }
                    onKeyDown={
                      row.assetHref ?
                        (e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          router.push(row.assetHref!);
                        }
                      : undefined
                    }
                    tabIndex={row.assetHref ? 0 : undefined}
                    role={row.assetHref ? "link" : undefined}
                    aria-label={row.assetHref ? `Open ${row.companyName}` : undefined}
                  >
                    {isHovered ? (
                      <div
                        className="pointer-events-none absolute inset-y-0 -left-1 right-0 z-0"
                        style={{ background: FUNDAMENTALS_CHART_HOVER_BAND_BG }}
                        aria-hidden
                      />
                    ) : null}

                    {hasValue && absValue > 0 ? (
                      <div
                        className="absolute top-1/2 z-[1] -translate-y-1/2 rounded-[3px]"
                        style={{
                          left: 0,
                          width: `${Math.max(barWidthPct, 0.4)}%`,
                          height: BAR_HEIGHT_PX,
                          backgroundColor: barColor,
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="relative shrink-0" style={{ width: VALUE_LABEL_W_PX }}>
              {rows.map((row, i) => {
                const value = rowValue(row, metric);
                const hasValue = value != null && Number.isFinite(value);
                const isPositive = hasValue && value >= 0;
                const textColor = isPositive ? PROFIT_TEXT : LOSS_TEXT;
                const label =
                  hasValue ?
                    metric === "usd" ?
                      formatBarLabelUsd(value)
                    : formatBarLabelPct(value)
                  : "—";

                return (
                  <div
                    key={row.h.id}
                    className="flex items-center justify-end truncate pl-1 text-[12px] font-semibold tabular-nums leading-4"
                    style={{ height: ROW_HEIGHT_PX, color: hasValue ? textColor : "#A1A1AA" }}
                    onPointerEnter={(e) => updateHover(i, e.clientX, e.clientY)}
                    onPointerMove={(e) => updateHover(i, e.clientX, e.clientY)}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex w-full min-w-0" style={{ height: FUNDAMENTALS_CHART_AXIS_ROW_PX }}>
            <div className="shrink-0" style={{ width: Y_LABEL_W_PX }} aria-hidden />
            <div className="relative min-w-0 flex-1 overflow-hidden">
              {ticks.map((tick, tickIndex) => {
                const leftPct = xMax > 0 ? (tick / xMax) * 100 : 0;
                const isFirst = tickIndex === 0;
                const isLast = tickIndex === ticks.length - 1;
                return (
                  <span
                    key={tick}
                    className={cn(
                      "absolute top-2 text-[11px] font-normal tabular-nums leading-4 text-[#71717A]",
                      isFirst && "left-0",
                      isLast && "right-0",
                      !isFirst && !isLast && "-translate-x-1/2",
                    )}
                    style={!isFirst && !isLast ? { left: `${leftPct}%` } : undefined}
                  >
                    {metric === "usd" ? formatAxisUsd(tick) : formatAxisPct(tick)}
                  </span>
                );
              })}
            </div>
            <div className="shrink-0" style={{ width: VALUE_LABEL_W_PX }} aria-hidden />
          </div>
        </div>
      </div>
    </>
  );
}

function PortfolioHoldingsPerformanceChartInner({
  holdings,
  transactions,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const [metric, setMetric] = useState<MetricMode>("usd");
  const [sortDesc, setSortDesc] = useState(true);
  const resolvedCompanyNames = usePortfolioHoldingDisplayNames(holdings);

  const sortedRows = useMemo(() => {
    const rows: PerfRow[] = holdings.map((h) => {
      const unrealizedUsd = h.currentValue - h.costBasis;
      const routeKey = cryptoRouteBase(h.symbol);
      const assetKind: "stock" | "crypto" = isSupportedCryptoAssetSymbol(routeKey) ? "crypto" : "stock";
      const realizedUsd = cumulativeRealizedGainUsdForAsset(transactions, routeKey, assetKind);
      const totalProfitUsd = unrealizedUsd + realizedUsd;
      const totalProfitPct = h.costBasis > 0 ? (totalProfitUsd / h.costBasis) * 100 : null;
      return {
        h,
        unrealizedUsd,
        realizedUsd,
        totalProfitUsd,
        totalProfitPct,
        symbol: h.symbol.trim().toUpperCase() || h.name.trim(),
        companyName: portfolioHoldingDisplayName(h, resolvedCompanyNames),
        assetHref: portfolioHoldingAssetHref(h.symbol, { tab: "holdings" }),
      };
    });

    rows.sort((a, b) => {
      const av = rowValue(a, metric) ?? -Infinity;
      const bv = rowValue(b, metric) ?? -Infinity;
      const diff = bv - av;
      const cmp = sortDesc ? diff : -diff;
      if (cmp !== 0) return cmp;
      return a.symbol.localeCompare(b.symbol);
    });
    return rows;
  }, [holdings, transactions, resolvedCompanyNames, metric, sortDesc]);

  if (holdings.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(40vh,360px)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartSpline className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No holdings to show</EmptyTitle>
          <EmptyDescription>
            Add stocks, ETFs, or funds to this portfolio to see per-asset profit and return.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium leading-5 text-[#71717A] transition-colors hover:text-[#0F0F0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15"
          aria-label={
            sortDesc ?
              "Sort: lowest first"
            : "Sort: highest first"
          }
        >
          {metric === "usd" ? "Total profit" : "Return"}
          {sortDesc ? (
            <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          ) : (
            <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
          )}
        </button>
        <ChartSegmentToggle
          aria-label="Holdings performance metric"
          options={[
            { value: "usd", label: "Profit $" },
            { value: "pct", label: "Return %" },
          ]}
          value={metric}
          onChange={setMetric}
        />
      </div>

      <HoldingsPerformanceBarChart rows={sortedRows} metric={metric} />
    </div>
  );
}

export const PortfolioHoldingsPerformanceChart = memo(PortfolioHoldingsPerformanceChartInner);
