"use client";

import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const KEY_STATS_TAB_MOTION_MS = 280;
const KEY_STATS_TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

type KeyStatsTabId =
  | "basic"
  | "revenue_profit"
  | "valuation"
  | "margins"
  | "growth"
  | "assets_liabilities"
  | "returns"
  | "dividends"
  | "risk";

const KEY_STATS_TABS: { id: KeyStatsTabId; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "revenue_profit", label: "Revenue & Profit" },
  { id: "valuation", label: "Valuation" },
  { id: "margins", label: "Margins" },
  { id: "growth", label: "Growth" },
  { id: "assets_liabilities", label: "Assets & Liabilities" },
  { id: "returns", label: "Returns" },
  { id: "dividends", label: "Dividends" },
  { id: "risk", label: "Risk" },
];

function KeyStatsSectionTabNav({
  activeTab,
  onTabChange,
}: {
  activeTab: KeyStatsTabId;
  onTabChange: (tab: KeyStatsTabId) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<KeyStatsTabId, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const btn = tabRefs.current.get(activeTab);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - navRect.left + nav.scrollLeft;
    const width = btnRect.width;
    setIndicator((prev) => {
      if (Math.abs(prev.left - left) < 0.5 && Math.abs(prev.width - width) < 0.5) return prev;
      return { left, width };
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    measureIndicator();
  }, [measureIndicator, activeTab]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(nav);
    nav.addEventListener("scroll", measureIndicator, { passive: true });
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      nav.removeEventListener("scroll", measureIndicator);
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  return (
    <div className="-mx-1 mb-4 border-b border-solid border-[#E4E4E7]">
      <nav
        ref={navRef}
        className="relative flex flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden pb-px [-webkit-overflow-scrolling:touch] max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
        aria-label="Key stats sections"
      >
        {KEY_STATS_TABS.map(({ id, label }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) tabRefs.current.set(id, el);
                else tabRefs.current.delete(id);
              }}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                "-mb-px shrink-0 cursor-pointer border-b-2 border-solid border-transparent py-2 text-left text-[14px] font-medium leading-6 text-[#09090B] transition-[color,opacity] duration-100",
                "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
                "hover:opacity-80",
                isActive ? "font-semibold opacity-100" : "opacity-70",
              )}
            >
              {label}
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-[#09090B] motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            transitionProperty: "left, width",
            transitionDuration: `${KEY_STATS_TAB_MOTION_MS}ms`,
            transitionTimingFunction: KEY_STATS_TAB_MOTION_EASE,
          }}
          aria-hidden
        />
      </nav>
    </div>
  );
}

type Row = { label: string; value: string };

const ASSETS_LABELS = [
  "Total Assets",
  "Cash on Hand",
  "Long Term Debt",
  "Total Liabilities",
  "Share Holder Equity",
  "Debt/Equity",
];

const ASSETS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Total Assets": "total_assets",
  "Cash on Hand": "cash_on_hand",
  "Long Term Debt": "long_term_debt",
  "Total Liabilities": "total_liabilities",
  "Share Holder Equity": "shareholder_equity",
  "Debt/Equity": "debt_to_equity",
};

const RETURNS_LABELS = [
  "Return on Equity (ROE)",
  "Return on Assets (ROA)",
  "Return on Capital Employed (ROCE)",
  "Return on Investments (ROI)",
];

const RETURNS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Return on Equity (ROE)": "return_on_equity",
  "Return on Assets (ROA)": "return_on_assets",
  "Return on Capital Employed (ROCE)": "return_on_capital_employed",
  "Return on Investments (ROI)": "return_on_investment",
};

const MARGINS_LABELS = [
  "Gross Margin",
  "Operating Margin",
  "EBITDA Margin",
  "Pre-Tax Margin",
  "Net Margin",
  "Free Cash Flow",
];

const GROWTH_LABELS = [
  "Quarterly Revenue (YoY)",
  "Revenue (3Y)",
  "Quarterly EPS (YoY)",
  "EPS (3Y)",
];

const GROWTH_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Quarterly Revenue (YoY)": "revenue_yoy",
  "Revenue (3Y)": "revenue_3y_cagr",
  "Quarterly EPS (YoY)": "eps_yoy",
  "EPS (3Y)": "eps_3y_cagr",
};

