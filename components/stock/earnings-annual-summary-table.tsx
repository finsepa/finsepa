"use client";

import { useMemo, type ReactNode } from "react";

import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import type { StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";
import { cn } from "@/lib/utils";

const MAX_ANNUAL_COLUMNS = 10;

const usdScale2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

const pct2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsdBillionsOrMillions(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${sign}${usdScale2.format(abs / 1e9)}B`;
  return `${sign}${usdScale2.format(abs / 1e6)}M`;
}

function displayRevenueUsd(p: StockEarningsEstimatesPoint): number | null {
  if (p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd)) return p.revenueActualUsd;
  if (p.revenueEstimateUsd != null && Number.isFinite(p.revenueEstimateUsd)) return p.revenueEstimateUsd;
  return null;
}

function displayEps(p: StockEarningsEstimatesPoint): number | null {
  if (p.epsActual != null && Number.isFinite(p.epsActual)) return p.epsActual;
  if (p.epsEstimate != null && Number.isFinite(p.epsEstimate)) return p.epsEstimate;
  return null;
}

function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function growthTone(pct: number | null): "neutral" | "positive" | "negative" {
  if (pct == null || !Number.isFinite(pct)) return "neutral";
  if (pct > 0) return "positive";
  if (pct < 0) return "negative";
  return "neutral";
}

function toneClass(tone: "neutral" | "positive" | "negative"): string {
  if (tone === "positive") return "text-[#16A34A]";
  if (tone === "negative") return "text-[#DC2626]";
  return "text-[#09090B]";
}

/** Label column — matches screener row padding (`px-2 sm:px-4`) and row hover (`screener-table.tsx`). */
const labelRowBase =
  "flex min-h-[60px] items-center border-b border-[#E4E4E7] bg-white px-2 py-3 text-left text-[14px] leading-5 transition-colors duration-75 group-hover:bg-neutral-50 sm:px-4";

const labelPrimaryClass = cn(labelRowBase, "font-semibold text-[#09090B]");
const labelMutedClass = cn(labelRowBase, "font-normal text-[#71717A]");

const headerYearCellClass =
  "flex min-h-[44px] items-center justify-end border-b border-[#E4E4E7] px-2 py-0 text-right text-[12px] font-medium leading-5 text-[#71717A] tabular-nums sm:px-4 sm:text-[14px]";

const headerCornerClass =
  "flex min-h-[44px] items-center border-b border-[#E4E4E7] bg-white px-2 py-0 text-left sm:px-4";

function DataCell({
  projected,
  children,
  tone = "neutral",
  growth = false,
  valueStyle = "default",
}: {
  projected: boolean;
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  growth?: boolean;
  /** Revenue line uses semibold like primary metrics; EPS uses regular. */
  valueStyle?: "default" | "revenue";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60px] items-center justify-end border-b border-[#E4E4E7] px-2 py-3 text-right font-['Inter'] text-[14px] tabular-nums leading-5 transition-colors duration-75 sm:px-4",
        projected ? "bg-neutral-50 group-hover:bg-neutral-100" : "bg-white group-hover:bg-neutral-50",
        growth && cn("font-medium", toneClass(tone)),
        !growth &&
          valueStyle === "revenue" &&
          "font-semibold text-[#09090B]",
        !growth && valueStyle === "default" && "font-normal text-[#09090B]",
      )}
    >
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
}

/**
 * Annual revenue / EPS summary — same `annual` points as the Estimates chart (last {@link MAX_ANNUAL_COLUMNS}
 * fiscal years). Styling matches screener tables: horizontal rules only, `px-2 sm:px-4`, right-aligned figures.
 */
export function EarningsAnnualSummaryTable({ annual }: { annual: StockEarningsEstimatesPoint[] }) {
  const cols = useMemo(() => {
    const sorted = [...annual].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    if (sorted.length <= MAX_ANNUAL_COLUMNS) return sorted;
    return sorted.slice(-MAX_ANNUAL_COLUMNS);
  }, [annual]);

  /** Wide enough min per year column so `+215.94%` / `130.00B` are not clipped; parent scrolls horizontally. */
  const gridTemplateColumns = useMemo(
    () => `minmax(11rem,1.1fr) repeat(${cols.length}, minmax(5.75rem,1fr))`,
    [cols.length],
  );

  const tableMinWidthPx = useMemo(() => 200 + cols.length * 92, [cols.length]);

  const colProjected = useMemo(() => cols.map((p) => p.revenueActualUsd == null), [cols]);

  const revenueVals = useMemo(() => cols.map(displayRevenueUsd), [cols]);
  const revGrowth = useMemo(
    () => cols.map((_, i) => (i === 0 ? null : pctChange(revenueVals[i]!, revenueVals[i - 1]!))),
    [cols, revenueVals],
  );
  const epsVals = useMemo(() => cols.map(displayEps), [cols]);
  const epsGrowth = useMemo(
    () => cols.map((_, i) => (i === 0 ? null : pctChange(epsVals[i]!, epsVals[i - 1]!))),
    [cols, epsVals],
  );

  if (cols.length === 0) return null;

  return (
    <div className="min-w-0">
      <ScreenerTableScroll
        minWidthClassName="min-w-0"
        /** Omit outer bottom border — last row already has `border-b`; avoids a double rule above Reports. */
        className="border-b-0 sm:border-b-0"
      >
        <div className="min-w-full bg-white" style={{ minWidth: `${tableMinWidthPx}px` }}>
          <div className="grid w-full" style={{ gridTemplateColumns }}>
            <div className={headerCornerClass}>
              <span className="sr-only">Metric</span>
            </div>
            {cols.map((p, i) => (
              <div
                key={p.sortKey}
                className={cn(headerYearCellClass, colProjected[i] ? "bg-neutral-50" : "bg-white")}
              >
                <span className="whitespace-nowrap">{p.label}</span>
              </div>
            ))}
          </div>

          <div className="group grid w-full" style={{ gridTemplateColumns }}>
            <div className={labelPrimaryClass}>Revenue</div>
            {revenueVals.map((v, i) => (
              <DataCell key={`r-${cols[i]!.sortKey}`} projected={colProjected[i]!} valueStyle="revenue">
                {v != null ? formatUsdBillionsOrMillions(v) : <span className="font-normal text-[#71717A]">-</span>}
              </DataCell>
            ))}
          </div>

          <div className="group grid w-full" style={{ gridTemplateColumns }}>
            <div className={labelMutedClass}>Revenue growth</div>
            {revGrowth.map((pct, i) => {
              const tone = growthTone(pct);
              const missing = pct == null || !Number.isFinite(pct);
              return (
                <DataCell
                  key={`rg-${cols[i]!.sortKey}`}
                  projected={colProjected[i]!}
                  tone={tone}
                  growth={!missing}
                >
                  {missing ? (
                    <span className="font-medium text-[#71717A]">-</span>
                  ) : (
                    `${pct > 0 ? "+" : ""}${pct2.format(pct)}%`
                  )}
                </DataCell>
              );
            })}
          </div>

          <div className="group grid w-full" style={{ gridTemplateColumns }}>
            <div className={labelPrimaryClass}>Earnings</div>
            {epsVals.map((v, i) => (
              <DataCell key={`e-${cols[i]!.sortKey}`} projected={colProjected[i]!}>
                {v != null ? (
                  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                ) : (
                  <span className="text-[#71717A]">-</span>
                )}
              </DataCell>
            ))}
          </div>

          <div className="group grid w-full" style={{ gridTemplateColumns }}>
            <div className={labelMutedClass}>Earnings growth</div>
            {epsGrowth.map((pct, i) => {
              const tone = growthTone(pct);
              const missing = pct == null || !Number.isFinite(pct);
              return (
                <DataCell
                  key={`eg-${cols[i]!.sortKey}`}
                  projected={colProjected[i]!}
                  tone={tone}
                  growth={!missing}
                >
                  {missing ? (
                    <span className="font-medium text-[#71717A]">-</span>
                  ) : (
                    `${pct > 0 ? "+" : ""}${pct2.format(pct)}%`
                  )}
                </DataCell>
              );
            })}
          </div>
        </div>
      </ScreenerTableScroll>
    </div>
  );
}
