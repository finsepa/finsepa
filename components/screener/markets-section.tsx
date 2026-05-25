"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { EtfTableRow } from "@/lib/screener/screener-etfs-universe";
import type { ScreenerPagePayload } from "@/lib/screener/screener-page-payload";
import {
  parseScreenerMarketTab,
  SCREENER_MARKET_QUERY,
  screenerMarketTabLabelFromParam,
  screenerMarketTabParamFromLabel,
} from "@/lib/screener/screener-market-url";
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
import {
  SCREENER_COMPANIES_PAGE_SIZE,
  SCREENER_CRYPTO_PAGE_SIZE,
  SCREENER_ETFS_PAGE_SIZE,
  SCREENER_INDICES_PAGE_SIZE,
} from "@/lib/screener/screener-markets-page-size";
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
import { EtfsTable } from "@/components/screener/etfs-table";
import { IndicesTable } from "@/components/screener/indices-table";
import {
  ScreenerMarketTabSkeleton,
  StocksGainersLosersSkeleton,
  StocksTableSkeleton,
} from "@/components/markets/markets-skeletons";
import { ScreenerPagination } from "@/components/ui/table-pagination";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { CryptoFearGreedCard } from "@/components/screener/crypto-fear-greed-card";
import { CryptoLargestMoversCard } from "@/components/screener/crypto-largest-movers-card";
import {
  cryptoMoverFallbackRows,
  withCryptoMoverLocalFallbacks,
} from "@/lib/screener/screener-crypto-mover-fallbacks";
import { CryptoFearGreedModal } from "@/components/screener/crypto-fear-greed-modal";
import type { CryptoFearGreedIndex } from "@/lib/market/alternative-fear-greed";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";

/** Rows per list on the Stocks → Gainers & Losers sub-tab. */
const GAINERS_LOSERS_TOP_N = 10;

function marketTabFromUrl(searchParams: URLSearchParams): MarketTab {
  return screenerMarketTabLabelFromParam(parseScreenerMarketTab(searchParams.get(SCREENER_MARKET_QUERY)));
}