const VALUATION_LABELS = [
  "P/E Ratio",
  "Trailing P/E",
  "Forward P/E",
  "P/S Ratio",
  "Price/Book Ratio",
  "Price/FCF Ratio",
  "EV/EBITDA",
  "EV/Sales",
  "Cash/Debt",
];

const VALUATION_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "P/E Ratio": "pe_ratio",
  "Trailing P/E": "trailing_pe",
  "Forward P/E": "forward_pe",
  "P/S Ratio": "ps_ratio",
  "Price/Book Ratio": "price_book",
  "Price/FCF Ratio": "price_fcf",
  "EV/EBITDA": "ev_ebitda",
  "EV/Sales": "ev_sales",
  "Cash/Debt": "cash_debt",
};

const DIVIDENDS_LABELS = ["Yield", "Payout"];

const DIVIDENDS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Yield: "dividend_yield",
  Payout: "payout_ratio",
};

const RISK_LABELS = ["Beta (5Y)", "Max Drawdown (5Y)"];

const REVENUE_PROFIT_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Revenue: "revenue",
  "Gross Profit": "gross_profit",
  "Operating Income": "operating_income",
  "Net Income": "net_income",
  EBITDA: "ebitda",
  EPS: "eps",
  /** Dollar FCF — see `eodhd-key-stats-revenue-profit` (Margins card uses “Free Cash Flow” for margin %). */
  FCF: "free_cash_flow",
};

/** Key Stats "Margins" row labels → fundamentals chart metric (FCF row is margin %, not cash dollars). */
const MARGINS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Gross Margin": "gross_margin",
  "Operating Margin": "operating_margin",
  "EBITDA Margin": "ebitda_margin",
  "Pre-Tax Margin": "pre_tax_margin",
  "Net Margin": "net_margin",
  "Free Cash Flow": "fcf_margin",
};

const BASIC_FALLBACK: Row[] = [
  { label: "Market Cap", value: "—" },
  { label: "Enterprise Value", value: "—" },
  { label: "Shares Outstanding", value: "—" },
  { label: "1Y Target Est", value: "—" },
  { label: "Analyst Consensus", value: "—" },
  { label: "Earnings Date", value: "—" },
  { label: "Beta (5Y Monthly)", value: "—" },
  { label: "Employees", value: "—" },
];

/** Basic rows that open the same fundamentals chart modal as Revenue & Profit. */
const BASIC_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Market Cap": "market_cap",
  "Enterprise Value": "enterprise_value",
  "Shares Outstanding": "shares_outstanding",
};

