"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, X } from "@/lib/icons";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import {
  ComparisonFundamentalsTableSkeleton,
  ComparisonPerformanceTableSkeleton,
  ComparisonReturnChartSkeleton,
} from "@/components/comparison/comparison-skeletons";
import { CompanyLogo } from "@/components/screener/company-logo";
import { cn } from "@/lib/utils";
import { findKeyStatValue } from "@/lib/comparison/comparison-key-stats";
import {
  comparisonSliceIsReady,
  fetchComparisonTickerSlices,
  type ComparisonTickerSlice,
} from "@/lib/comparison/fetch-comparison-slices";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { ComparisonCompanyLimitModal } from "@/components/comparison/comparison-company-limit-modal";
import {
  COMPARISON_MAX_COMPANIES,
  capComparisonTickers,
  mergeComparisonAnchorTickers,
  buildStockPeersComparePath,
  writeComparisonSessionTickers,
} from "@/lib/comparison/comparison-session";
import { buildComparisonPath, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";

/** Client-only chart avoids SSR/client HTML drift (e.g. after HMR). */
const ComparisonReturnChart = dynamic(
  () => import("@/components/comparison/comparison-return-chart").then((m) => m.ComparisonReturnChart),
  {
    ssr: false,
    loading: () => <ComparisonReturnChartSkeleton />,
  },
);

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

function isComparisonTickerAllowed(sym: string, chartingAllowSet: Set<string>): boolean {
  const t = sym.trim().toUpperCase();
  if (!t) return false;
  if (isSingleAssetMode()) return isSupportedAsset(t);
  if (chartingAllowSet.size === 0) return true;
  return chartingAllowSet.has(t);
}

export type ComparisonWorkspaceUrlMode = "standalone" | "stock-tab";

type Props = {
  tickers: string[];
  initialByTicker: Record<string, StockPageInitialData>;
  allowedChartingTickers: string[];
  /** Stock peers tab: symbol cannot be removed; reset keeps this symbol only. */
  anchorTicker?: string;
  urlMode?: ComparisonWorkspaceUrlMode;
  titleAs?: "h1" | "h2";
};

export function ComparisonWorkspace({
  tickers,
  initialByTicker,
  allowedChartingTickers,
  anchorTicker,
  urlMode = "standalone",
  titleAs = "h1",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chartingAllowSet = useMemo(
    () => new Set(allowedChartingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
    [allowedChartingTickers],
  );

  const isStockTab = urlMode === "stock-tab";
  const anchor = anchorTicker?.trim().toUpperCase() || null;

  const tickersFromUrl = useMemo(() => {
    const raw = isStockTab
      ? (searchParams.get("compare")?.trim() ?? "")
      : (searchParams.get("ticker")?.trim() ?? "");
    const parsed = parseChartingTickerList(raw || null);
    return parsed.filter((t) => isComparisonTickerAllowed(t, chartingAllowSet));
  }, [searchParams, chartingAllowSet, isStockTab]);

  const displayTickers = useMemo(() => {
    const list = tickersFromUrl.length > 0 ? tickersFromUrl : tickers;
    if (anchor) return capComparisonTickers(mergeComparisonAnchorTickers(list, anchor));
    return capComparisonTickers(list);
  }, [tickersFromUrl, tickers, anchor]);

  const [limitModalOpen, setLimitModalOpen] = useState(false);

  const [sliceByTicker, setSliceByTicker] = useState<Record<string, ComparisonTickerSlice>>(() => {
    const out: Record<string, ComparisonTickerSlice> = {};
    for (const [sym, init] of Object.entries(initialByTicker)) {
      if (!init) continue;
      out[sym] = {
        headerMeta: init.headerMeta,
        performance: init.performance,
        keyStatsBundle: init.keyStatsBundle,
      };
    }
    return out;
  });

  const [loadingTickers, setLoadingTickers] = useState<ReadonlySet<string>>(() => new Set());
  const fetchGenRef = useRef(0);
  const sliceRef = useRef(sliceByTicker);
  const fetchAttemptedRef = useRef(new Set<string>());
  sliceRef.current = sliceByTicker;

  useEffect(() => {
    const allowed = new Set(displayTickers.map((t) => t.trim().toUpperCase()).filter(Boolean));
    for (const key of [...fetchAttemptedRef.current]) {
      if (!allowed.has(key)) fetchAttemptedRef.current.delete(key);
    }
  }, [displayTickers]);

  useEffect(() => {
    if (!displayTickers.length) {
      setLoadingTickers(new Set());
      return;
    }

    const keys = displayTickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
    const toFetch = keys.filter((key) => {
      if (comparisonSliceIsReady(sliceRef.current[key])) return false;
      if (fetchAttemptedRef.current.has(key)) return false;
      return true;
    });
    if (!toFetch.length) {
      setLoadingTickers(new Set());
      return;
    }

    const gen = ++fetchGenRef.current;
    setLoadingTickers(new Set(toFetch));
    const ac = new AbortController();

    void (async () => {
      try {
        const slices = await fetchComparisonTickerSlices(toFetch, ac.signal);
        if (ac.signal.aborted || fetchGenRef.current !== gen) return;
        setSliceByTicker((prev) => ({ ...prev, ...slices }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted && fetchGenRef.current === gen) {
          for (const key of toFetch) fetchAttemptedRef.current.add(key);
          setLoadingTickers(new Set());
        }
      }
    })();

    return () => ac.abort();
  }, [displayTickers]);

  const pushUrl = useCallback(
    (next: string[]) => {
      let normalized = capComparisonTickers(
        parseChartingTickerList(
          next
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)
            .join(","),
        ),
      );
      if (anchor) normalized = capComparisonTickers(mergeComparisonAnchorTickers(normalized, anchor));
      writeComparisonSessionTickers(normalized);
      if (isStockTab && anchor) {
        router.replace(buildStockPeersComparePath(anchor, normalized), { scroll: false });
        return;
      }
      router.replace(buildComparisonPath(normalized, []), { scroll: false });
    },
    [router, anchor, isStockTab],
  );

  const removeTicker = useCallback(
    (sym: string) => {
      const u = sym.trim().toUpperCase();
      if (anchor && u === anchor) return;
      pushUrl(displayTickers.filter((t) => t.trim().toUpperCase() !== u));
    },
    [displayTickers, pushUrl, anchor],
  );

  const clearAllTickers = useCallback(() => {
    if (anchor) {
      pushUrl([anchor]);
      return;
    }
    pushUrl([]);
  }, [pushUrl, anchor]);

  const tryAddTicker = useCallback(
    (sym: string) => {
      const u = sym.trim().toUpperCase();
      if (!u || displayTickers.includes(u)) return;
      if (displayTickers.length >= COMPARISON_MAX_COMPANIES) {
        setLimitModalOpen(true);
        return;
      }
      pushUrl([...displayTickers, u]);
    },
    [displayTickers, pushUrl],
  );

  const TitleTag = titleAs;

  const rows = useMemo(() => {
    return displayTickers.map((t, idx) => {
      const key = t.trim().toUpperCase();
      const slice = sliceByTicker[key];
      const meta: StockDetailHeaderMeta | null = slice?.headerMeta ?? null;
      const bundle = slice?.keyStatsBundle ?? null;
      const perf = slice?.performance ?? null;
      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
      const fundamentals = TOP_FUNDAMENTAL_COLUMNS.map((col) => findKeyStatValue(bundle, col.labels));
      const returns = RETURN_WINDOWS.map((w) => perf?.[w.key] ?? null);
      const isLoading = loadingTickers.has(key);
      return { t: key, meta, bundle, perf, color, fundamentals, returns, isLoading };
    });
  }, [displayTickers, sliceByTicker, loadingTickers]);

  const performances = useMemo(() => {
    const o: Record<string, StockPerformance | null> = {};
    for (const r of rows) {
      o[r.t] = r.perf ?? null;
    }
    return o;
  }, [rows]);

  const chartLoading = useMemo(
    () => displayTickers.some((t) => loadingTickers.has(t.trim().toUpperCase())),
    [displayTickers, loadingTickers],
  );

  const fundamentalsGrid = comparisonFundamentalGridColumns();
  const performanceGrid = comparisonPerformanceGridColumns();

  return (
    <div className="relative space-y-6">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <TitleTag className="min-w-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">
          Comparison
        </TitleTag>
        <button
          type="button"
          onClick={clearAllTickers}
          disabled={anchor ? displayTickers.length <= 1 : displayTickers.length === 0}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
            anchor
              ? displayTickers.length <= 1
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-neutral-50"
              : displayTickers.length === 0
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-neutral-50",
          )}
          aria-label={
            anchor
              ? "Reset comparison to this symbol only"
              : "Remove all companies and reset comparison"
          }
          title={anchor ? "Reset comparison" : "Remove all companies"}
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {displayTickers.map((sym) => {
          const isAnchor = anchor != null && sym.toUpperCase() === anchor;
          return (
            <div
              key={sym}
              className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
            >
              <span
                className={cn(
                  "flex min-h-[36px] min-w-0 items-center px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]",
                  !isAnchor && "border-r border-[#E4E4E7]",
                )}
              >
                <span className="truncate tabular-nums">{sym}</span>
              </span>
              {isAnchor ? null : (
                <button
                  type="button"
                  onClick={() => removeTicker(sym)}
                  className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
                  aria-label={`Remove ${sym}`}
                >
                  <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
        <ChartingCompanyAddDropdown
          onPickStock={tryAddTicker}
          maxExtraCompanies={Math.max(0, COMPARISON_MAX_COMPANIES - displayTickers.length)}
          excludeSymbols={displayTickers}
          alwaysAllowOpen
        />
      </div>

      <ComparisonCompanyLimitModal open={limitModalOpen} onClose={() => setLimitModalOpen(false)} />

      <div className="overflow-x-auto" aria-busy={chartLoading}>
        <div className="inline-block min-w-full">
          <div
            className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white"
            style={{ minWidth: "900px" }}
          >
            <div
              className="grid min-h-[44px] items-center gap-x-2 bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]"
              style={{ gridTemplateColumns: fundamentalsGrid }}
            >
              <div className="text-left">Company</div>
              {TOP_FUNDAMENTAL_COLUMNS.map((c) => (
                <div key={c.header} className="min-w-0 w-full text-right">
                  {c.header}
                </div>
              ))}
            </div>
            {rows.map((r) =>
              r.isLoading ? (
                <ComparisonFundamentalsTableSkeleton
                  key={`sk-fund-${r.t}`}
                  rowCount={1}
                  gridTemplateColumns={fundamentalsGrid}
                />
              ) : (
                <Link
                  key={r.t}
                  href={`/stock/${encodeURIComponent(r.t)}`}
                  prefetch={false}
                  aria-label={`Open ${r.meta?.fullName?.trim() || r.t} (${r.t})`}
                  className="grid h-[60px] max-h-[60px] cursor-pointer items-center gap-x-2 bg-white px-4 no-underline transition-colors duration-75 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#09090B]/15"
                  style={{ gridTemplateColumns: fundamentalsGrid }}
                >
                  <ComparisonCompanyBlock
                    displayName={r.meta?.fullName?.trim() || r.t}
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
              ),
            )}
          </div>
        </div>
      </div>

      <ComparisonReturnChart
        tickers={displayTickers}
        performances={performances}
        colors={displayTickers.map((_, i) => SERIES_COLORS[i % SERIES_COLORS.length]!)}
        loading={chartLoading}
      />

      <div className="overflow-x-auto" aria-busy={chartLoading}>
        <div className="inline-block min-w-full">
          <div
            className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white"
            style={{ minWidth: "720px" }}
          >
            <div
              className="grid min-h-[44px] items-center gap-x-2 bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]"
              style={{ gridTemplateColumns: performanceGrid }}
            >
              <div className="text-left">Company</div>
              {RETURN_WINDOWS.map((w) => (
                <div key={w.key} className="min-w-0 w-full text-right">
                  {w.label}
                </div>
              ))}
            </div>
            {rows.map((r) =>
              r.isLoading ? (
                <ComparisonPerformanceTableSkeleton
                  key={`sk-perf-${r.t}`}
                  rowCount={1}
                  gridTemplateColumns={performanceGrid}
                />
              ) : (
                <Link
                  key={r.t}
                  href={`/stock/${encodeURIComponent(r.t)}`}
                  prefetch={false}
                  aria-label={`Open ${r.meta?.fullName?.trim() || r.t} (${r.t})`}
                  className="grid h-[60px] max-h-[60px] cursor-pointer items-center gap-x-2 bg-white px-4 no-underline transition-colors duration-75 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#09090B]/15"
                  style={{ gridTemplateColumns: performanceGrid }}
                >
                  <ComparisonCompanyBlock
                    displayName={r.meta?.fullName?.trim() || r.t}
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
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