function StocksTabBody({
  stocksTotalCount,
  companiesRows,
  companiesRemoteLoading,
  stocksSubTab,
  gainersLosersLoading,
  companiesPage,
  setCompaniesPage,
  sectorsRows,
  industriesRows,
  companiesKeyStatColumns,
  companiesSectorFilter,
  companiesIndustryFilter,
  onClearCompaniesSector,
}: {
  stocksTotalCount: number;
  companiesRows: ScreenerTableRow[];
  companiesRemoteLoading: boolean;
  stocksSubTab: StocksSubTab;
  gainersLosersLoading: boolean;
  companiesPage: number;
  setCompaniesPage: (u: number | ((p: number) => number)) => void;
  sectorsRows: ScreenerSectorRow[];
  industriesRows: ScreenerIndustryRow[];
  companiesKeyStatColumns: ScreenerTableKeyStatColumn[];
  companiesSectorFilter: ScreenerCanonicalSector | null;
  companiesIndustryFilter: ScreenerIndustryDrill | null;
  onClearCompaniesSector: () => void;
}) {
  const companiesPageSize = SCREENER_COMPANIES_PAGE_SIZE;
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
            <StocksTableSkeleton rows={SCREENER_COMPANIES_PAGE_SIZE} />
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
              keyStatColumns={companiesKeyStatColumns}
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
      ) : gainersLosersLoading && companiesRows.length === 0 ? (
        <StocksGainersLosersSkeleton rows={GAINERS_LOSERS_TOP_N} />
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
  const pageSize = SCREENER_CRYPTO_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(cryptoTotalCount / pageSize));
  const safeCryptoPage = Math.min(totalPages, Math.max(1, cryptoPage));

  const [fearGreedModalOpen, setFearGreedModalOpen] = useState(false);
  const [cryptoTop10Rows, setCryptoTop10Rows] = useState<CryptoTop10Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/screener/crypto-top10", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { rows?: CryptoTop10Row[] } | null) => {
        if (cancelled) return;
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        setCryptoTop10Rows(rows.length > 0 ? rows : cryptoMoverFallbackRows());
      })
      .catch(() => {
        if (!cancelled) setCryptoTop10Rows(cryptoMoverFallbackRows());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const movers = useMemo(() => {
    const source =
      cryptoTop10Rows.length > 0
        ? withCryptoMoverLocalFallbacks(cryptoTop10Rows)
        : withCryptoMoverLocalFallbacks(
            cryptoRowsResolved.length > 0 ? cryptoRowsResolved : cryptoMoverFallbackRows(),
          );
    const valid = source.filter((r) => r.changePercent1D != null && Number.isFinite(r.changePercent1D));
    const gainers = [...valid].sort((a, b) => (b.changePercent1D ?? 0) - (a.changePercent1D ?? 0));
    const losers = [...valid].sort((a, b) => (a.changePercent1D ?? 0) - (b.changePercent1D ?? 0));
    return { gainers, losers };
  }, [cryptoTop10Rows, cryptoRowsResolved]);

  return (
    <div>
      <div className="mb-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4">
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

function EtfsTabBody({ etfsRows }: { etfsRows: EtfTableRow[] }) {
  return (
    <div>
      <EtfsTable initialRows={etfsRows} />
    </div>
  );
}

function IndicesTabBody({ indicesRows }: { indicesRows: IndexTableRow[] }) {
  const [indicesPage, setIndicesPage] = useState(1);
  const pageSize = SCREENER_INDICES_PAGE_SIZE;
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
  const urlTab = useMemo(() => marketTabFromUrl(searchParams), [searchParams]);
  const [displayTab, setDisplayTab] = useState<MarketTab>(urlTab);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDisplayTab(urlTab);
  }, [urlTab]);

  const payloadMarket = payload.market;
  const contentReady = screenerMarketTabParamFromLabel(displayTab) === payloadMarket;

  const setMarketTab = useCallback(
    (next: MarketTab) => {
      if (next === displayTab) return;
      setDisplayTab(next);
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === "Stocks") {
          params.delete(SCREENER_MARKET_QUERY);
        } else {
          params.set(SCREENER_MARKET_QUERY, screenerMarketTabParamFromLabel(next));
        }
        if (next !== "Stocks") {
          params.delete(SCREENER_SECTOR_QUERY);
          params.delete(SCREENER_INDUSTRY_QUERY);
          params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
          params.delete(SCREENER_STOCKS_SUB_TAB_QUERY);
        }
        const q = params.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      });
    },
    [displayTab, pathname, router, searchParams],
  );

  const urlStocksSubTab = useMemo((): StocksSubTab => {
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
  const [displayStocksSubTab, setDisplayStocksSubTab] = useState<StocksSubTab>(urlStocksSubTab);
  const [, startStocksSubTabTransition] = useTransition();

  useEffect(() => {
    setDisplayStocksSubTab(urlStocksSubTab);
  }, [urlStocksSubTab]);

  const [companiesPage, setCompaniesPage] = useState(1);
  const [fetchedCompanyPages, setFetchedCompanyPages] = useState<Record<number, ScreenerTableRow[]>>({});
  const [companiesRemoteLoading, setCompaniesRemoteLoading] = useState(false);
  const [gainersLosersRows, setGainersLosersRows] = useState<ScreenerTableRow[] | null>(null);
  const [gainersLosersLoading, setGainersLosersLoading] = useState(false);
  const [cryptoPage, setCryptoPage] = useState(1);
  const [fetchedCryptoPages, setFetchedCryptoPages] = useState<Record<number, CryptoTop10Row[]>>({});
  const [cryptoRemoteLoading, setCryptoRemoteLoading] = useState(false);
  const [companiesKeyStatMetricIds, setCompaniesKeyStatMetricIds] = useState<string[]>([]);
  const [companiesKeyStatValuesByMetric, setCompaniesKeyStatValuesByMetric] = useState<
    Record<string, Record<string, string>>
  >({});
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
      if (next === displayStocksSubTab) return;
      setDisplayStocksSubTab(next);
      startStocksSubTabTransition(() => {
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
      });
    },
    [displayStocksSubTab, pathname, router, searchParams],
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
      setCompaniesKeyStatMetricIds([]);
      setCompaniesKeyStatValuesByMetric({});
      setCompaniesKeyStatLoading(false);
    });
    return () => cancelAnimationFrame(id);
  }, [payload.market]);

  const companiesRowsForTable = useMemo(() => {
    if (payload.market !== "stocks") return [];
    if (companiesPage <= 1) return stockRows;
    return fetchedCompanyPages[companiesPage] ?? [];
  }, [payload.market, companiesPage, stockRows, fetchedCompanyPages]);

  const isSectorsDrill = urlStocksSubTab === "Sectors" && stocksSectorFilter != null;
  const isIndustriesDrill = urlStocksSubTab === "Industries" && stocksIndustryFilter != null;
  const isStocksDrill = isSectorsDrill || isIndustriesDrill;
  const companiesListPaginationActive =
    displayStocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

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
      `/api/screener/companies?page=${companiesPage}&pageSize=${SCREENER_COMPANIES_PAGE_SIZE}${sectorQs}${industryQs}`,
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
    if (displayStocksSubTab !== "Gainers & Losers") return;
    if (gainersLosersRows) return;

    let cancelled = false;
    const loadId = requestAnimationFrame(() => {
      if (!cancelled) setGainersLosersLoading(true);
    });
    fetch(`/api/screener/companies?gainersLosers=1`)
      .then((r) => r.json())
      .then((data: { rows?: ScreenerTableRow[] }) => {
        if (cancelled) return;
        setGainersLosersRows(data.rows ?? []);
      })
      .finally(() => {
        if (!cancelled) setGainersLosersLoading(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(loadId);
    };
  }, [payload.market, displayStocksSubTab, gainersLosersRows]);

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
    fetch(`/api/screener/crypto-rows?page=${cryptoPage}&pageSize=${SCREENER_CRYPTO_PAGE_SIZE}`)
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
    if (displayStocksSubTab === "Gainers & Losers") {
      return gainersLosersRows ?? [];
    }
    return companiesRowsForTable;
  }, [payload.market, displayStocksSubTab, gainersLosersRows, companiesRowsForTable]);

  const companiesTickerKey = useMemo(
    () => companiesRowsResolved.map((r) => r.ticker.trim().toUpperCase()).join("\u001f"),
    [companiesRowsResolved],
  );

  const companiesKeyStatTabActive =
    displayStocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

  const companiesKeyStatMetricKey = companiesKeyStatMetricIds.join("\u001f");

  useEffect(() => {
    if (payload.market !== "stocks" || !companiesKeyStatTabActive || !companiesKeyStatMetricIds.length) {
      if (!companiesKeyStatMetricIds.length) {
        setCompaniesKeyStatValuesByMetric({});
        setCompaniesKeyStatLoading(false);
      }
      return;
    }
    const tickers = companiesTickerKey.split("\u001f").filter(Boolean);
    if (!tickers.length) return;

    let cancelled = false;
    setCompaniesKeyStatLoading(true);
    Promise.all(
      companiesKeyStatMetricIds.map(async (metricId) => {
        const res = await fetch("/api/screener/companies-key-stat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers, metricId }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Request failed");
        const data = (await res.json()) as { values?: Record<string, string> };
        return { metricId, values: data.values ?? {} };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const byMetric: Record<string, Record<string, string>> = {};
        for (const { metricId, values } of results) {
          byMetric[metricId] = values;
        }
        setCompaniesKeyStatValuesByMetric(byMetric);
      })
      .catch(() => {
        if (!cancelled) setCompaniesKeyStatValuesByMetric({});
      })
      .finally(() => {
        if (!cancelled) setCompaniesKeyStatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payload.market, companiesKeyStatTabActive, companiesKeyStatMetricKey, companiesTickerKey, companiesKeyStatMetricIds]);

  const resetCompaniesKeyStat = useCallback(() => {
    setCompaniesKeyStatMetricIds([]);
    setCompaniesKeyStatValuesByMetric({});
    setCompaniesKeyStatLoading(false);
  }, []);

  const toggleCompaniesKeyStat = useCallback((id: string) => {
    if (isScreenerBuiltinTableMetricId(id)) return;
    setCompaniesKeyStatMetricIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const companiesKeyStatMetricIdSet = useMemo(
    () => new Set(companiesKeyStatMetricIds),
    [companiesKeyStatMetricIds],
  );

  const companiesKeyStatColumns = useMemo((): ScreenerTableKeyStatColumn[] => {
    return companiesKeyStatMetricIds
      .map((id) => {
        const def = getScreenerKeyStatMetricById(id);
        if (!def) return null;
        return {
          header: def.label,
          valuesByTicker: companiesKeyStatValuesByMetric[id] ?? {},
          loading: companiesKeyStatLoading,
        };
      })
      .filter((col): col is ScreenerTableKeyStatColumn => col != null);
  }, [companiesKeyStatMetricIds, companiesKeyStatValuesByMetric, companiesKeyStatLoading]);

  const companiesLoadingActive = awaitingRemoteCompanies || companiesRemoteLoading;
  const cryptoLoadingActive = awaitingRemoteCrypto || cryptoRemoteLoading;

  const showCompaniesKeyStatToolbar =
    displayStocksSubTab === "Companies" || isSectorsDrill || isIndustriesDrill;

  return (
    <div className="min-w-0 w-full max-w-full">
      <MarketTabs
        active={displayTab}
        onChange={setMarketTab}
        trailing={<UsMarketsSessionLabel className="hidden md:inline-flex" />}
      />

      {!contentReady ? (
        <ScreenerMarketTabSkeleton tab={displayTab} />
      ) : displayTab === "Stocks" && payload.market === "stocks" ? (
        <>
          <UsMarketsSessionLabel className="mb-3 flex md:hidden" />
          <IndexCards initialCards={payload.indexCards} />
          {!isStocksDrill ? (
            <div className="mb-5 flex min-w-0 w-full max-w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <ScreenerTabs active={displayStocksSubTab} onChange={setStocksSubTabWithUrl} />
              {showCompaniesKeyStatToolbar ? (
                <ScreenerCompaniesKeyStatToolbar
                  selectedMetricIds={companiesKeyStatMetricIdSet}
                  onToggleMetricId={toggleCompaniesKeyStat}
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
                selectedMetricIds={companiesKeyStatMetricIdSet}
                onToggleMetricId={toggleCompaniesKeyStat}
                onReset={resetCompaniesKeyStat}
                disabled={companiesLoadingActive && companiesRowsResolved.length === 0}
              />
            </div>
          ) : null}
          <StocksTabBody
            stocksTotalCount={stocksTotalCount}
            companiesRows={companiesRowsResolved}
            companiesRemoteLoading={companiesLoadingActive}
            stocksSubTab={displayStocksSubTab}
            gainersLosersLoading={gainersLosersLoading}
            companiesPage={companiesPage}
            setCompaniesPage={setCompaniesPage}
            sectorsRows={sectorsRows}
            industriesRows={industriesRows}
            companiesKeyStatColumns={showCompaniesKeyStatToolbar ? companiesKeyStatColumns : []}
            companiesSectorFilter={stocksSectorFilter}
            companiesIndustryFilter={stocksIndustryFilter}
            onClearCompaniesSector={clearCompaniesSectorFilter}
          />
        </>
      ) : displayTab === "Crypto" && payload.market === "crypto" ? (
        <CryptoTabBody
          cryptoTotalCount={cryptoTotalCount}
          cryptoPage={cryptoPage}
          setCryptoPage={setCryptoPage}
          cryptoRowsResolved={cryptoRowsForTable}
          cryptoRemoteLoading={cryptoLoadingActive}
          fearGreed={payload.fearGreed}
        />
      ) : displayTab === "Indices" && payload.market === "indices" ? (
        <IndicesTabBody indicesRows={payload.indicesRows} />
      ) : displayTab === "ETF's" && payload.market === "etfs" ? (
        <EtfsTabBody etfsRows={payload.etfsRows} />
      ) : null}
    </div>
  );
}
