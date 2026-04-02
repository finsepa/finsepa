"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { isSingleAssetMode } from "@/lib/features/single-asset";

type CompareRow = {
  ticker: string;
  fullName: string | null;
  logoUrl: string | null;
  revGrowth: string;
  grossProfit: string;
  operIncome: string;
  netIncome: string;
  eps: string;
  epsGrowth: string;
  revenue: string;
};

/** Session cache: one row per ticker (active symbol only). */
const PEERS_SINGLE_COMPARE_CACHE = new Map<string, CompareRow[]>();

function StockPeersTabInner({ ticker }: { ticker: string }) {
  const singleMode = isSingleAssetMode();
  const main = ticker.trim().toUpperCase();

  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (singleMode) return;
    let cancelled = false;

    async function loadCompare() {
      const cached = PEERS_SINGLE_COMPARE_CACHE.get(main) ?? null;
      if (cached) {
        setRows(cached);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setRows(null);
      try {
        const res = await fetch("/api/stocks/peers/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: [main] }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setRows([]);
            setError("Failed to load peers.");
          }
          return;
        }
        const json = (await res.json()) as { rows?: CompareRow[] };
        if (cancelled) return;
        const nextRows = Array.isArray(json.rows) ? json.rows : [];
        setRows(nextRows);
        PEERS_SINGLE_COMPARE_CACHE.set(main, nextRows);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Failed to load peers.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCompare();
    return () => {
      cancelled = true;
    };
  }, [main, singleMode]);

  const row = rows?.find((r) => r.ticker.toUpperCase() === main) ?? rows?.[0] ?? null;
  const meta = useMemo(() => getStockDetailMetaFromTicker(main), [main]);
  const displayName = row?.fullName?.trim() ? row.fullName : meta.name;
  const displayLogo = row?.logoUrl ?? meta.logoUrl ?? null;

  const tableRow = useMemo(() => {
    return {
      ticker: main,
      name: displayName,
      logoUrl: displayLogo,
      revGrowth: row?.revGrowth ?? "—",
      grossProfit: row?.grossProfit ?? "—",
      operIncome: row?.operIncome ?? "—",
      netIncome: row?.netIncome ?? "—",
      eps: row?.eps ?? "—",
      epsGrowth: row?.epsGrowth ?? "—",
      revenue: row?.revenue ?? "—",
    };
  }, [main, displayName, displayLogo, row]);

  if (singleMode) {
    return <div className="space-y-2 pt-2 text-[#71717A]">Peers temporarily unavailable in NVDA-only mode.</div>;
  }

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">Peers</h2>
        <p className="text-[12px] text-[#71717A]">Showing this symbol only — faster load.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white py-1 pl-1.5 pr-2 text-[12px] font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
          <CompanyLogo name={displayName} logoUrl={(displayLogo ?? "").trim()} symbol={main} />
          <span className="tabular-nums">{main}</span>
        </div>
      </div>

      {loading ? (
        <div className="h-[120px] rounded-xl bg-[#F4F4F5] animate-pulse" aria-hidden />
      ) : error ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-t border-b border-[#E4E4E7] bg-white">
                <th className="px-4 py-3 text-left text-[14px] font-semibold leading-5 text-[#71717A]">Company</th>
                {["Rev Growth", "Gross Profit", "Oper Income", "Net Income", "EPS", "EPS Growth", "Revenue"].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-[14px] font-semibold leading-5 text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E4E4E7] last:border-0 transition-colors duration-75 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CompanyLogo name={tableRow.name} logoUrl={(tableRow.logoUrl ?? "").trim()} symbol={tableRow.ticker} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{tableRow.name}</div>
                      <div className="text-[12px] leading-4 text-[#71717A]">{tableRow.ticker}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.revGrowth}</td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.grossProfit}</td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.operIncome}</td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.netIncome}</td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.eps}</td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.epsGrowth}</td>
                <td className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]">{tableRow.revenue}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const StockPeersTab = memo(StockPeersTabInner);
