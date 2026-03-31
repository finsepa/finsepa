"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { ScreenerTabs, type StocksSubTab } from "@/components/screener/screener-tabs";
import { ScreenerTable } from "@/components/screener/screener-table";
import { CryptoTable } from "@/components/screener/crypto-table";
import { IndicesTable } from "@/components/screener/indices-table";
import { StocksTableSkeleton } from "@/components/markets/markets-skeletons";

export function MarketsSection({ stockRows }: { stockRows: ScreenerTableRow[] }) {
  const [tab, setTab] = useState<MarketTab>("Stocks");
  const [stocksSubTab, setStocksSubTab] = useState<StocksSubTab>("Companies");
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPageSize] = useState(20);
  const [companiesTotal, setCompaniesTotal] = useState(500);
  const [companiesRows, setCompaniesRows] = useState<ScreenerTableRow[] | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const pageCacheRef = useRef(new Map<number, ScreenerTableRow[]>());
  const inFlightRef = useRef<AbortController | null>(null);

  const gainersLosers = useMemo(() => {
    const sorted = [...stockRows].sort((a, b) => b.change1D - a.change1D);
    const gainers = sorted.slice(0, 5);
    const losers = [...sorted].reverse().slice(0, 5);
    return { gainers, losers };
  }, [stockRows]);

  const totalPages = Math.max(1, Math.ceil(companiesTotal / companiesPageSize));
  const safeCompaniesPage = Math.min(totalPages, Math.max(1, companiesPage));

  useEffect(() => {
    if (tab !== "Stocks" || stocksSubTab !== "Companies") return;

    const cached = pageCacheRef.current.get(safeCompaniesPage);
    if (cached) {
      setCompaniesRows(cached);
      setCompaniesError(null);
      return;
    }

    inFlightRef.current?.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;

    let mounted = true;
    async function load() {
      setCompaniesLoading(true);
      setCompaniesError(null);
      setCompaniesRows(null);
      try {
        const res = await fetch(
          `/api/screener/companies?page=${safeCompaniesPage}&pageSize=${companiesPageSize}`,
          { signal: ac.signal },
        );
        if (!res.ok) {
          if (!mounted) return;
          setCompaniesRows([]);
          setCompaniesError("Failed to load companies.");
          setCompaniesLoading(false);
          return;
        }
        const json = (await res.json()) as { rows?: ScreenerTableRow[]; total?: number };
        const rows = Array.isArray(json.rows) ? json.rows : [];
        if (!mounted) return;
        if (typeof json.total === "number" && Number.isFinite(json.total) && json.total > 0) {
          setCompaniesTotal(json.total);
        }
        pageCacheRef.current.set(safeCompaniesPage, rows);
        setCompaniesRows(rows);
        setCompaniesLoading(false);

        // Optional prefetch: warm the next page.
        const next = safeCompaniesPage + 1;
        if (next <= totalPages && !pageCacheRef.current.has(next)) {
          fetch(`/api/screener/companies?page=${next}&pageSize=${companiesPageSize}`).then(async (r) => {
            if (!r.ok) return;
            const j = (await r.json()) as { rows?: ScreenerTableRow[] };
            const rr = Array.isArray(j.rows) ? j.rows : [];
            pageCacheRef.current.set(next, rr);
          }).catch(() => {});
        }
      } catch (e) {
        if (!mounted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setCompaniesRows([]);
        setCompaniesError("Failed to load companies.");
        setCompaniesLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [tab, stocksSubTab, safeCompaniesPage, companiesPageSize, totalPages]);

  return (
    <div>
      <MarketTabs active={tab} onChange={setTab} />

      {tab === "Stocks" ? (
        <>
          <IndexCards />
          <div className="mb-5">
            <ScreenerTabs active={stocksSubTab} onChange={setStocksSubTab} />
          </div>
          {stocksSubTab === "Companies" ? (
            <div>
              {companiesLoading && !companiesRows ? <StocksTableSkeleton rows={20} /> : null}

              {!companiesLoading && companiesError ? (
                <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
                  {companiesError}
                </div>
              ) : null}

              {companiesRows ? (
                <ScreenerTable rows={companiesRows} rankOffset={(safeCompaniesPage - 1) * companiesPageSize} />
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCompaniesPage((p) => Math.max(1, p - 1))}
                  disabled={safeCompaniesPage <= 1 || companiesLoading}
                  className="h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>

                <div className="text-sm font-medium text-[#71717A]">
                  Page <span className="font-semibold text-[#09090B]">{safeCompaniesPage}</span> of{" "}
                  <span className="font-semibold text-[#09090B]">{totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCompaniesPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCompaniesPage >= totalPages || companiesLoading}
                  className="h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-[14px] font-semibold leading-5 text-[#71717A]">Top gainers (1D %)</div>
                <ScreenerTable rows={gainersLosers.gainers} />
              </div>
              <div>
                <div className="mb-3 text-[14px] font-semibold leading-5 text-[#71717A]">Top losers (1D %)</div>
                <ScreenerTable rows={gainersLosers.losers} />
              </div>
            </div>
          )}
        </>
      ) : null}

      {tab === "Crypto" ? <CryptoTable /> : null}
      {tab === "Indices" ? <IndicesTable /> : null}
    </div>
  );
}

