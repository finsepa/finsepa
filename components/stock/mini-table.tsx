"use client";

import { X } from "lucide-react";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { useEffect, useMemo, useState } from "react";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { CompanyLogo } from "@/components/screener/company-logo";
import { cn } from "@/lib/utils";
import type { CompanyPick } from "@/components/charting/company-picker";
import { STOCK_OVERVIEW_COMPARE_LINE_COLORS } from "@/components/stock/stock-compare-return-chart";

function PerfCellMaybe({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <td className="min-w-[60px] px-3 py-3 text-right text-[14px] leading-5 tabular-nums text-[#71717A]">—</td>;
  }
  const isPositive = value >= 0;
  return (
    <td
      className={`min-w-[60px] px-3 py-3 text-right text-[14px] leading-5 tabular-nums ${
        isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
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
    setCompareMetaLoading(true);
    setComparePerfLoading(true);
    void (async () => {
      try {
        const [hr, pr] = await Promise.all([
          fetch(`/api/stocks/${encodeURIComponent(compareSym)}/header-meta`, { cache: "no-store" }),
          fetch(`/api/stocks/${encodeURIComponent(compareSym)}/performance`, { cache: "no-store" }),
        ]);
        const hj = hr.ok ? ((await hr.json()) as Parameters<typeof parseHeaderMetaPayload>[0]) : {};
        const pj = pr.ok ? ((await pr.json()) as StockPerformance) : null;
        if (cancelled) return;
        setCompareMeta(parseHeaderMetaPayload(hj));
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
  }, [compareSym]);

  const compareRow = comparePerf;
  const compareDisplayName = compareMeta?.fullName?.trim() ? compareMeta.fullName : nameHint;
  const compareLogoUrl = compareMeta?.logoUrl?.trim() ? compareMeta.logoUrl : "";

  return (
    <tr className="border-b border-[#E4E4E7]">
      <td className="px-3 py-3 text-left align-middle">
        <div
          className="flex items-center justify-start gap-3 pl-2 text-left"
          style={{ borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: borderColor }}
        >
          {compareMetaLoading ? (
            <div className="h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] animate-pulse" aria-hidden />
          ) : (
            <CompanyLogo name={compareDisplayName} logoUrl={compareLogoUrl} symbol={compareSym} />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold leading-5 text-[#09090B]">{compareDisplayName}</div>
            <div className="text-[12px] leading-4 text-[#71717A]">{compareSym}</div>
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
      <td className="min-w-[60px] px-3 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">
        {comparePerfLoading || compareRow?.price == null || !Number.isFinite(compareRow.price)
          ? "—"
          : `$${compareRow.price.toFixed(2)}`}
      </td>
      <PerfCellMaybe value={compareRow?.d1 ?? null} />
      <PerfCellMaybe value={compareRow?.d5 ?? null} />
      <PerfCellMaybe value={compareRow?.m1 ?? null} />
      <PerfCellMaybe value={compareRow?.m6 ?? null} />
      <PerfCellMaybe value={compareRow?.ytd ?? null} />
      <PerfCellMaybe value={compareRow?.y1 ?? null} />
      <PerfCellMaybe value={compareRow?.y5 ?? null} />
      <PerfCellMaybe value={compareRow?.all ?? null} />
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
}: {
  ticker: string;
  headerMeta: StockDetailHeaderMeta | null;
  headerMetaLoading: boolean;
  /** From server initial payload — avoids an extra round-trip on first paint. */
  initialPerformance?: StockPerformance | null;
  /** Overview compare: extra company rows (same order as chart). */
  comparePicks?: readonly CompanyPick[];
  onRemoveCompare?: (symbol: string) => void;
}) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const sym = meta.ticker;
  const displayName = headerMeta?.fullName?.trim() ? headerMeta.fullName : meta.name;
  const logoUrl = headerMeta?.logoUrl?.trim() ? headerMeta.logoUrl : "";
  const [loading, setLoading] = useState(() => !initialPerformance);
  const [perf, setPerf] = useState<StockPerformance | null>(() => initialPerformance ?? null);

  const hasCompare = comparePicks.length > 0;

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
        const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/performance`);
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
  }, [sym, initialPerformance]);

  const row = useMemo(() => perf, [perf]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th className="min-w-[200px] px-3 py-2.5 text-left text-[14px] font-semibold text-[#71717A]">Company</th>
            {["Price", "1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "ALL"].map((h) => (
              <th
                key={h}
                className="min-w-[60px] px-3 py-2.5 text-right text-[14px] font-semibold text-[#71717A]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#E4E4E7]">
            <td className="px-3 py-3 text-left align-middle">
              <div
                className={cn(
                  "flex items-center justify-start gap-3 text-left",
                  hasCompare && "border-l-[3px] border-l-[#2563EB] pl-2",
                )}
              >
                {headerMetaLoading ? (
                  <div className="h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] animate-pulse" aria-hidden />
                ) : (
                  <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={sym} />
                )}
                <div>
                  <div className="text-[14px] font-semibold leading-5 text-[#09090B]">{displayName}</div>
                  <div className="text-[12px] leading-4 text-[#71717A]">{sym}</div>
                </div>
              </div>
            </td>
            <td className="min-w-[60px] px-3 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">
              {loading || row?.price == null || !Number.isFinite(row.price) ? "—" : `$${row.price.toFixed(2)}`}
            </td>
            <PerfCellMaybe value={row?.d1 ?? null} />
            <PerfCellMaybe value={row?.d5 ?? null} />
            <PerfCellMaybe value={row?.m1 ?? null} />
            <PerfCellMaybe value={row?.m6 ?? null} />
            <PerfCellMaybe value={row?.ytd ?? null} />
            <PerfCellMaybe value={row?.y1 ?? null} />
            <PerfCellMaybe value={row?.y5 ?? null} />
            <PerfCellMaybe value={row?.all ?? null} />
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
