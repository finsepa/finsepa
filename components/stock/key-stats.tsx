"use client";

import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import {
  stockKeyStatsBundleHasContent,
  type StockKeyStatsBundle,
} from "@/lib/market/stock-key-stats-bundle-types";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "@/lib/icons";

import { cn } from "@/lib/utils";
import {
  MOBILE_INSET_CARD_CLASS,
  STOCK_OVERVIEW_SECTION_TITLE_CLASS,
} from "@/components/design-system/card-surface-styles";
import { consensusLabelTextClass } from "@/lib/market/analyst-consensus-tone";

const KEY_STATS_TAB_MOTION_MS = 280;
const KEY_STATS_TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/** Mobile matches screener home table card — 16px radius, stacked shadow, no outer border. */
const KEY_STATS_CARD_CLASS = cn("min-w-0 p-4", MOBILE_INSET_CARD_CLASS);

/** Mobile shell: tabs + body share one inset card (tabs bleed edge-to-edge). */
const KEY_STATS_MOBILE_SHELL_CLASS = cn(
  "mb-5 overflow-hidden p-0 max-md:mb-0",
  MOBILE_INSET_CARD_CLASS,
);

/** 4px dash / 4px gap (CSS `border-dashed` at 1px looks solid) — #E4E4E7 at 100%. */
const KEY_STATS_ROW_BORDER_CLASS =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:[background-image:repeating-linear-gradient(90deg,#E4E4E7_0,#E4E4E7_4px,transparent_4px,transparent_8px)] last:after:hidden";
/** Mobile keeps the taller row; web reverts to the original compact height (matches crypto key stats). */
const KEY_STATS_ROW_PY_CLASS = "py-2.5 md:py-1.5";

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
  embedded = false,
}: {
  activeTab: KeyStatsTabId;
  onTabChange: (tab: KeyStatsTabId) => void;
  /** Inside the mobile Key Stats card — full-width border, horizontal inset on tab row only. */
  embedded?: boolean;
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
    <div className={cn("w-full border-b border-solid border-[#E4E4E7]", embedded ? "mb-0" : "mb-4")}>
      <nav
        ref={navRef}
        className={cn(
          "relative flex w-full flex-nowrap items-start gap-4 overflow-x-auto overflow-y-hidden pb-px [-webkit-overflow-scrolling:touch] max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
          embedded ? "px-4" : undefined,
        )}
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
                "-mb-px shrink-0 cursor-pointer border-b-2 border-solid border-transparent py-2 text-left text-[14px] font-medium leading-6 text-[#0F0F0F] transition-[color,opacity] duration-100",
                "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2",
                "hover:opacity-80",
                isActive ? "font-semibold opacity-100" : "opacity-70",
              )}
            >
              {label}
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-[#0F0F0F] motion-reduce:transition-none"
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
  "Cash Conversion",
];

const RETURNS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Return on Equity (ROE)": "return_on_equity",
  "Return on Assets (ROA)": "return_on_assets",
  "Return on Capital Employed (ROCE)": "return_on_capital_employed",
  "Return on Investments (ROI)": "return_on_investment",
  "Cash Conversion": "cash_conversion",
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

const DIVIDENDS_LABELS = ["Yield", "Payout", "Buybacks"];

const DIVIDENDS_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  Yield: "dividend_yield",
  Payout: "payout_ratio",
  Buybacks: "buyback_yield",
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
  { label: "Employees", value: "—" },
];

/** Basic rows that open the same fundamentals chart modal as Revenue & Profit. */
const BASIC_LABEL_TO_METRIC: Partial<Record<string, ChartingMetricId>> = {
  "Market Cap": "market_cap",
  "Enterprise Value": "enterprise_value",
  "Shares Outstanding": "shares_outstanding",
};

function basicRowValueClass(label: string, value: string): string | undefined {
  if (label !== "Analyst Consensus" || value === "—") return undefined;
  return consensusLabelTextClass(value);
}

function BasicValueDisplay({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  const textClass = cn(
    "text-[14px] font-medium leading-5 tabular-nums",
    valueClassName ?? "text-[#0F0F0F]",
  );

  if (label === "Earnings Date" && value !== "—") {
    return (
      <span className="inline-flex shrink-0 items-center justify-end gap-1.5 text-right">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#71717A]" strokeWidth={2} aria-hidden />
        <span className={textClass}>{value}</span>
      </span>
    );
  }

  return <span className={cn("shrink-0 text-right", textClass)}>{value}</span>;
}

function KeyStatMetricRow({
  label,
  value,
  labelToMetric,
  onMetricClick,
  onRowClick,
  valueClassName,
}: {
  label: string;
  value: string;
  labelToMetric: Partial<Record<string, ChartingMetricId>>;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  onRowClick?: () => void;
  valueClassName?: string;
}) {
  const metricId = labelToMetric[label];
  const interactive =
    typeof onRowClick === "function" || (typeof onMetricClick === "function" && metricId != null);
  if (!interactive) {
    return <StatRow label={label} value={value} valueClassName={valueClassName} />;
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (onRowClick) onRowClick();
        else if (metricId) onMetricClick?.(metricId);
      }}
      className={cn(
        "group flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 text-left last:border-0 hover:bg-[#FAFAFA]",
        KEY_STATS_ROW_PY_CLASS,
        KEY_STATS_ROW_BORDER_CLASS,
      )}
    >
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#0F0F0F] underline-offset-2 decoration-[#71717A] group-hover:underline">
        {label}
      </span>
      <BasicValueDisplay label={label} value={value} valueClassName={valueClassName} />
    </button>
  );
}

function StatRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 last:border-0", KEY_STATS_ROW_BORDER_CLASS, KEY_STATS_ROW_PY_CLASS)}>
      <span className="min-w-0 shrink text-[14px] leading-5 text-[#0F0F0F]">{label}</span>
      <BasicValueDisplay label={label} value={value} valueClassName={valueClassName} />
    </div>
  );
}

function CardSkeleton({ rowLabels }: { rowLabels: string[] }) {
  return (
    <div className="space-y-2 pt-0.5" aria-hidden>
      {rowLabels.map((label) => (
        <div key={label} className={cn("flex justify-between gap-3 last:border-0", KEY_STATS_ROW_BORDER_CLASS, KEY_STATS_ROW_PY_CLASS)}>
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
  onRowClick,
  hideTitle = false,
  embedded = false,
}: {
  title: string;
  rowLabels: string[];
  rows: Row[] | null;
  loading: boolean;
  /** When set with `onMetricClick`, matching rows open the fundamentals chart modal (label + value clickable). */
  labelToMetric?: Partial<Record<string, ChartingMetricId>>;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  /** Per-row click handlers (e.g. Max Drawdown opens price drawdown chart). */
  onRowClick?: Partial<Record<string, () => void>>;
  /** Mobile tab layout supplies the section title in the tab bar. */
  hideTitle?: boolean;
  embedded?: boolean;
}) {
  const fallback = useMemo(() => rowLabels.map((label) => ({ label, value: "—" as const })), [rowLabels]);
  /** Prefer `rowLabels` order so new metrics (e.g. Buybacks) still appear if a cached bundle is missing them. */
  const displayRows = useMemo(() => {
    if (!rows?.length) return fallback;
    const byLabel = new Map(rows.map((r) => [r.label, r] as const));
    return rowLabels.map((label) => byLabel.get(label) ?? { label, value: "—" as const });
  }, [rows, rowLabels, fallback]);
  const map = labelToMetric ?? {};
  const rowClickMap = onRowClick ?? {};

  return (
    <div className={embedded ? "min-w-0" : KEY_STATS_CARD_CLASS}>
      {hideTitle ? null : (
        <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>{title}</h3>
      )}
      {loading ? (
        <CardSkeleton rowLabels={rowLabels} />
      ) : (
        displayRows.map((row) => {
          const rowClick = rowClickMap[row.label];
          const metricId = map[row.label];
          const interactive =
            typeof rowClick === "function" ||
            (typeof onMetricClick === "function" && metricId != null);
          if (!interactive) {
            return <StatRow key={row.label} label={row.label} value={row.value} />;
          }
          return (
            <KeyStatMetricRow
              key={row.label}
              label={row.label}
              value={row.value}
              labelToMetric={map}
              onMetricClick={onMetricClick}
              onRowClick={rowClick}
            />
          );
        })
      )}
    </div>
  );
});

const BasicCard = memo(function BasicCard({
  rows,
  loading,
  onMetricClick,
  hideTitle = false,
  embedded = false,
}: {
  rows: Row[] | null;
  loading: boolean;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  hideTitle?: boolean;
  embedded?: boolean;
}) {
  const displayRows = rows ?? BASIC_FALLBACK;
  const clickable = typeof onMetricClick === "function";

  return (
    <div className={embedded ? "min-w-0" : KEY_STATS_CARD_CLASS}>
      {hideTitle ? null : (
        <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>Basic</h3>
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
            valueClassName={basicRowValueClass(row.label, row.value)}
          />
        ))
      ) : (
        displayRows.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={row.value}
            valueClassName={basicRowValueClass(row.label, row.value)}
          />
        ))
      )}
    </div>
  );
});