function KeyStatMetricRow({
  label,
  value,
  labelToMetric,
  onMetricClick,
}: {
  label: string;
  value: string;
  labelToMetric: Partial<Record<string, ChartingMetricId>>;
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const metricId = labelToMetric[label];
  const interactive = typeof onMetricClick === "function" && metricId != null;
  if (!interactive) {
    return <StatRow label={label} value={value} />;
  }
  return (
    <button
      type="button"
      onClick={() => metricId && onMetricClick?.(metricId)}
      className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 text-left last:border-0 hover:bg-[#FAFAFA]"
    >
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#09090B] decoration-transparent underline-offset-2 hover:underline hover:decoration-[#71717A]">
        {label}
      </span>
      <span className="shrink-0 text-right text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#09090B]">{label}</span>
      <span className="shrink-0 text-right text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
    </div>
  );
}

function CardSkeleton({ rowLabels }: { rowLabels: string[] }) {
  return (
    <div className="space-y-2 pt-0.5" aria-hidden>
      {rowLabels.map((label) => (
        <div key={label} className="flex justify-between gap-3 border-b border-[#E4E4E7] py-1.5 last:border-0">
          <div className="h-4 w-28 rounded bg-neutral-100" />
          <div className="h-4 w-20 rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

const DynamicCard = memo(function DynamicCard({
  title,
  rowLabels,
  rows,
  loading,
  labelToMetric,
  onMetricClick,
  hideTitle = false,
}: {
  title: string;
  rowLabels: string[];
  rows: Row[] | null;
  loading: boolean;
  /** When set with `onMetricClick`, matching rows open the fundamentals chart modal (label + value clickable). */
  labelToMetric?: Partial<Record<string, ChartingMetricId>>;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  /** Mobile tab layout supplies the section title in the tab bar. */
  hideTitle?: boolean;
}) {
  const fallback = useMemo(() => rowLabels.map((label) => ({ label, value: "—" as const })), [rowLabels]);
  const displayRows = rows ?? fallback;
  const map = labelToMetric ?? null;
  const clickable = map != null && typeof onMetricClick === "function";

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4 max-md:mb-0">
      {hideTitle ? null : (
        <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">{title}</h3>
      )}
      {loading ? (
        <CardSkeleton rowLabels={rowLabels} />
      ) : clickable ? (
        displayRows.map((row) => (
          <KeyStatMetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            labelToMetric={map}
            onMetricClick={onMetricClick}
          />
        ))
      ) : (
        displayRows.map((row) => <StatRow key={row.label} label={row.label} value={row.value} />)
      )}
    </div>
  );
});

const BasicCard = memo(function BasicCard({
  rows,
  loading,
  onMetricClick,
  hideTitle = false,
}: {
  rows: Row[] | null;
  loading: boolean;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  hideTitle?: boolean;
}) {
  const displayRows = rows ?? BASIC_FALLBACK;
  const clickable = typeof onMetricClick === "function";

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4 max-md:mb-0">
      {hideTitle ? null : (
        <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Basic</h3>
      )}
      {loading ? (
        <CardSkeleton rowLabels={displayRows.map((r) => r.label)} />
      ) : clickable ? (
        displayRows.map((row) => (
          <KeyStatMetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            labelToMetric={BASIC_LABEL_TO_METRIC}
            onMetricClick={onMetricClick}
          />
        ))
      ) : (
        displayRows.map((row) => <StatRow key={row.label} label={row.label} value={row.value} />)
      )}
    </div>
  );
});

const RevenueProfitCard = memo(function RevenueProfitCard({
  rows,
  loading,
  onMetricClick,
  hideTitle = false,
}: {
  rows: Row[] | null;
  loading: boolean;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  hideTitle?: boolean;
}) {
  const placeholder = useMemo(
    () =>
      [
        { label: "Revenue", value: "—" },
        { label: "Gross Profit", value: "—" },
        { label: "Operating Income", value: "—" },
        { label: "Net Income", value: "—" },
        { label: "EBITDA", value: "—" },
        { label: "EPS", value: "—" },
        { label: "FCF", value: "—" },
      ] satisfies Row[],
    [],
  );
  const displayRows = rows ?? placeholder;

  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4 max-md:mb-0">
      {hideTitle ? null : (
        <h3 className="mb-2 text-[14px] font-semibold leading-5 text-[#09090B]">Revenue &amp; Profit</h3>
      )}
      {loading ? (
        <CardSkeleton rowLabels={displayRows.map((r) => r.label)} />
      ) : (
        displayRows.map((row) => (
          <KeyStatMetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            labelToMetric={REVENUE_PROFIT_LABEL_TO_METRIC}
            onMetricClick={onMetricClick}
          />
        ))
      )}
    </div>
  );
});

function KeyStatsInner({
  ticker,
  initialBundle,
  onOpenMetricChart,
}: {
  ticker: string;
  initialBundle?: StockKeyStatsBundle | null;
  /** Dividends (Yield / Payout) and all other listed Key Stats rows with a charting metric open the fundamentals modal. Risk rows have no fiscal series. */
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
}) {
  const [loading, setLoading] = useState(() => !initialBundle);
  const [bundle, setBundle] = useState<StockKeyStatsBundle | null>(() => initialBundle ?? null);
  const [mobileTab, setMobileTab] = useState<KeyStatsTabId>("basic");

  const mobileCard = useMemo(() => {
    const hideTitle = true;
    switch (mobileTab) {
      case "basic":
        return <BasicCard rows={bundle?.basic ?? null} loading={loading} onMetricClick={onOpenMetricChart} hideTitle={hideTitle} />;
      case "revenue_profit":
        return (
          <RevenueProfitCard
            rows={bundle?.revenueProfit ?? null}
            loading={loading}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "valuation":
        return (
          <DynamicCard
            title="Valuation"
            rowLabels={VALUATION_LABELS}
            rows={bundle?.valuation ?? null}
            loading={loading}
            labelToMetric={VALUATION_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "margins":
        return (
          <DynamicCard
            title="Margins"
            rowLabels={MARGINS_LABELS}
            rows={bundle?.margins ?? null}
            loading={loading}
            labelToMetric={MARGINS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "growth":
        return (
          <DynamicCard
            title="Growth"
            rowLabels={GROWTH_LABELS}
            rows={bundle?.growth ?? null}
            loading={loading}
            labelToMetric={GROWTH_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "assets_liabilities":
        return (
          <DynamicCard
            title="Assets & Liabilities"
            rowLabels={ASSETS_LABELS}
            rows={bundle?.assetsLiabilities ?? null}
            loading={loading}
            labelToMetric={ASSETS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "returns":
        return (
          <DynamicCard
            title="Returns"
            rowLabels={RETURNS_LABELS}
            rows={bundle?.returns ?? null}
            loading={loading}
            labelToMetric={RETURNS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "dividends":
        return (
          <DynamicCard
            title="Dividends"
            rowLabels={DIVIDENDS_LABELS}
            rows={bundle?.dividends ?? null}
            loading={loading}
            labelToMetric={DIVIDENDS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
          />
        );
      case "risk":
        return (
          <DynamicCard title="Risk" rowLabels={RISK_LABELS} rows={bundle?.risk ?? null} loading={loading} hideTitle={hideTitle} />
        );
      default:
        return null;
    }
  }, [bundle, loading, mobileTab, onOpenMetricChart]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initialBundle) setBundle(initialBundle);
      if (!initialBundle) setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/key-stats-bundle?refresh=1`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { bundle?: StockKeyStatsBundle | null };
        if (!cancelled) setBundle(json.bundle ?? null);
      } catch {
        /* keep SSR / prior bundle */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, initialBundle]);

  return (
    <div>
      <div className="md:hidden">
        <KeyStatsSectionTabNav activeTab={mobileTab} onTabChange={setMobileTab} />
        {mobileCard}
      </div>

      <h2 className="mb-4 hidden text-[18px] font-semibold leading-7 text-[#09090B] md:block">Key Stats</h2>
      <div className="hidden grid-cols-2 gap-5 md:grid md:grid-cols-3">
        <div>
          <BasicCard rows={bundle?.basic ?? null} loading={loading} onMetricClick={onOpenMetricChart} />
          <DynamicCard
            title="Valuation"
            rowLabels={VALUATION_LABELS}
            rows={bundle?.valuation ?? null}
            loading={loading}
            labelToMetric={VALUATION_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
        </div>

        <div>
          <RevenueProfitCard
            rows={bundle?.revenueProfit ?? null}
            loading={loading}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Margins"
            rowLabels={MARGINS_LABELS}
            rows={bundle?.margins ?? null}
            loading={loading}
            labelToMetric={MARGINS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Growth"
            rowLabels={GROWTH_LABELS}
            rows={bundle?.growth ?? null}
            loading={loading}
            labelToMetric={GROWTH_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
        </div>

        <div className="max-md:col-span-2">
          <DynamicCard
            title="Assets & Liabilities"
            rowLabels={ASSETS_LABELS}
            rows={bundle?.assetsLiabilities ?? null}
            loading={loading}
            labelToMetric={ASSETS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Returns"
            rowLabels={RETURNS_LABELS}
            rows={bundle?.returns ?? null}
            loading={loading}
            labelToMetric={RETURNS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard
            title="Dividends"
            rowLabels={DIVIDENDS_LABELS}
            rows={bundle?.dividends ?? null}
            loading={loading}
            labelToMetric={DIVIDENDS_LABEL_TO_METRIC}
            onMetricClick={onOpenMetricChart}
          />
          <DynamicCard title="Risk" rowLabels={RISK_LABELS} rows={bundle?.risk ?? null} loading={loading} />
        </div>
      </div>
    </div>
  );
}


export const KeyStats = memo(KeyStatsInner);
