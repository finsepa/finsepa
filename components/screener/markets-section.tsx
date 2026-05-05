"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { ScreenerPagePayload } from "@/lib/screener/screener-page-payload";
import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import {
  parseScreenerIndustryDrill,
  SCREENER_INDUSTRY_QUERY,
  SCREENER_INDUSTRY_SECTOR_QUERY,
  type ScreenerIndustryDrill,
} from "@/lib/screener/screener-industry-url";
import { parseScreenerSectorParam, SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";
import {
  parseStocksSubTabParam,
  SCREENER_STOCKS_SUB_TAB_QUERY,
} from "@/lib/screener/screener-stocks-sub-tab-url";
import { SCREENER_MARKETS_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { UsMarketsSessionLabel } from "@/components/screener/us-markets-session-label";
import { ScreenerIndustriesTable } from "@/components/screener/screener-industries-table";
import { ScreenerSectorsTable } from "@/components/screener/screener-sectors-table";
import { ScreenerTabs, type StocksSubTab } from "@/components/screener/screener-tabs";
import { ScreenerCompaniesKeyStatToolbar } from "@/components/screener/screener-companies-key-stat-toolbar";
import { ScreenerTable, type ScreenerTableKeyStatColumn } from "@/components/screener/screener-table";
import {
  getScreenerKeyStatMetricById,
  isScreenerBuiltinTableMetricId,
} from "@/lib/screener/screener-key-stats-metric-catalog";
import { CryptoTable } from "@/components/screener/crypto-table";
import { IndicesTable } from "@/components/screener/indices-table";
import { StocksTableSkeleton } from "@/components/markets/markets-skeletons";
import { ScreenerPagination } from "@/components/ui/table-pagination";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { CryptoFearGreedCard } from "@/components/screener/crypto-fear-greed-card";
import { CryptoLargestMoversCard } from "@/components/screener/crypto-largest-movers-card";
import { CryptoFearGreedModal } from "@/components/screener/crypto-fear-greed-modal";
import type { CryptoFearGreedIndex } from "@/lib/market/alternative-fear-greed";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";

/** Rows per list on the Stocks → Gainers & Losers sub-tab. */
const GAINERS_LOSERS_TOP_N = 10;

function marketTabFromUrl(searchParams: URLSearchParams): MarketTab {
  const raw = searchParams.get(SCREENER_MARKET_QUERY)?.trim().toLowerCase() ?? "";
  if (raw === "crypto") return "Crypto";
  if (raw === "indices") return "Indices";
  return "Stocks";
}

function StocksTabBody({
  stocksTotalCount,
  companiesRows,
  companiesRemoteLoading,
  stocksSubTab,
  companiesPage,
  setCompaniesPage,
  sectorsRows,
  industriesRows,
  companiesKeyStatColumn,
  companiesSectorFilter,
  companiesIndustryFilter,
  onClearCompaniesSector,
}: {
  stocksTotalCount: number;
  companiesRows: ScreenerTableRow[];
  companiesRemoteLoading: boolean;
  stocksSubTab: StocksSubTab;
  companiesPage: number;
  setCompaniesPage: (u: number | ((p: number) => number)) => void;
  sectorsRows: ScreenerSectorRow[];
  industriesRows: ScreenerIndustryRow[];
  companiesKeyStatColumn: ScreenerTableKeyStatColumn | null;
  companiesSectorFilter: ScreenerCanonicalSector | null;
  companiesIndustryFilter: ScreenerIndustryDrill | null;
  onClearCompaniesSector: () => void;
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

  const isSectorsDrill = stocksSubTab === "Sectors" && companiesSectorFilter != null;
  const isIndustriesDrill = stocksSubTab === "Industries" && companiesIndustryFilter != null;
  const showCompaniesList = stocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

  return (
    <>
      {stocksSubTab === "Sectors" && !companiesSectorFilter ? (
        <ScreenerSectorsTable rows={sectorsRows} />
      ) : stocksSubTab === "Industries" && !companiesIndustryFilter ? (
        <ScreenerIndustriesTable rows={industriesRows} />
      ) : showCompaniesList ? (
        <div>
          {stocksSubTab === "Companies" && companiesSectorFilter ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5 sm:px-4">
              <p className="text-[13px] leading-5 text-[#09090B] sm:text-[14px]">
                Showing companies in{" "}
                <span className="font-semibold tabular-nums text-[#09090B]">{companiesSectorFilter}</span>
              </p>
              <button
                type="button"
                onClick={onClearCompaniesSector}
                className="shrink-0 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-[13px] font-medium leading-5 text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
              >
                Show all companies
              </button>
            </div>
          ) : null}

          {companiesLoading && !companiesRows.length ? (
            <StocksTableSkeleton rows={SCREENER_MARKETS_PAGE_SIZE} />
          ) : null}

          {!companiesLoading && companiesError ? (
            <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
              {companiesError}
            </div>
          ) : null}

          {!companiesLoading && !companiesError && companiesRows.length === 0 ? (
            <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-6 text-center text-[14px] leading-6 text-[#71717A]">
              {companiesIndustryFilter
                ? `No companies from "${companiesIndustryFilter.industry}" (${companiesIndustryFilter.sector}) appear in the current screener universe.`
                : companiesSectorFilter
                  ? `No companies from the "${companiesSectorFilter}" sector appear in the current screener universe.`
                  : "No companies to show."}
            </div>
          ) : null}

          {companiesRows.length > 0 ? (
            <ScreenerTable
              rows={companiesRows}
              rankOffset={(safeCompaniesPage - 1) * companiesPageSize}
              keyStatColumn={companiesKeyStatColumn}
            />
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
  fearGreed,
}: {
  cryptoTotalCount: number;
  cryptoPage: number;
  setCryptoPage: (u: number | ((p: number) => number)) => void;
  cryptoRowsResolved: CryptoTop10Row[];
  cryptoRemoteLoading: boolean;
  fearGreed: CryptoFearGreedIndex | null;
}) {
  const pageSize = SCREENER_MARKETS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(cryptoTotalCount / pageSize));
  const safeCryptoPage = Math.min(totalPages, Math.max(1, cryptoPage));

  const [fearGreedModalOpen, setFearGreedModalOpen] = useState(false);

  const movers = useMemo(() => {
    const valid = (cryptoRowsResolved ?? []).filter(
      (r) => r.changePercent1D != null && Number.isFinite(r.changePercent1D),
    );
    const gainers = [...valid].sort((a, b) => (b.changePercent1D ?? 0) - (a.changePercent1D ?? 0));
    const losers = [...valid].sort((a, b) => (a.changePercent1D ?? 0) - (b.changePercent1D ?? 0));
    return { gainers, losers };
  }, [cryptoRowsResolved]);

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-6 md:grid-cols-3">
        <CryptoLargestMoversCard title="Largest Gainers" rows={movers.gainers} />
        <CryptoLargestMoversCard title="Largest Losers" rows={movers.losers} />
        <CryptoFearGreedCard data={fearGreed} onOpenFullscreen={() => setFearGreedModalOpen(true)} />
      </div>
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

      <CryptoFearGreedModal
        open={fearGreedModalOpen}
        onClose={() => setFearGreedModalOpen(false)}
        latestValue={fearGreed?.value ?? null}
        latestLabel={fearGreed?.classification ?? "—"}
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
        params.delete(SCREENER_SECTOR_QUERY);
        params.delete(SCREENER_INDUSTRY_QUERY);
        params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
        params.delete(SCREENER_STOCKS_SUB_TAB_QUERY);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const stocksSubTab = useMemo((): StocksSubTab => {
    if (payload.market !== "stocks") return "Companies";
    const parsed = parseStocksSubTabParam(searchParams.get(SCREENER_STOCKS_SUB_TAB_QUERY));
    if (parsed != null) return parsed;
    if (
      parseScreenerIndustryDrill(
        searchParams.get(SCREENER_INDUSTRY_QUERY),
        searchParams.get(SCREENER_INDUSTRY_SECTOR_QUERY),
      )
    ) {
      return "Industries";
    }
    if (parseScreenerSectorParam(searchParams.get(SCREENER_SECTOR_QUERY))) {
      return "Sectors";
    }
    return "Companies";
  }, [payload.market, searchParams]);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [fetchedCompanyPages, setFetchedCompanyPages] = useState<Record<number, ScreenerTableRow[]>>({});
  const [companiesRemoteLoading, setCompaniesRemoteLoading] = useState(false);
  const [gainersLosersRows, setGainersLosersRows] = useState<ScreenerTableRow[] | null>(null);
  const [cryptoPage, setCryptoPage] = useState(1);
  const [fetchedCryptoPages, setFetchedCryptoPages] = useState<Record<number, CryptoTop10Row[]>>({});
  const [cryptoRemoteLoading, setCryptoRemoteLoading] = useState(false);
  const [companiesKeyStatMetricId, setCompaniesKeyStatMetricId] = useState<string | null>(null);
  const [companiesKeyStatValues, setCompaniesKeyStatValues] = useState<Record<string, string>>({});
  const [companiesKeyStatLoading, setCompaniesKeyStatLoading] = useState(false);

  const stockRows = payload.market === "stocks" ? payload.stockRows : [];
  const stocksTotalCount = payload.market === "stocks" ? payload.stocksTotalCount : 0;
  const sectorsRows = payload.market === "stocks" ? payload.sectors : [];
  const industriesRows = payload.market === "stocks" ? payload.industries : [];
  const cryptoRows = payload.market === "crypto" ? payload.cryptoRows : [];
  const cryptoTotalCount = payload.market === "crypto" ? payload.cryptoTotalCount : 0;

  const stocksSectorFilter = useMemo((): ScreenerCanonicalSector | null => {
    if (payload.market !== "stocks") return null;
    return parseScreenerSectorParam(searchParams.get(SCREENER_SECTOR_QUERY));
  }, [payload.market, searchParams]);

  const stocksIndustryFilter = useMemo((): ScreenerIndustryDrill | null => {
    if (payload.market !== "stocks") return null;
    return parseScreenerIndustryDrill(
      searchParams.get(SCREENER_INDUSTRY_QUERY),
      searchParams.get(SCREENER_INDUSTRY_SECTOR_QUERY),
    );
  }, [payload.market, searchParams]);

  const clearCompaniesSectorFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(SCREENER_SECTOR_QUERY);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const clearCompaniesIndustryFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(SCREENER_INDUSTRY_QUERY);
    params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const setStocksSubTabWithUrl = useCallback(
    (next: StocksSubTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "Companies") {
        params.delete(SCREENER_STOCKS_SUB_TAB_QUERY);
        params.delete(SCREENER_INDUSTRY_QUERY);
        params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
      } else {
        params.set(SCREENER_STOCKS_SUB_TAB_QUERY, next);
        if (next === "Sectors") {
          params.delete(SCREENER_INDUSTRY_QUERY);
          params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
        }
        if (next === "Industries") {
          params.delete(SCREENER_SECTOR_QUERY);
        }
        if (next === "Gainers & Losers") {
          params.delete(SCREENER_SECTOR_QUERY);
          params.delete(SCREENER_INDUSTRY_QUERY);
          params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
        }
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (payload.market !== "stocks") return;
    setCompaniesPage(1);
    setFetchedCompanyPages({});
  }, [payload.market, stocksSectorFilter, stocksIndustryFilter]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCompaniesPage(1);
      setFetchedCompanyPages({});
      setGainersLosersRows(null);
      setCryptoPage(1);
      setFetchedCryptoPages({});
      setCompaniesKeyStatMetricId(null);
      setCompaniesKeyStatValues({});
      setCompaniesKeyStatLoading(false);
    });
    return () => cancelAnimationFrame(id);
  }, [payload.market]);

  const companiesRowsForTable = useMemo(() => {
    if (payload.market !== "stocks") return [];
    if (companiesPage <= 1) return stockRows;
    return fetchedCompanyPages[companiesPage] ?? [];
  }, [payload.market, companiesPage, stockRows, fetchedCompanyPages]);

  const isSectorsDrill = stocksSubTab === "Sectors" && stocksSectorFilter != null;
  const isIndustriesDrill = stocksSubTab === "Industries" && stocksIndustryFilter != null;
  const isStocksDrill = isSectorsDrill || isIndustriesDrill;
  const companiesListPaginationActive =
    stocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

  const awaitingRemoteCompanies =
    payload.market === "stocks" &&
    companiesListPaginationActive &&
    companiesPage > 1 &&
    fetchedCompanyPages[companiesPage] === undefined;

  useEffect(() => {
    if (payload.market !== "stocks") return;
    if (!companiesListPaginationActive) return;
    if (companiesPage <= 1) return;
    if (fetchedCompanyPages[companiesPage] !== undefined) return;

    let cancelled = false;
    const loadId = requestAnimationFrame(() => {
      if (!cancelled) setCompaniesRemoteLoading(true);
    });
    const sectorQs =
      stocksSectorFilter != null
        ? `&sector=${encodeURIComponent(stocksSectorFilter)}`
        : "";
    const industryQs =
      stocksIndustryFilter != null
        ? `&${SCREENER_INDUSTRY_SECTOR_QUERY}=${encodeURIComponent(stocksIndustryFilter.sector)}&${SCREENER_INDUSTRY_QUERY}=${encodeURIComponent(stocksIndustryFilter.industry)}`
        : "";
    fetch(
      `/api/screener/companies?page=${companiesPage}&pageSize=${SCREENER_MARKETS_PAGE_SIZE}${sectorQs}${industryQs}`,
    )
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
  }, [
    payload.market,
    companiesListPaginationActive,
    companiesPage,
    fetchedCompanyPages,
    stocksSectorFilter,
    stocksIndustryFilter,
  ]);

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

  const companiesTickerKey = useMemo(
    () => companiesRowsResolved.map((r) => r.ticker.trim().toUpperCase()).join("\u001f"),
    [companiesRowsResolved],
  );

  const companiesKeyStatTabActive =
    stocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

  useEffect(() => {
    if (payload.market !== "stocks" || !companiesKeyStatTabActive || !companiesKeyStatMetricId) {
      if (!companiesKeyStatMetricId) {
        setCompaniesKeyStatValues({});
        setCompaniesKeyStatLoading(false);
      }
      return;
    }
    const tickers = companiesTickerKey.split("\u001f").filter(Boolean);
    if (!tickers.length) return;

    let cancelled = false;
    setCompaniesKeyStatLoading(true);
    fetch("/api/screener/companies-key-stat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers, metricId: companiesKeyStatMetricId }),
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Request failed");
        return r.json() as Promise<{ values?: Record<string, string> }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCompaniesKeyStatValues(data.values ?? {});
      })
      .catch(() => {
        if (!cancelled) setCompaniesKeyStatValues({});
      })
      .finally(() => {
        if (!cancelled) setCompaniesKeyStatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payload.market, companiesKeyStatTabActive, companiesKeyStatMetricId, companiesTickerKey]);

  const resetCompaniesKeyStat = useCallback(() => {
    setCompaniesKeyStatMetricId(null);
    setCompaniesKeyStatValues({});
    setCompaniesKeyStatLoading(false);
  }, []);

  const selectCompaniesKeyStat = useCallback(
    (id: string) => {
      if (isScreenerBuiltinTableMetricId(id)) {
        resetCompaniesKeyStat();
        return;
      }
      setCompaniesKeyStatMetricId(id);
      setCompaniesKeyStatValues({});
    },
    [resetCompaniesKeyStat],
  );

  const companiesKeyStatColumn = useMemo((): ScreenerTableKeyStatColumn | null => {
    if (!companiesKeyStatMetricId) return null;
    const def = getScreenerKeyStatMetricById(companiesKeyStatMetricId);
    if (!def) return null;
    return {
      header: def.label,
      valuesByTicker: companiesKeyStatValues,
      loading: companiesKeyStatLoading,
    };
  }, [companiesKeyStatMetricId, companiesKeyStatValues, companiesKeyStatLoading]);

  const companiesLoadingActive = awaitingRemoteCompanies || companiesRemoteLoading;
  const cryptoLoadingActive = awaitingRemoteCrypto || cryptoRemoteLoading;

  const showCompaniesKeyStatToolbar =
    stocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

  return (
    <div className="min-w-0">
      <MarketTabs active={tab} onChange={setMarketTab} trailing={<UsMarketsSessionLabel />} />

      {tab === "Stocks" && payload.market === "stocks" ? (
        <>
          <IndexCards initialCards={payload.indexCards} />
          {!isStocksDrill ? (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <ScreenerTabs active={stocksSubTab} onChange={setStocksSubTabWithUrl} />
              {showCompaniesKeyStatToolbar ? (
                <ScreenerCompaniesKeyStatToolbar
                  selectedMetricId={companiesKeyStatMetricId}
                  onSelectMetricId={selectCompaniesKeyStat}
                  onReset={resetCompaniesKeyStat}
                  disabled={companiesLoadingActive && companiesRowsResolved.length === 0}
                />
              ) : null}
            </div>
          ) : null}
          {isStocksDrill ? (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={isIndustriesDrill ? clearCompaniesIndustryFilter : clearCompaniesSectorFilter}
                  title={isIndustriesDrill ? "Back to all industries" : "Back to all sectors"}
                  aria-label={isIndustriesDrill ? "Back to all industries" : "Back to all sectors"}
                  className={topbarSquircleIconClass}
                >
                  <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
                </button>
                <h2 className="truncate text-[18px] font-semibold leading-6 text-[#09090B]">
                  {isIndustriesDrill && stocksIndustryFilter
                    ? stocksIndustryFilter.industry
                    : stocksSectorFilter}
                </h2>
              </div>
              <ScreenerCompaniesKeyStatToolbar
                selectedMetricId={companiesKeyStatMetricId}
                onSelectMetricId={selectCompaniesKeyStat}
                onReset={resetCompaniesKeyStat}
                disabled={companiesLoadingActive && companiesRowsResolved.length === 0}
              />
            </div>
          ) : null}
          <StocksTabBody
            stocksTotalCount={stocksTotalCount}
            companiesRows={companiesRowsResolved}
            companiesRemoteLoading={companiesLoadingActive}
            stocksSubTab={stocksSubTab}
            companiesPage={companiesPage}
            setCompaniesPage={setCompaniesPage}
            sectorsRows={sectorsRows}
            industriesRows={industriesRows}
            companiesKeyStatColumn={showCompaniesKeyStatToolbar ? companiesKeyStatColumn : null}
            companiesSectorFilter={stocksSectorFilter}
            companiesIndustryFilter={stocksIndustryFilter}
            onClearCompaniesSector={clearCompaniesSectorFilter}
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
          fearGreed={payload.fearGreed}
        />
      ) : null}
      {tab === "Indices" && payload.market === "indices" ? (
        <IndicesTabBody indicesRows={payload.indicesRows} />
      ) : null}
    </div>
  );
}
