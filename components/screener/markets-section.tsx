"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { ScreenerTabs, type StocksSubTab } from "@/components/screener/screener-tabs";
import { ScreenerTable } from "@/components/screener/screener-table";
import { CryptoTable } from "@/components/screener/crypto-table";
import { IndicesTable } from "@/components/screener/indices-table";
import { StocksTableSkeleton } from "@/components/markets/markets-skeletons";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { IndexCardData } from "@/lib/screener/indices-today";

export function MarketsSection({
  stockRows,
  cryptoRows,
  indicesRows,
  indexCards,
}: {
  stockRows: ScreenerTableRow[];
  cryptoRows: CryptoTop10Row[];
  indicesRows: IndexTableRow[];
  indexCards: IndexCardData[];
}) {
  const [tab, setTab] = useState<MarketTab>("Stocks");
  const [stocksSubTab, setStocksSubTab] = useState<StocksSubTab>("Companies");
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPageSize] = useState(20);
  const [companiesTotal] = useState(stockRows.length);
  const [companiesRows] = useState<ScreenerTableRow[]>(stockRows);
  const [companiesLoading] = useState(false);
  const [companiesError] = useState<string | null>(null);

  // On-demand upgrades (no skeletons): when user opens Crypto/Indices,
  // fetch the fuller derived payload once and swap in-place.
  const [cryptoRowsState, setCryptoRowsState] = useState<CryptoTop10Row[]>(cryptoRows);
  const [indicesRowsState, setIndicesRowsState] = useState<IndexTableRow[]>(indicesRows);
  const [cryptoUpgraded, setCryptoUpgraded] = useState(false);
  const [indicesUpgraded, setIndicesUpgraded] = useState(false);

  useEffect(() => {
    if (tab !== "Crypto" || cryptoUpgraded) return;
    // If already fully populated, skip.
    const needs =
      cryptoRowsState.some((r) => r.changePercent1M == null || r.changePercentYTD == null || !r.sparkline5d?.length);
    if (!needs) {
      setCryptoUpgraded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/screener/crypto-top10", { cache: "no-store" });
        const json = (await res.json()) as { rows?: CryptoTop10Row[] };
        const next = Array.isArray(json.rows) ? json.rows : [];
        if (cancelled) return;
        if (next.length) setCryptoRowsState(next);
      } catch {
        // keep existing rows
      } finally {
        if (!cancelled) setCryptoUpgraded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, cryptoUpgraded, cryptoRowsState]);

  useEffect(() => {
    if (tab !== "Indices" || indicesUpgraded) return;
    const needs = indicesRowsState.some((r) => r.change1M == null || r.changeYTD == null || !r.spark5d?.length);
    if (!needs) {
      setIndicesUpgraded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/screener/indices-top10", { cache: "no-store" });
        const json = (await res.json()) as { rows?: IndexTableRow[] };
        const next = Array.isArray(json.rows) ? json.rows : [];
        if (cancelled) return;
        if (next.length) setIndicesRowsState(next);
      } catch {
        // keep existing rows
      } finally {
        if (!cancelled) setIndicesUpgraded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, indicesUpgraded, indicesRowsState]);

  const gainersLosers = useMemo(() => {
    // Static mock ordering: NVDA is the only gainer and AAPL is the only loser.
    const nvda = stockRows.find((r) => r.ticker === "NVDA");
    const aapl = stockRows.find((r) => r.ticker === "AAPL");
    return { gainers: nvda ? [nvda] : [], losers: aapl ? [aapl] : [] };
  }, [stockRows]);

  const totalPages = Math.max(1, Math.ceil(companiesTotal / companiesPageSize));
  const safeCompaniesPage = Math.min(totalPages, Math.max(1, companiesPage));

  // Static mock data: no companies API calls.

  return (
    <div>
      <MarketTabs
        active={tab}
        onChange={(next) => {
          setTab(next);
        }}
      />

      {tab === "Stocks" ? (
        <>
          <IndexCards initialCards={indexCards} />
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

      {tab === "Crypto" ? <CryptoTable initialRows={cryptoRowsState} /> : null}
      {tab === "Indices" ? <IndicesTable initialRows={indicesRowsState} /> : null}
    </div>
  );
}

