"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";

import { TabSwitcher } from "@/components/design-system";
import { ScreenerRankBadge } from "@/components/earnings/screener-rank-badge";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  MultichartFundamentalsBar,
  MULTICHART_MAX_ANNUAL_BARS,
  MULTICHART_MAX_QUARTERLY_BARS,
  sliceLastAnnualWithMetric,
  type MultichartVisual,
} from "@/components/stock/multichart-fundamentals-bar";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import {
  CHARTING_METRIC_LABEL,
  chartingMetricToParam,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

function maxBarsForMode(mode: FundamentalsSeriesMode): number {
  return mode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS;
}

function pickSeedForMode(
  mode: FundamentalsSeriesMode,
  initialAnnualPoints?: ChartingSeriesPoint[],
  initialQuarterlyPoints?: ChartingSeriesPoint[],
): ChartingSeriesPoint[] | null {
  if (mode === "quarterly") {
    return Array.isArray(initialQuarterlyPoints) && initialQuarterlyPoints.length > 0 ? initialQuarterlyPoints : null;
  }
  return Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0 ? initialAnnualPoints : null;
}

type Props = {
  ticker: string;
  metricId: ChartingMetricId | null;
  onClose: () => void;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  headerMeta: StockDetailHeaderMeta | null;
  /** When set (e.g. from calendar), matches Earnings preview badge. */
  screenerRank?: number | null;
};

export function KeyStatsMetricChartModal({
  ticker,
  metricId,
  onClose,
  initialAnnualPoints,
  initialQuarterlyPoints,
  headerMeta,
  screenerRank = null,
}: Props) {
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");
  const [chartVisual, setChartVisual] = useState<MultichartVisual>("bar");

  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() => {
    if (metricId == null) return [];
    const seed = pickSeedForMode("annual", initialAnnualPoints, initialQuarterlyPoints);
    if (!seed) return [];
    return sliceLastAnnualWithMetric(seed, metricId, maxBarsForMode("annual")).length > 0 ? seed : [];
  });
  const [loading, setLoading] = useState(() => {
    if (metricId == null) return false;
    const seed = pickSeedForMode("annual", initialAnnualPoints, initialQuarterlyPoints);
    if (!seed) return true;
    return sliceLastAnnualWithMetric(seed, metricId, maxBarsForMode("annual")).length === 0;
  });

  useEffect(() => {
    if (metricId == null) return;
    const activeMetric: ChartingMetricId = metricId;
    let cancelled = false;
    async function load() {
      const max = maxBarsForMode(periodMode);
      const seed = pickSeedForMode(periodMode, initialAnnualPoints, initialQuarterlyPoints);
      if (seed && sliceLastAnnualWithMetric(seed, activeMetric, max).length > 0) {
        if (!cancelled) {
          setPoints(seed);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${
            periodMode === "quarterly" ? "quarterly" : "annual"
          }`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setPoints([]);
          return;
        }
        const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
        if (!cancelled) setPoints(Array.isArray(json.points) ? json.points : []);
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, periodMode, metricId, initialAnnualPoints, initialQuarterlyPoints]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!metricId) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [metricId, onKeyDown]);

  useEffect(() => {
    if (!metricId) return;
    setPeriodMode("annual");
    setChartVisual("bar");
  }, [metricId]);

  if (!metricId) return null;

  const maxBars = maxBarsForMode(periodMode);
  const hasSeries = sliceLastAnnualWithMetric(points, metricId, maxBars).length > 0;
  const chartingHref = `/stock/${encodeURIComponent(ticker.trim())}?tab=charting&metric=${encodeURIComponent(
    chartingMetricToParam(metricId),
  )}`;
  const metricTitle = CHARTING_METRIC_LABEL[metricId];
  const companyLine = headerMeta?.fullName?.trim() || null;
  const logoName = companyLine ?? ticker;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-stats-metric-chart-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#E4E4E7] px-5 py-4">
          <Link
            href={chartingHref}
            onClick={() => onClose()}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-[10px] outline-none ring-offset-2 transition-colors hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
            title={`Open Charting — ${metricTitle}`}
          >
            <CompanyLogo name={logoName} logoUrl={headerMeta?.logoUrl ?? ""} symbol={ticker} size="lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B]">{ticker}</span>
                {screenerRank != null ? <ScreenerRankBadge rank={screenerRank} /> : null}
              </span>
              {companyLine ? (
                <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{companyLine}</span>
              ) : null}
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[#E4E4E7] px-5 py-3">
          <h2 id="key-stats-metric-chart-title" className="min-w-0 text-[17px] font-semibold leading-7 text-[#09090B]">
            {metricTitle}
          </h2>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <TabSwitcher
              options={PERIOD_TAB_OPTIONS}
              value={periodMode}
              onChange={setPeriodMode}
              aria-label="Reporting period"
            />
            <MultichartVisualSwitcher value={chartVisual} onChange={setChartVisual} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex h-[400px] items-center justify-center text-[14px] text-[#71717A]">Loading…</div>
          ) : !hasSeries ? (
            <p className="text-[14px] leading-6 text-[#71717A]">No data for this metric.</p>
          ) : (
            <div className="min-w-0">
              <MultichartFundamentalsBar
                metricId={metricId}
                points={points}
                height={400}
                periodMode={periodMode}
                visual={chartVisual}
              />
              {metricId === "forward_pe" ? (
                <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
                  Live forward P/E in Key Stats uses current price and consensus EPS. Historical fiscal rows
                  rarely include that forward multiple; when it is missing, the bar uses trailing P/E for the
                  same period so year-to-year comparisons stay available.
                </p>
              ) : null}
              {metricId === "pe_ratio" || metricId === "trailing_pe" ? (
                <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
                  P/E here is trailing on fiscal net income: modelled market cap (price × shares at period end) divided
                  by reported net income for the same period. It is not the live quote multiple from Highlights.
                </p>
              ) : null}
              {metricId === "ps_ratio" ||
              metricId === "price_book" ||
              metricId === "price_fcf" ||
              metricId === "cash_debt" ||
              metricId === "enterprise_value" ||
              metricId === "ev_ebitda" ||
              metricId === "ev_sales" ? (
                <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
                  Multiples use the same modelled market cap (EOD adjusted close × diluted shares at fiscal period
                  end) and statement lines for that period. Enterprise value is market cap plus total debt minus cash;
                  EV/EBITDA and EV/Sales use that EV with reported EBITDA and revenue. Cash/Debt uses balance-sheet cash
                  and debt on the same fiscal periods. They are not live quote ratios from Highlights.
                </p>
              ) : null}
              {metricId === "free_cash_flow" ? (
                <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
                  Dollar free cash flow is from the merged cash-flow statement by fiscal period (not the Margins card
                  FCF % of revenue).
                </p>
              ) : null}
              {metricId === "dividend_yield" || metricId === "payout_ratio" ? (
                <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
                  Dividend yield and payout are computed from fiscal cash flow and net income on merged statements
                  (same periods as other fundamentals charts), not a live forward yield from Highlights.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
