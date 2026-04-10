"use client";

import { ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { CompanyLogo } from "@/components/screener/company-logo";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

function PerfCellMaybe({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <td className="px-3 py-3 text-center text-[14px] leading-5 tabular-nums text-[#71717A]">—</td>;
  }
  const isPositive = value >= 0;
  return (
    <td
      className={`px-3 py-3 text-center text-[14px] leading-5 tabular-nums ${
        isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </td>
  );
}

function formatCryptoPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const max = Math.abs(value) < 1 ? 6 : Math.abs(value) < 100 ? 4 : 2;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: max, minimumFractionDigits: 2 })}`;
}

export function CryptoMiniTable({
  symbol,
  displayName,
  logoUrl,
  initialPerformance,
}: {
  symbol: string;
  displayName: string;
  logoUrl: string;
  initialPerformance?: StockPerformance | null;
}) {
  const sym = symbol.trim().toUpperCase();
  const [loading, setLoading] = useState(() => !initialPerformance);
  const [perf, setPerf] = useState<StockPerformance | null>(() => initialPerformance ?? null);

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
        const res = await fetch(`/api/crypto/${encodeURIComponent(sym)}/performance`, {
          credentials: "include",
        });
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
            <th className="min-w-[200px] px-3 py-2.5 text-left">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[#71717A]">
                Asset
                <ArrowUpDown className="h-3.5 w-3.5" />
              </div>
            </th>
            {["Price", "1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "ALL"].map((h) => (
              <th key={h} className="min-w-[60px] px-3 py-2.5 text-center text-[14px] font-semibold text-[#71717A]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#E4E4E7]">
            <td className="px-3 py-3">
              <div className="flex items-center gap-3">
                <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={sym} />
                <div>
                  <div className="text-[14px] font-semibold leading-5 text-[#09090B]">{displayName}</div>
                  <div className="text-[12px] leading-4 text-[#71717A]">{eodhdCryptoSpotTickerDisplay(sym)}</div>
                </div>
              </div>
            </td>
            <td className="px-3 py-3 text-center text-[14px] leading-5 tabular-nums text-[#09090B]">
              {loading || row?.price == null || !Number.isFinite(row.price) ? "—" : formatCryptoPrice(row.price)}
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
