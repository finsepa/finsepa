"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { ScreenerPagePayload } from "@/lib/screener/screener-page-payload";
import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import { SCREENER_MARKETS_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { UsMarketsSessionLabel } from "@/components/screener/us-markets-session-label";
import { ScreenerSectorsTable } from "@/components/screener/screener-sectors-table";
import { ScreenerTabs, type StocksSubTab } from "@/components/screener/screener-tabs";
import { ScreenerTable } from "@/components/screener/screener-table";
import { CryptoTable } from "@/components/screener/crypto-table";
import { IndicesTable } from "@/components/screener/indices-table";
import { StocksTableSkeleton } from "@/components/markets/markets-skeletons";
import { ScreenerPagination } from "@/components/ui/table-pagination";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";

/** Rows per list on the Stocks → Gainers & Losers sub-tab. */
const GAINERS_LOSERS_TOP_N = 5;

function marketTabFromUrl(searchParams: URLSearchParams): MarketTab {
  const raw = searchParams.get(SCREENER_MARKET_QUERY)?.trim().toLowerCase() ?? "";
  if (raw === "crypto") return "Crypto";
  if (raw === "indices") return "Indices";
  return "Stocks";
}

function StocksTabBody({
  stockRows,
  stocksTotalCount,
  companiesRows,
  companiesRemoteLoading,
  stocksSubTab,
  companiesPage,
  setCompaniesPage,
  sectorsRows,
}: {
  stockRows: ScreenerTableRow[];
  stocksTotalCount: number;
  companiesRows: ScreenerTableRow[];
  companiesRemoteLoading: boolean;
  stocksSubTab: StocksSubTab;
  companiesPage: number;
  setCompaniesPage: (u: number | ((p: number) => number)) => void;
  sectorsRows: ScreenerSectorRow[];
}) {
  const companiesPageSize = SCREENER_MARKETS_PAGE_SIZE;
  const companiesTotal = stocksTotalCount;
  const companiesLoading = companiesRemoteLoading;
  const companiesError = null as string | null;

  const gainersLosers = useMemo(() => {
    const universe = companiesRows;
    const valid = universe.filter((r) => r.change1D != null && Number.isFinite(r.change1D));
    const by1dDesc = [...valid].sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0));
    const by1dAsc = [...valid].sort((a, b) => (a.change1D ?? 0) - (b.change1D ?? 0));
    return {
      gainers: by1dDesc.slice(0, GAINERS_LOSERS_TOP_N),
      losers: by1dAsc.slice(0, GAINERS_LOSERS_TOP_N),
    };
  }, [companiesRows]);

  const totalPages = Math.max(1, Math.ceil(companiesTotal / companiesPageSize));
  const safeCompaniesPage = Math.min(totalPages, Math.max(1, companiesPage));

  return (
    <>
      {stocksSubTab === "Sectors" ? (
        <ScreenerSectorsTable rows={sectorsRows} />
      ) : stocksSubTab === "Companies" ? (
        <div>
          {companiesLoading && !companiesRows.length ? (
            <StocksTableSkeleton rows={SCREENER_MARKETS_PAGE_SIZE} />
          ) : null}

          {!companiesLoading && companiesError ? (
            <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
              {companiesError}
            </div>
          ) : null}

          {companiesRows.length > 0 ? (
            <ScreenerTable rows={companiesRows} rankOffset={(safeCompaniesPage - 1) * companiesPageSize} />
          ) : null}

          {companiesLoading && companiesRows.length > 0 ? (
            <p className="mt-3 text-sm font-medium text-[#71717A]">Loading companies…</p>
          ) : null}

          <ScreenerPagination
            page={safeCompaniesPage}
            totalPages={totalPages}
            onPageChange={(p) => setCompaniesPage(p)}
            disabled={companiesLoading}
            aria-label="Companies list pages"
          />
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
  );
}

function CryptoTabBody({
  cryptoTotalCount,
  cryptoPage,
  setCryptoPage,
  cryptoRowsResolved,
  cryptoRemoteLoading,
}: {
  cryptoTotalCount: number;
  cryptoPage: number;
  setCryptoPage: (u: number | ((p: number) => number)) => void;
  cryptoRowsResolved: CryptoTop10Row[];
  cryptoRemoteLoading: boolean;
}) {
  const pageSize = SCREENER_MARKETS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(cryptoTotalCount / pageSize));
  const safeCryptoPage = Math.min(totalPages, Math.max(1, cryptoPage));

  return (
    <div>
      <CryptoTable
        initialRows={cryptoRowsResolved}
        rankOffset={(safeCryptoPage - 1) * pageSize}
      />

      {cryptoRemoteLoading && cryptoRowsResolved.length > 0 ? (
        <p className="mt-3 text-sm font-medium text-[#71717A]">Loading…</p>
      ) : null}

      <ScreenerPagination
        page={safeCryptoPage}
        totalPages={totalPages}
        onPageChange={(p) => setCryptoPage(p)}
        disabled={cryptoRemoteLoading}
        aria-label="Crypto list pages"
      />
    </div>
  );
}

