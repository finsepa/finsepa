"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, X } from "lucide-react";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import { CompanyLogo } from "@/components/screener/company-logo";
import { cn } from "@/lib/utils";
import { findKeyStatValue } from "@/lib/comparison/comparison-key-stats";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import {
  CHARTING_MAX_COMPARE_TICKERS,
  buildStandaloneChartPath,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";

/** Client-only chart avoids SSR/client HTML drift (e.g. after HMR). */
const ComparisonReturnChart = dynamic(
  () => import("@/components/comparison/comparison-return-chart").then((m) => m.ComparisonReturnChart),
  {
    ssr: false,
    loading: () => <ComparisonReturnChartSkeleton />,
  },
);

function ComparisonReturnChartSkeleton() {
  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden bg-white p-5" aria-hidden>
      <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Return</h3>
      <div className="mt-4">
        <div className="h-[320px] w-full min-h-[320px] rounded-md bg-[#F4F4F5]" />
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
          <div className="h-4 w-16 rounded bg-[#F4F4F5]" />
          <div className="h-4 w-16 rounded bg-[#F4F4F5]" />
        </div>
      </div>
    </section>
  );
}

const SERIES_COLORS = [
  "#2563EB",
  "#EA580C",
  "#16A34A",
  "#9333EA",
  "#0891B2",
  "#DC2626",
  "#CA8A04",
  "#7C3AED",
] as const;

const RETURN_WINDOWS = [
  { key: "ytd" as const, label: "YTD" },
  { key: "y1" as const, label: "1Y" },
  { key: "y5" as const, label: "5Y" },
  { key: "y10" as const, label: "10Y" },
  { key: "all" as const, label: "Max" },
] as const;

const TOP_FUNDAMENTAL_COLUMNS: { header: string; labels: string[] }[] = [
  { header: "Rev Growth", labels: ["Quarterly Revenue (YoY)", "Revenue (3Y)"] },
  { header: "Gross Profit", labels: ["Gross Profit"] },
  { header: "Oper Income", labels: ["Operating Income"] },
  { header: "Net Income", labels: ["Net Income"] },
  { header: "EPS", labels: ["EPS"] },
  { header: "EPS Growth", labels: ["Quarterly EPS (YoY)", "EPS (3Y)"] },
  { header: "Revenue", labels: ["Revenue"] },
];

function perfCellClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-[#71717A]";
  return v >= 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function formatPerfCell(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

/** Matches `screener-table` column rhythm: `gap-x-2`, `px-4`, horizontal rules via `divide-y`. */
function comparisonFundamentalGridColumns(): string {
  return `minmax(220px,1.4fr) repeat(${TOP_FUNDAMENTAL_COLUMNS.length}, minmax(88px, 1fr))`;
}

function comparisonPerformanceGridColumns(): string {
  return `minmax(220px,1.4fr) repeat(${RETURN_WINDOWS.length}, minmax(72px, 1fr))`;
}

/** Pill bar + logo + name — aligned with charting compare “Data” column (`charting-compare-workspace`). */
function ComparisonCompanyBlock({
  displayName,
  ticker,
  logoUrl,
  seriesColor,
}: {
  displayName: string;
  ticker: string;
  logoUrl: string;
  seriesColor: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-start gap-2 pr-4 text-left">
      <span
        className="h-4 w-1 shrink-0 self-center rounded-full"
        style={{ backgroundColor: seriesColor }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={ticker} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{displayName}</div>
          <div className="text-[12px] font-normal leading-4 text-[#71717A]">{ticker}</div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  tickers: string[];
  initialByTicker: Record<string, StockPageInitialData>;
  allowedChartingTickers: string[];
};

export function ComparisonWorkspace({ tickers, initialByTicker, allowedChartingTickers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chartingAllowSet = useMemo(
    () => new Set(allowedChartingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
    [allowedChartingTickers],
  );

  const tickersFromUrl = useMemo(() => {
    const raw = searchParams.get("ticker")?.trim() ?? "";
    const parsed = parseChartingTickerList(raw || null);
    return parsed.filter((t) => {
      if (isSingleAssetMode()) return isSupportedAsset(t);
      return chartingAllowSet.has(t.trim().toUpperCase());
    });
  }, [searchParams, chartingAllowSet]);

  const displayTickers = tickersFromUrl.length > 0 ? tickersFromUrl : tickers;

  const pushUrl = useCallback(
    (next: string[]) => {
      router.replace(buildStandaloneChartPath("/comparison", next, []), { scroll: false });
    },
    [router],
  );

  const removeTicker = useCallback(
    (sym: string) => {
      pushUrl(displayTickers.filter((t) => t !== sym));
    },
    [displayTickers, pushUrl],
  );

  const clearAllTickers = useCallback(() => {
    pushUrl([]);
  }, [pushUrl]);

  const atCap = displayTickers.length >= CHARTING_MAX_COMPARE_TICKERS;

  const rows = useMemo(() => {
    return displayTickers.map((t, idx) => {
      const init = initialByTicker[t];
      const meta: StockDetailHeaderMeta | null = init?.headerMeta ?? null;
      const bundle = init?.keyStatsBundle ?? null;
      const perf = init?.performance ?? null;
      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
      const fundamentals = TOP_FUNDAMENTAL_COLUMNS.map((col) => findKeyStatValue(bundle, col.labels));
      const returns = RETURN_WINDOWS.map((w) => perf?.[w.key] ?? null);
      return { t, meta, bundle, perf, color, fundamentals, returns };
    });
  }, [displayTickers, initialByTicker]);

  const performances = useMemo(() => {
    const o: Record<string, StockPerformance | null> = {};
    for (const r of rows) {
      o[r.t] = r.perf ?? null;
    }
    return o;
  }, [rows]);

  return (
    <div className="relative space-y-6">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <h1 className="min-w-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">Comparison</h1>
        <button
          type="button"
          onClick={clearAllTickers}
          disabled={displayTickers.length === 0}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
            displayTickers.length === 0
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-neutral-50",
          )}
          aria-label="Remove all companies and reset comparison"
          title="Remove all companies"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {displayTickers.map((sym) => (
          <div
            key={sym}
            className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          >
            <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
              <span className="truncate">{sym}</span>
            </span>
            <button
              type="button"
              onClick={() => removeTicker(sym)}
              className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
              aria-label={`Remove ${sym}`}
            >
              <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ))}
        <ChartingCompanyAddDropdown
          onPickStock={(sym) => {
            const u = sym.trim().toUpperCase();
            if (displayTickers.includes(u)) return;
            if (atCap) return;
            pushUrl([...displayTickers, u]);
          }}
          disabled={atCap}
          maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - displayTickers.length)}
          excludeSymbols={displayTickers}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div
            className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white"
            style={{ minWidth: "900px" }}
          >
            <div
              className="grid min-h-[44px] items-center gap-x-2 bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]"
              style={{ gridTemplateColumns: comparisonFundamentalGridColumns() }}
            >
              <div className="text-left">Company</div>
              {TOP_FUNDAMENTAL_COLUMNS.map((c) => (
                <div key={c.header} className="min-w-0 w-full text-right">
                  {c.header}
                </div>
              ))}
            </div>
            {rows.map((r) => {
              const displayName = r.meta?.fullName?.trim() || r.t;
              return (
                <Link
                  key={r.t}
                  href={`/stock/${encodeURIComponent(r.t)}`}
                  prefetch={false}
                  aria-label={`Open ${displayName} (${r.t})`}
                  className="grid h-[60px] max-h-[60px] cursor-pointer items-center gap-x-2 bg-white px-4 no-underline transition-colors duration-75 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#09090B]/15"
                  style={{ gridTemplateColumns: comparisonFundamentalGridColumns() }}
                >
                  <ComparisonCompanyBlock
                    displayName={displayName}
                    ticker={r.t}
                    logoUrl={r.meta?.logoUrl?.trim() || ""}
                    seriesColor={r.color}
                  />
                  {r.fundamentals.map((cell, i) => (
                    <div
                      key={TOP_FUNDAMENTAL_COLUMNS[i]!.header}
                      className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]"
                    >
                      {cell === "—" ? "-" : cell}
                    </div>
                  ))}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <ComparisonReturnChart
        tickers={displayTickers}
        performances={performances}
        colors={displayTickers.map((_, i) => SERIES_COLORS[i % SERIES_COLORS.length]!)}
      />

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div
            className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white"
            style={{ minWidth: "720px" }}
          >
            <div
              className="grid min-h-[44px] items-center gap-x-2 bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]"
              style={{ gridTemplateColumns: comparisonPerformanceGridColumns() }}
            >
              <div className="text-left">Company</div>
              {RETURN_WINDOWS.map((w) => (
                <div key={w.key} className="min-w-0 w-full text-right">
                  {w.label}
                </div>
              ))}
            </div>
            {rows.map((r) => {
              const displayName = r.meta?.fullName?.trim() || r.t;
              return (
                <Link
                  key={r.t}
                  href={`/stock/${encodeURIComponent(r.t)}`}
                  prefetch={false}
                  aria-label={`Open ${displayName} (${r.t})`}
                  className="grid h-[60px] max-h-[60px] cursor-pointer items-center gap-x-2 bg-white px-4 no-underline transition-colors duration-75 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#09090B]/15"
                  style={{ gridTemplateColumns: comparisonPerformanceGridColumns() }}
                >
                  <ComparisonCompanyBlock
                    displayName={displayName}
                    ticker={r.t}
                    logoUrl={r.meta?.logoUrl?.trim() || ""}
                    seriesColor={r.color}
                  />
                  {r.returns.map((v, i) => (
                    <div
                      key={RETURN_WINDOWS[i]!.key}
                      className={cn(
                        "min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 tabular-nums font-medium",
                        perfCellClass(v),
                      )}
                    >
                      {formatPerfCell(v)}
                    </div>
                  ))}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
