"use client";

import { ArrowUpDown } from "lucide-react";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { useEffect, useMemo, useState } from "react";
import type { StockPerformance } from "@/lib/market/stock-performance";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { CompanyLogo } from "@/components/screener/company-logo";

 function PerfCellMaybe({ value }: { value: number | null }) {
   if (value == null || !Number.isFinite(value)) {
     return <td className="text-center text-[14px] leading-5 tabular-nums px-3 py-3 text-[#71717A]">—</td>;
   }
   const isPositive = value >= 0;
   return (
     <td
       className={`text-center text-[14px] leading-5 tabular-nums px-3 py-3 ${
         isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
       }`}
     >
       {isPositive ? "+" : ""}{value.toFixed(2)}%
     </td>
   );
 }

export function MiniTable({
  ticker,
  headerMeta,
  headerMetaLoading,
}: {
  ticker: string;
  headerMeta: StockDetailHeaderMeta | null;
  headerMetaLoading: boolean;
}) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const sym = meta.ticker;
  const displayName = headerMeta?.fullName?.trim() ? headerMeta.fullName : meta.name;
  const logoUrl = headerMeta?.logoUrl?.trim() ? headerMeta.logoUrl : "";
   const [loading, setLoading] = useState(true);
   const [perf, setPerf] = useState<StockPerformance | null>(null);

   useEffect(() => {
     let mounted = true;
     async function load() {
       setLoading(true);
       try {
         const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/performance`, { cache: "no-store" });
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
   }, [sym]);

   const row = useMemo(() => perf, [perf]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th className="text-left px-3 py-2.5 min-w-[200px]">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[#71717A]">
                Company
                <ArrowUpDown className="h-3.5 w-3.5" />
              </div>
            </th>
            {["Price","1D","5D","1M","6M","YTD","1Y","5Y","ALL"].map((h) => (
              <th key={h} className="text-center text-[14px] font-semibold text-[#71717A] px-3 py-2.5 min-w-[60px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#E4E4E7]">
            <td className="px-3 py-3">
              <div className="flex items-center gap-3">
                {headerMetaLoading ? (
                  <div className="h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] animate-pulse" aria-hidden />
                ) : (
                  <CompanyLogo name={displayName} logoUrl={logoUrl} />
                )}
                <div>
                  <div className="text-[14px] font-semibold leading-5 text-[#09090B]">{displayName}</div>
                  <div className="text-[12px] leading-4 text-[#71717A]">{sym}</div>
                </div>
              </div>
            </td>
            <td className="text-center text-[14px] leading-5 tabular-nums text-[#09090B] px-3 py-3">
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
        </tbody>
      </table>
    </div>
  );
}