function IndicesTabBody({ indicesRows }: { indicesRows: IndexTableRow[] }) {
  const [indicesPage, setIndicesPage] = useState(1);
  const pageSize = SCREENER_MARKETS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(indicesRows.length / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, indicesPage));
  const slice = useMemo(
    () => indicesRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [indicesRows, safePage, pageSize],
  );

  return (
    <div>
      <IndicesTable initialRows={slice} rankOffset={(safePage - 1) * pageSize} />
      <ScreenerPagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={(p) => setIndicesPage(p)}
        aria-label="Indices list pages"
      />
    </div>
  );
}

export function MarketsSection({ payload }: { payload: ScreenerPagePayload }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => marketTabFromUrl(searchParams), [searchParams]);

  const setMarketTab = useCallback(
    (next: MarketTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "Stocks") {
        params.delete(SCREENER_MARKET_QUERY);
      } else {
        params.set(SCREENER_MARKET_QUERY, next === "Crypto" ? "crypto" : "indices");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [stocksSubTab, setStocksSubTab] = useState<StocksSubTab>("Companies");
  const [companiesPage, setCompaniesPage] = useState(1);
  const [fetchedCompanyPages, setFetchedCompanyPages] = useState<Record<number, ScreenerTableRow[]>>({});
  const [companiesRemoteLoading, setCompaniesRemoteLoading] = useState(false);
  const [gainersLosersRows, setGainersLosersRows] = useState<ScreenerTableRow[] | null>(null);
  const [cryptoPage, setCryptoPage] = useState(1);
  const [fetchedCryptoPages, setFetchedCryptoPages] = useState<Record<number, CryptoTop10Row[]>>({});
  const [cryptoRemoteLoading, setCryptoRemoteLoading] = useState(false);

  const stockRows = payload.market === "stocks" ? payload.stockRows : [];
  const stocksTotalCount = payload.market === "stocks" ? payload.stocksTotalCount : 0;
  const sectorsRows = payload.market === "stocks" ? payload.sectors : [];
  const cryptoRows = payload.market === "crypto" ? payload.cryptoRows : [];
  const cryptoTotalCount = payload.market === "crypto" ? payload.cryptoTotalCount : 0;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCompaniesPage(1);
      setFetchedCompanyPages({});
      setGainersLosersRows(null);
      setCryptoPage(1);
      setFetchedCryptoPages({});
    });
    return () => cancelAnimationFrame(id);
  }, [payload.market]);

  const companiesRowsForTable = useMemo(() => {
    if (payload.market !== "stocks") return [];
    if (companiesPage <= 1) return stockRows;
    return fetchedCompanyPages[companiesPage] ?? [];
  }, [payload.market, companiesPage, stockRows, fetchedCompanyPages]);

  const awaitingRemoteCompanies =
    payload.market === "stocks" &&
    stocksSubTab === "Companies" &&
    companiesPage > 1 &&
    fetchedCompanyPages[companiesPage] === undefined;

  useEffect(() => {
    if (payload.market !== "stocks") return;
    if (stocksSubTab !== "Companies") return;
    if (companiesPage <= 1) return;
    if (fetchedCompanyPages[companiesPage] !== undefined) return;

    let cancelled = false;
    const loadId = requestAnimationFrame(() => {
      if (!cancelled) setCompaniesRemoteLoading(true);
    });
    fetch(`/api/screener/companies?page=${companiesPage}&pageSize=${SCREENER_MARKETS_PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data: { rows?: ScreenerTableRow[] }) => {
        if (cancelled) return;
        setFetchedCompanyPages((m) => ({ ...m, [companiesPage]: data.rows ?? [] }));
      })
      .finally(() => {
        if (!cancelled) setCompaniesRemoteLoading(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(loadId);
    };
  }, [payload.market, stocksSubTab, companiesPage, fetchedCompanyPages]);

  useEffect(() => {
    if (payload.market !== "stocks") return;
    if (stocksSubTab !== "Gainers & Losers") return;
    if (gainersLosersRows) return;

    let cancelled = false;
    fetch(`/api/screener/companies?gainersLosers=1`)
      .then((r) => r.json())
      .then((data: { rows?: ScreenerTableRow[] }) => {
        if (cancelled) return;
        setGainersLosersRows(data.rows ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [payload.market, stocksSubTab, gainersLosersRows]);

  const cryptoRowsForTable = useMemo(() => {
    if (payload.market !== "crypto") return [];
    if (cryptoPage <= 1) return cryptoRows;
    return fetchedCryptoPages[cryptoPage] ?? [];
  }, [payload.market, cryptoPage, cryptoRows, fetchedCryptoPages]);

  const awaitingRemoteCrypto =
    payload.market === "crypto" &&
    cryptoPage > 1 &&
    fetchedCryptoPages[cryptoPage] === undefined;

  useEffect(() => {
    if (payload.market !== "crypto") return;
    if (cryptoPage <= 1) return;
    if (fetchedCryptoPages[cryptoPage] !== undefined) return;

    let cancelled = false;
    const loadId = requestAnimationFrame(() => {
      if (!cancelled) setCryptoRemoteLoading(true);
    });
    fetch(`/api/screener/crypto-rows?page=${cryptoPage}&pageSize=${SCREENER_MARKETS_PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data: { rows?: CryptoTop10Row[] }) => {
        if (cancelled) return;
        setFetchedCryptoPages((m) => ({ ...m, [cryptoPage]: data.rows ?? [] }));
      })
      .finally(() => {
        if (!cancelled) setCryptoRemoteLoading(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(loadId);
    };
  }, [payload.market, cryptoPage, fetchedCryptoPages]);

  const companiesRowsResolved = useMemo(() => {
    if (payload.market !== "stocks") return [];
    if (stocksSubTab === "Gainers & Losers") {
      return gainersLosersRows ?? stockRows;
    }
    return companiesRowsForTable;
  }, [payload.market, stocksSubTab, gainersLosersRows, stockRows, companiesRowsForTable]);

  const companiesLoadingActive = awaitingRemoteCompanies || companiesRemoteLoading;
  const cryptoLoadingActive = awaitingRemoteCrypto || cryptoRemoteLoading;

  return (
    <div className="min-w-0">
      <MarketTabs active={tab} onChange={setMarketTab} trailing={<UsMarketsSessionLabel />} />

      {tab === "Stocks" && payload.market === "stocks" ? (
        <>
          <IndexCards initialCards={payload.indexCards} />
          <div className="mb-5">
            <ScreenerTabs active={stocksSubTab} onChange={setStocksSubTab} />
          </div>
          <StocksTabBody
            stockRows={stockRows}
            stocksTotalCount={stocksTotalCount}
            companiesRows={companiesRowsResolved}
            companiesRemoteLoading={companiesLoadingActive}
            stocksSubTab={stocksSubTab}
            companiesPage={companiesPage}
            setCompaniesPage={setCompaniesPage}
            sectorsRows={sectorsRows}
          />
        </>
      ) : null}

      {tab === "Crypto" && payload.market === "crypto" ? (
        <CryptoTabBody
          cryptoTotalCount={cryptoTotalCount}
          cryptoPage={cryptoPage}
          setCryptoPage={setCryptoPage}
          cryptoRowsResolved={cryptoRowsForTable}
          cryptoRemoteLoading={cryptoLoadingActive}
        />
      ) : null}
      {tab === "Indices" && payload.market === "indices" ? (
        <IndicesTabBody indicesRows={payload.indicesRows} />
      ) : null}
    </div>
  );
}