const RevenueProfitCard = memo(function RevenueProfitCard({
  rows,
  loading,
  onMetricClick,
  hideTitle = false,
  embedded = false,
}: {
  rows: Row[] | null;
  loading: boolean;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  hideTitle?: boolean;
  embedded?: boolean;
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
    <div className={embedded ? "min-w-0" : KEY_STATS_CARD_CLASS}>
      {hideTitle ? null : (
        <h3 className={cn("mb-2", STOCK_OVERVIEW_SECTION_TITLE_CLASS)}>Revenue &amp; Profit</h3>
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
  onOpenDrawdownChart,
}: {
  ticker: string;
  initialBundle?: StockKeyStatsBundle | null;
  /** Dividends (Yield / Payout) and all other listed Key Stats rows with a charting metric open the fundamentals modal. Risk rows have no fiscal series. */
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
  onOpenDrawdownChart?: () => void;
}) {
  const seededBundle = stockKeyStatsBundleHasContent(initialBundle) ? initialBundle! : null;
  const [loading, setLoading] = useState(() => !seededBundle);
  const [bundle, setBundle] = useState<StockKeyStatsBundle | null>(() => seededBundle);
  const [mobileTab, setMobileTab] = useState<KeyStatsTabId>("basic");

  const riskRowClick = useMemo(
    () =>
      typeof onOpenDrawdownChart === "function"
        ? ({ "Max Drawdown (5Y)": onOpenDrawdownChart } satisfies Partial<Record<string, () => void>>)
        : undefined,
    [onOpenDrawdownChart],
  );

  const mobileCard = useMemo(() => {
    const hideTitle = true;
    const embedded = true;
    switch (mobileTab) {
      case "basic":
        return (
          <BasicCard
            rows={bundle?.basic ?? null}
            loading={loading}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
            embedded={embedded}
          />
        );
      case "revenue_profit":
        return (
          <RevenueProfitCard
            rows={bundle?.revenueProfit ?? null}
            loading={loading}
            onMetricClick={onOpenMetricChart}
            hideTitle={hideTitle}
            embedded={embedded}
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
            embedded={embedded}
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
            embedded={embedded}
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
            embedded={embedded}
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
            embedded={embedded}
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
            embedded={embedded}
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
            embedded={embedded}
          />
        );
      case "risk":
        return (
          <DynamicCard
            title="Risk"
            rowLabels={RISK_LABELS}
            rows={bundle?.risk ?? null}
            loading={loading}
            onRowClick={riskRowClick}
            hideTitle={hideTitle}
            embedded={embedded}
          />
        );
      default:
        return null;
    }
  }, [bundle, loading, mobileTab, onOpenMetricChart, riskRowClick]);

  useEffect(() => {
    let cancelled = false;
    const initialHasContent = stockKeyStatsBundleHasContent(initialBundle);
    const initialHasBuybacks = Boolean(
      initialBundle?.dividends?.some((r) => r.label === "Buybacks"),
    );

    if (initialHasContent) {
      setBundle(initialBundle!);
      setLoading(false);
      // Stale SSR/API cache can omit newly added rows — soft-refresh once.
      if (initialHasBuybacks) return () => {
        cancelled = true;
      };
    }

    async function load() {
      if (!initialHasContent) {
        setLoading(true);
        setBundle(null);
      }
      for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
        try {
          const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/key-stats-bundle`, {
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) continue;
          const json = (await res.json()) as { bundle?: StockKeyStatsBundle | null };
          const next = json.bundle ?? null;
          if (!cancelled && stockKeyStatsBundleHasContent(next)) {
            setBundle(next);
            break;
          }
        } catch {
          /* retry once */
        }
        if (attempt === 0 && !cancelled) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, initialBundle]);

  return (
    <div>
      <div className="md:hidden">
        <div className={KEY_STATS_MOBILE_SHELL_CLASS}>
          <KeyStatsSectionTabNav activeTab={mobileTab} onTabChange={setMobileTab} embedded />
          <div className="px-4 pb-3">{mobileCard}</div>
        </div>
      </div>

      {/* 3×3 grid — row 1: Basic / Revenue & Profit / Assets & Liabilities; row 2: Valuation / Margins / Returns; row 3: Growth / Dividends / Risk. */}
      {/* Default grid stretch: shorter cards in a row extend to the tallest card's height. */}
      <div className="hidden gap-5 md:grid md:grid-cols-3">
        <BasicCard rows={bundle?.basic ?? null} loading={loading} onMetricClick={onOpenMetricChart} />
        <RevenueProfitCard
          rows={bundle?.revenueProfit ?? null}
          loading={loading}
          onMetricClick={onOpenMetricChart}
        />
        <DynamicCard
          title="Assets & Liabilities"
          rowLabels={ASSETS_LABELS}
          rows={bundle?.assetsLiabilities ?? null}
          loading={loading}
          labelToMetric={ASSETS_LABEL_TO_METRIC}
          onMetricClick={onOpenMetricChart}
        />
        <DynamicCard
          title="Valuation"
          rowLabels={VALUATION_LABELS}
          rows={bundle?.valuation ?? null}
          loading={loading}
          labelToMetric={VALUATION_LABEL_TO_METRIC}
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
          title="Returns"
          rowLabels={RETURNS_LABELS}
          rows={bundle?.returns ?? null}
          loading={loading}
          labelToMetric={RETURNS_LABEL_TO_METRIC}
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
        <DynamicCard
          title="Dividends"
          rowLabels={DIVIDENDS_LABELS}
          rows={bundle?.dividends ?? null}
          loading={loading}
          labelToMetric={DIVIDENDS_LABEL_TO_METRIC}
          onMetricClick={onOpenMetricChart}
        />
        <DynamicCard
          title="Risk"
          rowLabels={RISK_LABELS}
          rows={bundle?.risk ?? null}
          loading={loading}
          onRowClick={riskRowClick}
        />
      </div>
    </div>
  );
}


export const KeyStats = memo(KeyStatsInner);
