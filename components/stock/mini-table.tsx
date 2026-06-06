"use client";

import { X } from "@/lib/icons";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { useEffect, useMemo, useState } from "react";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { CompanyLogo } from "@/components/screener/company-logo";
import { cn } from "@/lib/utils";
import type { CompanyPick } from "@/components/charting/company-picker";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { isCryptoOverviewSymbol } from "@/lib/crypto/crypto-picker-universe";
import { STOCK_OVERVIEW_COMPARE_LINE_COLORS } from "@/components/stock/stock-compare-return-chart";
function formatPerformancePct(value: number): string {
  const isPositive = value >= 0;
  const sign = isPositive ? "+" : "−";
  const body = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${body}%`;
}

type PerfField = keyof Pick<StockPerformance, "d1" | "d5" | "m1" | "m6" | "ytd" | "y1" | "y5" | "all">;

const MINI_TABLE_PERF_COLUMNS: readonly {
  header: string;
  field: PerfField;
  showOnMobile: boolean;
}[] = [
  { header: "1D", field: "d1", showOnMobile: false },
  { header: "5D", field: "d5", showOnMobile: true },
  { header: "1M", field: "m1", showOnMobile: true },
  { header: "6M", field: "m6", showOnMobile: true },
  { header: "YTD", field: "ytd", showOnMobile: true },
  { header: "1Y", field: "y1", showOnMobile: false },
  { header: "5Y", field: "y5", showOnMobile: true },
  { header: "ALL", field: "all", showOnMobile: false },
];

/** Mobile overview strip: 5D, 1M, 6M, YTD, 5Y — equal fifths when the company column is hidden. */
const MOBILE_OVERVIEW_PERF_COL_CLASS = "max-md:w-1/5";

function perfColClass(showOnMobile: boolean, hideCompanyColumn = false) {
  return cn(
    "px-3 py-2.5 max-md:min-w-0 max-md:px-2",
    hideCompanyColumn ? "text-center" : "text-right",
    showOnMobile
      ? cn(
          "table-cell",
          hideCompanyColumn ? MOBILE_OVERVIEW_PERF_COL_CLASS : "max-md:min-w-[3.25rem] max-md:w-[16%]",
        )
      : "hidden md:table-cell",
    "md:min-w-[60px]",
  );
}

function perfCellClass(showOnMobile: boolean, hideCompanyColumn = false) {
  return cn(
    "px-3 py-3 text-[14px] leading-5 tabular-nums max-md:min-w-0 max-md:px-2",
    hideCompanyColumn ? "text-center" : "text-right",
    showOnMobile
      ? cn(
          "table-cell",
          hideCompanyColumn ? MOBILE_OVERVIEW_PERF_COL_CLASS : "max-md:min-w-[3.25rem] max-md:w-[16%]",
        )
      : "hidden md:table-cell",
    "md:min-w-[60px]",
  );
}

function PerfCellMaybe({
  value,
  showOnMobile,
  hideCompanyColumn = false,
}: {
  value: number | null;
  showOnMobile: boolean;
  hideCompanyColumn?: boolean;
}) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <td className={cn(perfCellClass(showOnMobile, hideCompanyColumn), "text-[#71717A]")}>—</td>
    );
  }
  const isPositive = value >= 0;
  return (
    <td
      className={cn(
        perfCellClass(showOnMobile, hideCompanyColumn),
        isPositive ? "text-[#16A34A]" : "text-[#DC2626]",
      )}
    >
      {formatPerformancePct(value)}
    </td>
  );
}

function parseHeaderMetaPayload(json: {
  fullName?: unknown;
  logoUrl?: unknown;
}): Pick<StockDetailHeaderMeta, "fullName" | "logoUrl"> {
  return {
    fullName: typeof json.fullName === "string" ? json.fullName : null,
    logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : null,
  };
}

function OverviewCompareRow({
  pick,
  borderColor,
  onRemove,
}: {
  pick: CompanyPick;
  borderColor: string;
  onRemove: () => void;
}) {
  const compareSym = pick.symbol.trim().toUpperCase();
  const nameHint = pick.name?.trim() || compareSym;
  const [compareMeta, setCompareMeta] = useState<Pick<StockDetailHeaderMeta, "fullName" | "logoUrl"> | null>(null);
  const [compareMetaLoading, setCompareMetaLoading] = useState(false);
  const [comparePerf, setComparePerf] = useState<StockPerformance | null>(null);
  const [comparePerfLoading, setComparePerfLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isCrypto = isCryptoOverviewSymbol(compareSym);
    setCompareMetaLoading(!isCrypto);
    setComparePerfLoading(true);
    void (async () => {
      try {
        const perfUrl = isCrypto
          ? `/api/crypto/${encodeURIComponent(compareSym)}/performance`
          : `/api/stocks/${encodeURIComponent(compareSym)}/performance`;
        const [hr, pr] = await Promise.all([
          isCrypto
            ? Promise.resolve(null)
            : fetch(`/api/stocks/${encodeURIComponent(compareSym)}/header-meta`),
          fetch(perfUrl),
        ]);
        const hj =
          hr && hr.ok ? ((await hr.json()) as Parameters<typeof parseHeaderMetaPayload>[0]) : {};
        const pj = pr.ok ? ((await pr.json()) as StockPerformance) : null;
        if (cancelled) return;
        if (isCrypto) {
          const base = cryptoRouteBase(compareSym);
          setCompareMeta({
            fullName: nameHint,
            logoUrl: getCryptoLogoUrl(base),
          });
        } else {
          setCompareMeta(parseHeaderMetaPayload(hj));
        }
        setComparePerf(pj);
      } catch {
        if (!cancelled) {
          setCompareMeta(null);
          setComparePerf(null);
        }
      } finally {
        if (!cancelled) {
          setCompareMetaLoading(false);
          setComparePerfLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareSym, nameHint]);

  const compareRow = comparePerf;
  const compareDisplayName = compareMeta?.fullName?.trim() ? compareMeta.fullName : nameHint;
  const compareLogoUrl = compareMeta?.logoUrl?.trim() ? compareMeta.logoUrl : "";

  return (
    <tr className="border-b border-[#E4E4E7]">
      <td className="max-w-0 px-3 py-3 text-left align-middle">
        <div
          className="flex min-w-0 items-center justify-start gap-3 pl-2 text-left"
          style={{ borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: borderColor }}
        >
          {compareMetaLoading ? (
            <div className="h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] animate-pulse" aria-hidden />
          ) : (
            <CompanyLogo name={compareDisplayName} logoUrl={compareLogoUrl} symbol={compareSym} />
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <div
              className="truncate text-[14px] font-semibold leading-5 text-[#09090B]"
              title={compareDisplayName}
            >
              {compareDisplayName}
            </div>
            <div className="truncate text-[12px] leading-4 text-[#71717A]" title={compareSym}>
              {isCryptoOverviewSymbol(compareSym) ? eodhdCryptoSpotTickerDisplay(compareSym) : compareSym}
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
            aria-label={`Remove ${compareSym} from comparison`}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </td>
      {MINI_TABLE_PERF_COLUMNS.map((col) => (
        <PerfCellMaybe
          key={col.header}
          showOnMobile={col.showOnMobile}
          value={compareRow?.[col.field] ?? null}
        />
      ))}
    </tr>
  );
}

export function MiniTable({
  ticker,
  headerMeta,
  headerMetaLoading,
  initialPerformance,
  comparePicks = [],
  onRemoveCompare,
  cryptoPrimary,
}: {
  ticker: string;
  headerMeta?: StockDetailHeaderMeta | null;
  headerMetaLoading?: boolean;
  /** From server initial payload — avoids an extra round-trip on first paint. */
  initialPerformance?: StockPerformance | null;
  /** Overview compare: extra company rows (same order as chart). */
  comparePicks?: readonly CompanyPick[];
  onRemoveCompare?: (symbol: string) => void;
  /** Crypto overview: primary row uses crypto APIs and supplied display fields. */
  cryptoPrimary?: { displayName: string; logoUrl: string };
}) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const sym = cryptoPrimary ? ticker.trim().toUpperCase() : meta.ticker;
  const displayName = cryptoPrimary
    ? cryptoPrimary.displayName
    : headerMeta?.fullName?.trim()
      ? headerMeta.fullName
      : meta.name;
  const logoUrl = cryptoPrimary ? cryptoPrimary.logoUrl.trim() : headerMeta?.logoUrl?.trim() ? headerMeta.logoUrl : "";
  const primaryMetaLoading = cryptoPrimary ? false : (headerMetaLoading ?? false);
  const [loading, setLoading] = useState(() => !initialPerformance);
  const [perf, setPerf] = useState<StockPerformance | null>(() => initialPerformance ?? null);

  const hasCompare = comparePicks.length > 0;
  const hideCompanyColumn = !hasCompare;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (initialPerformance) {
        setPerf(initialPerformance);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const perfPath = cryptoPrimary
          ? `/api/crypto/${encodeURIComponent(sym)}/performance`
          : `/api/stocks/${encodeURIComponent(sym)}/performance`;
        const res = await fetch(perfPath);
         if (!res.ok) {
           if (!mounted) return;
           setPerf(null);
           setLoading(false);
           return;
         }
         const json = (await res.json()) as StockPerformance;
         if (!mounted) return;
         setPerf(json);
         setLoading(false);
       } catch {
         if (!mounted) return;
         setPerf(null);
         setLoading(false);
       }
     }
     void load();
    return () => {
      mounted = false;
    };
  }, [sym, initialPerformance, cryptoPrimary]);

  const row = useMemo(() => perf, [perf]);

  return (
    <div
      className={cn(
        "overflow-x-auto max-md:overscroll-x-contain",
        hideCompanyColumn &&
          "overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]",
      )}
    >
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr
            className={cn(
              "bg-white",
              hideCompanyColumn ? "border-b border-[#E4E4E7]" : "border-t border-b border-[#E4E4E7]",
            )}
          >
            {hasCompare ? (
              <th className="min-w-0 px-3 py-2.5 text-left text-[14px] font-semibold text-[#71717A] max-md:w-[52%] md:min-w-[200px]">
                Company
              </th>
            ) : null}
            {MINI_TABLE_PERF_COLUMNS.map((col) => (
              <th
                key={col.header}
                className={cn(perfColClass(col.showOnMobile, hideCompanyColumn), "text-[14px] font-semibold text-[#71717A]")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className={cn(!hideCompanyColumn && "border-b border-[#E4E4E7]")}>
            {hasCompare ? (
              <td className="max-w-0 px-3 py-3 text-left align-middle">
                <div className="flex min-w-0 items-center justify-start gap-3 border-l-[3px] border-l-[#2563EB] pl-2 text-left">
                {primaryMetaLoading ? (
                  <div className="h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] animate-pulse" aria-hidden />
                ) : (
                  <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={sym} />
                )}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div
                    className="truncate text-[14px] font-semibold leading-5 text-[#09090B]"
                    title={displayName}
                  >
                    {displayName}
                  </div>
                  <div className="truncate text-[12px] leading-4 text-[#71717A]" title={sym}>
                    {cryptoPrimary ? eodhdCryptoSpotTickerDisplay(sym) : sym}
                  </div>
                </div>
                </div>
              </td>
            ) : null}
            {MINI_TABLE_PERF_COLUMNS.map((col) => (
              <PerfCellMaybe
                key={col.header}
                showOnMobile={col.showOnMobile}
                hideCompanyColumn={hideCompanyColumn}
                value={row?.[col.field] ?? null}
              />
            ))}
          </tr>
          {comparePicks.map((pick, i) => (
            <OverviewCompareRow
              key={pick.symbol.toUpperCase()}
              pick={pick}
              borderColor={STOCK_OVERVIEW_COMPARE_LINE_COLORS[i % STOCK_OVERVIEW_COMPARE_LINE_COLORS.length]!}
              onRemove={() => onRemoveCompare?.(pick.symbol)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
