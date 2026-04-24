"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompanyPick } from "@/components/charting/company-picker";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { parseStockDetailTabQuery } from "@/lib/stock/stock-detail-tab";
import { AssetPortfolioHoldingsTab } from "@/components/portfolio/asset-portfolio-holdings-tab";
import { StockDetailTabNav } from "./stock-detail-tab-nav";
import { MultichartsTabSkeleton, MultichartsTabSkeletonGrid } from "@/components/stock/stock-multicharts-tab-skeleton";
import { StockChartingTab } from "./stock-charting-tab";
import { StockEarningsTab } from "./stock-earnings-tab";
import { StockInsidersTab } from "./stock-insiders-tab";
import { StockPeersTab } from "./stock-peers-tab";
import { StockProfileTab } from "./stock-profile-tab";
import { StockTargetPriceTab } from "./stock-target-price-tab";
import { StockHeader } from "./stock-header";
import { ChartControls } from "./chart-controls";
import { MiniTable } from "./mini-table";
import { StockComparePicker } from "./stock-compare-picker";
import { StockCompareReturnChart } from "./stock-compare-return-chart";
import { KeyStats } from "./key-stats";
import { KeyStatsMetricChartModal } from "./key-stats-metric-chart-modal";
import { LatestNews } from "./latest-news";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockChartRange, StockChartSeries } from "@/lib/market/stock-chart-types";
import { mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";

/** Client-only: avoids SSR/client HTML drift for this tab (charts + evolving layout). */
const StockMultichartsTab = dynamic(
  () => import("./stock-multicharts-tab").then((m) => m.StockMultichartsTab),
  { ssr: false, loading: () => <MultichartsTabSkeleton /> },
);

const StockFinancialsTab = dynamic(
  () => import("./stock-financials-tab").then((m) => m.StockFinancialsTab),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6 pt-1">
        <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Financials</h2>
        <MultichartsTabSkeletonGrid />
      </div>
    ),
  },
);

const EMPTY_CHART_DISPLAY: ChartDisplayState = {
  loading: true,
  empty: true,
  displayPrice: null,
  displayChangePct: null,
  displayChangeAbs: null,
  selectionChangeAbs: null,
  selectionChangePct: null,
  isHovering: false,
  selectionActive: false,
  periodLabelOverride: null,
  priceTimestampLabel: null,
};

/** Offscreen mount so lightweight-charts + `onDisplayChange` stay active without affecting layout. */
const OFFSCREEN_PRICE_CHART =
  "pointer-events-none fixed left-0 top-0 -z-10 h-[320px] w-[min(1200px,calc(100vw-2rem))] -translate-x-[120vw] opacity-0 sm:w-[min(1200px,calc(100vw-4.5rem))]";

function initialTabsMounted(tab: StockDetailTabId): Record<StockDetailTabId, boolean> {
  return {
    overview: tab === "overview",
    financials: tab === "financials",
    earnings: tab === "earnings",
    multicharts: tab === "multicharts",
    "target-price": tab === "target-price",
    insiders: tab === "insiders",
    charting: tab === "charting",
    peers: tab === "peers",
    holdings: tab === "holdings",
    profile: tab === "profile",
  };
}

function parseStockHeaderMetaPayload(json: {
  fullName?: unknown;
  logoUrl?: unknown;
  exchange?: unknown;
  sector?: unknown;
  industry?: unknown;
  earningsDateDisplay?: unknown;
  watchlistCount?: unknown;
}): StockDetailHeaderMeta {
  return {
    fullName: typeof json.fullName === "string" ? json.fullName : null,
    logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : null,
    exchange: typeof json.exchange === "string" ? json.exchange : null,
    sector: typeof json.sector === "string" ? json.sector : null,
    industry: typeof json.industry === "string" ? json.industry : null,
    earningsDateDisplay: typeof json.earningsDateDisplay === "string" ? json.earningsDateDisplay : null,
    watchlistCount: typeof json.watchlistCount === "number" ? json.watchlistCount : null,
  };
}

export function StockPageContent({
  routeTicker,
  initialPageData,
  initialActiveTab = "overview",
}: {
  routeTicker?: string;
  initialPageData?: StockPageInitialData | null;
  /** From server `searchParams.tab` — `useSearchParams()` is often empty during SSR; this keeps the first paint aligned. */
  initialActiveTab?: StockDetailTabId;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevTickerRef = useRef<string | null>(null);

  const [range, setRange] = useState<StockChartRange>("1Y");
  const [chartSeries, setChartSeries] = useState<StockChartSeries>("price");
  const [comparePicks, setComparePicks] = useState<CompanyPick[]>([]);
  const chartSeriesBeforeCompareRef = useRef<StockChartSeries>("price");
  const comparePicksRef = useRef<CompanyPick[]>([]);
  comparePicksRef.current = comparePicks;
  const ticker = (routeTicker?.trim() ? routeTicker.trim() : "AAPL").toUpperCase();

  /** URL tab from the client router — applied after mount so the first paint matches SSR (`initialActiveTab`). */
  const [searchSyncedTab, setSearchSyncedTab] = useState<StockDetailTabId | null>(null);
  const [tabsMounted, setTabsMounted] = useState<Record<StockDetailTabId, boolean>>(() =>
    initialTabsMounted(initialActiveTab),
  );

  useEffect(() => {
    const next = parseStockDetailTabQuery(searchParams.get("tab")) ?? initialActiveTab;
    queueMicrotask(() => {
      setSearchSyncedTab(next);
      setTabsMounted((m) => ({ ...m, [next]: true }));
    });
  }, [searchParams, initialActiveTab]);

  const activeTab: StockDetailTabId = searchSyncedTab ?? initialActiveTab;
  const chartingMetricParam = searchParams.get("metric");

  const serverHeader =
    initialPageData?.ticker === ticker ? initialPageData.headerMeta : null;
  const [headerMeta, setHeaderMeta] = useState<StockDetailHeaderMeta | null>(serverHeader);
  const [headerMetaLoading, setHeaderMetaLoading] = useState(!serverHeader);

  const refetchHeaderMeta = useCallback(async () => {
    setHeaderMetaLoading(true);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/header-meta`, { cache: "no-store" });
      if (!res.ok) {
        setHeaderMeta(null);
        return;
      }
      const json = (await res.json()) as Parameters<typeof parseStockHeaderMetaPayload>[0];
      setHeaderMeta(parseStockHeaderMetaPayload(json));
    } catch {
      setHeaderMeta(null);
    } finally {
      setHeaderMetaLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    // Keep header meta stable after navigation (SSR provides it).
    // Only refetch when the watchlist mutates for this ticker.
    if (initialPageData?.ticker === ticker && initialPageData.headerMeta) {
      setHeaderMeta(initialPageData.headerMeta);
      setHeaderMetaLoading(false);
      return;
    }
    setHeaderMeta(serverHeader);
    setHeaderMetaLoading(!serverHeader);
  }, [ticker, initialPageData?.ticker, initialPageData?.headerMeta, serverHeader]);

  useEffect(() => {
    const onMut = (e: Event) => {
      const t = (e as CustomEvent<{ ticker?: string }>).detail?.ticker?.trim().toUpperCase();
      if (t && t === ticker) void refetchHeaderMeta();
    };
    window.addEventListener(WATCHLIST_MUTATED_EVENT, onMut);
    return () => window.removeEventListener(WATCHLIST_MUTATED_EVENT, onMut);
  }, [ticker, refetchHeaderMeta]);

  useEffect(() => {
    if (prevTickerRef.current === null) {
      prevTickerRef.current = ticker;
      return;
    }
    if (prevTickerRef.current !== ticker) {
      prevTickerRef.current = ticker;
      router.replace(pathname, { scroll: false });
    }
  }, [ticker, pathname, router]);

  useEffect(() => {
    if (comparePicksRef.current.length > 0) {
      setChartSeries(chartSeriesBeforeCompareRef.current);
    }
    setComparePicks([]);
  }, [ticker]);

  const onAddComparePick = useCallback(
    (pick: CompanyPick) => {
      const sym = pick.symbol.trim().toUpperCase();
      if (sym === ticker) return;
      setComparePicks((cur) => {
        if (cur.some((c) => c.symbol.trim().toUpperCase() === sym)) return cur;
        if (cur.length === 0) chartSeriesBeforeCompareRef.current = chartSeries;
        return [...cur, { symbol: sym, name: pick.name?.trim() || sym }];
      });
      setChartSeries("return");
    },
    [chartSeries, ticker],
  );

  const onRemoveComparePick = useCallback((symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    setComparePicks((cur) => {
      const next = cur.filter((c) => c.symbol.trim().toUpperCase() !== sym);
      if (next.length === 0) {
        queueMicrotask(() => setChartSeries(chartSeriesBeforeCompareRef.current));
      }
      return next;
    });
  }, []);

  const setTabInUrl = useCallback(
    (tab: StockDetailTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
        params.delete("metric");
      } else {
        params.set("tab", tab);
        if (tab !== "charting") params.delete("metric");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [revenueProfitModalMetric, setRevenueProfitModalMetric] = useState<ChartingMetricId | null>(null);
  const openRevenueProfitMetricModal = useCallback((metricId: ChartingMetricId) => {
    setRevenueProfitModalMetric(metricId);
  }, []);

  const fundamentalsModalAnnual = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesAnnual : undefined),
    [initialPageData, ticker],
  );
  const fundamentalsModalQuarterly = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesQuarterly : undefined),
    [initialPageData, ticker],
  );

  /** 1D session series — drives header price / change (today / live window). */
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(EMPTY_CHART_DISPLAY);
  /** Holdings tab chart owns the header while that tab is active. */
  const [holdingsHeaderUi, setHoldingsHeaderUi] = useState<ChartDisplayState | null>(null);

  const onSessionHeaderDisplay = useCallback((s: ChartDisplayState) => {
    setSessionHeaderUi(s);
  }, []);

  const onHoldingsChartDisplay = useCallback((s: ChartDisplayState) => {
    setHoldingsHeaderUi(s);
  }, []);

  const performanceFromServer = useMemo(
    (): StockPerformance | null =>
      initialPageData?.ticker === ticker ? (initialPageData.performance ?? null) : null,
    [initialPageData, ticker],
  );

  const [performanceClient, setPerformanceClient] = useState<StockPerformance | null>(null);

  /** Phase 7: intraday-aligned spot; client poll refines SSR `headerLiveSpotUsd` for signed-in users. */
  const [headerLiveSpotClient, setHeaderLiveSpotClient] = useState<number | null>(null);

  useEffect(() => {
    setHeaderLiveSpotClient(null);
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/live-price`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { price?: unknown };
        const p = json.price;
        if (typeof p === "number" && Number.isFinite(p) && p > 0 && !cancelled) setHeaderLiveSpotClient(p);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ticker]);

  useEffect(() => {
    setPerformanceClient(null);
    if (performanceFromServer?.price != null && Number.isFinite(performanceFromServer.price)) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/performance`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as StockPerformance;
        if (!cancelled) setPerformanceClient(json);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker, performanceFromServer?.price]);

  const performanceForHeaderFallback = performanceFromServer ?? performanceClient;

  const headerLiveSpotForMerge =
    headerLiveSpotClient ??
    (initialPageData?.ticker === ticker ? (initialPageData.headerLiveSpotUsd ?? null) : null);

  const chartUi = useMemo((): ChartDisplayState => {
    if (activeTab === "holdings") {
      return holdingsHeaderUi ?? EMPTY_CHART_DISPLAY;
    }
    return mergeSessionHeaderWithPerformanceSpot(
      sessionHeaderUi,
      performanceForHeaderFallback,
      chartSeries,
      headerLiveSpotForMerge,
    );
  }, [
    activeTab,
    chartSeries,
    headerLiveSpotForMerge,
    holdingsHeaderUi,
    performanceForHeaderFallback,
    sessionHeaderUi,
  ]);

  const initialChartMemo = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.chart : null),
    [initialPageData, ticker],
  );

  /** Holdings tab uses its own area chart for the header; all other tabs use the overview price series. */
  const stockChartDrivesHeader = activeTab !== "holdings";

  return (
    <div className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
      <KeyStatsMetricChartModal
        key={revenueProfitModalMetric ?? "closed"}
        ticker={ticker}
        metricId={revenueProfitModalMetric}
        onClose={() => setRevenueProfitModalMetric(null)}
        initialAnnualPoints={fundamentalsModalAnnual}
        initialQuarterlyPoints={fundamentalsModalQuarterly}
        headerMeta={headerMeta}
      />
      <Suspense fallback={null}>
        <AssetPageTopLoader />
      </Suspense>
      <StockHeader
        ticker={ticker}
        periodLabel={activeTab === "holdings" ? range : "Today"}
        periodLabelOverride={chartUi.periodLabelOverride}
        chartRangeLabel={range}
        price={chartUi.displayPrice}
        changePct={chartUi.displayChangePct}
        changeAbs={chartUi.displayChangeAbs}
        selectionChangeAbs={chartUi.selectionChangeAbs}
        selectionChangePct={chartUi.selectionChangePct}
        chartLoading={chartUi.loading}
        chartEmpty={chartUi.empty}
        priceTimestampLabel={chartUi.priceTimestampLabel}
        chartHovering={chartUi.isHovering && !chartUi.selectionActive}
        headerMeta={headerMeta}
        headerMetaLoading={headerMetaLoading}
        headerChartMetric={comparePicks.length > 0 ? "price" : chartSeries}
      />

      <StockDetailTabNav activeTab={activeTab} onTabChange={setTabInUrl} />

      {/*
        Overview price chart must stay mounted when other tabs are open — `hidden` on the tabpanel
        skips mount on deep links (e.g. ?tab=insiders), which left the header stuck on "Loading…".
        Offscreen + opacity-0 keeps layout engines and `onDisplayChange` alive without showing the chart.
      */}
      <div
        className={
          activeTab === "overview"
            ? "space-y-5"
            : "pointer-events-none fixed left-0 top-0 -z-10 h-[420px] w-[min(1200px,calc(100vw-4.5rem))] -translate-x-[120vw] opacity-0"
        }
        aria-hidden={activeTab !== "overview"}
      >
        {activeTab === "overview" ? (
          <ChartControls
            activeRange={range}
            onRangeChange={setRange}
            chartSeries={chartSeries}
            onChartSeriesChange={setChartSeries}
            seriesSelectDisabled={comparePicks.length > 0}
            compareSlot={
              <StockComparePicker baseTicker={ticker} values={comparePicks} onAdd={onAddComparePick} onRemove={onRemoveComparePick} />
            }
          />
        ) : null}
        {comparePicks.length > 0 ? (
          <StockCompareReturnChart
            key={`compare-${ticker}-${comparePicks.map((p) => p.symbol.trim().toUpperCase()).join("-")}-${range}`}
            primaryTicker={ticker}
            comparePicks={comparePicks}
            range={range}
          />
        ) : (
          <PriceChart
            key={`stock-overview-${ticker}-${chartSeries}`}
            kind="stock"
            symbol={ticker}
            range={range}
            series={chartSeries}
            initialChart={initialChartMemo}
          />
        )}
        {stockChartDrivesHeader ? (
          <div className={OFFSCREEN_PRICE_CHART} aria-hidden>
            <PriceChart
              key={`${ticker}-${comparePicks.length > 0 ? "price" : chartSeries}-header-1d`}
              kind="stock"
              symbol={ticker}
              range="1D"
              series={comparePicks.length > 0 ? "price" : chartSeries}
              height={320}
              onDisplayChange={onSessionHeaderDisplay}
            />
          </div>
        ) : null}
      </div>

      {tabsMounted.overview ? (
        <div
          role="tabpanel"
          id="stock-tab-overview"
          aria-hidden={activeTab !== "overview"}
          className={activeTab === "overview" ? "space-y-5" : "hidden"}
        >
          <MiniTable
            ticker={ticker}
            headerMeta={headerMeta}
            headerMetaLoading={headerMetaLoading}
            initialPerformance={initialPageData?.ticker === ticker ? initialPageData.performance : null}
            comparePicks={comparePicks}
            onRemoveCompare={comparePicks.length > 0 ? onRemoveComparePick : undefined}
          />
          <div className="pt-2">
            <KeyStats
              ticker={ticker}
              initialBundle={initialPageData?.ticker === ticker ? initialPageData.keyStatsBundle : null}
              onOpenMetricChart={openRevenueProfitMetricModal}
            />
          </div>
          <div className="pt-2">
            <LatestNews
              ticker={ticker}
              initialItems={initialPageData?.ticker === ticker ? initialPageData.news : undefined}
            />
          </div>
        </div>
      ) : null}

      {tabsMounted.financials ? (
        <div
          role="tabpanel"
          id="stock-tab-financials"
          aria-hidden={activeTab !== "financials"}
          className={activeTab === "financials" ? "block" : "hidden"}
        >
          <StockFinancialsTab
            ticker={ticker}
            initialAnnualPoints={initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesAnnual : undefined}
          />
        </div>
      ) : null}

      {tabsMounted.earnings ? (
        <div
          role="tabpanel"
          id="stock-tab-earnings"
          aria-hidden={activeTab !== "earnings"}
          className={activeTab === "earnings" ? "block" : "hidden"}
        >
          <StockEarningsTab ticker={ticker} />
        </div>
      ) : null}

      {tabsMounted.multicharts ? (
        <div
          role="tabpanel"
          id="stock-tab-multicharts"
          aria-hidden={activeTab !== "multicharts"}
          className={activeTab === "multicharts" ? "block" : "hidden"}
        >
          <StockMultichartsTab
            ticker={ticker}
            initialAnnualPoints={initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesAnnual : undefined}
            initialQuarterlyPoints={
              initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesQuarterly : undefined
            }
            onOpenMetricChart={openRevenueProfitMetricModal}
          />
        </div>
      ) : null}

      {tabsMounted["target-price"] ? (
        <div
          role="tabpanel"
          id="stock-tab-target-price"
          aria-hidden={activeTab !== "target-price"}
          className={activeTab === "target-price" ? "block" : "hidden"}
        >
          <div className="w-full min-w-0">
            <StockTargetPriceTab ticker={ticker} />
          </div>
        </div>
      ) : null}

      {tabsMounted.insiders ? (
        <div
          role="tabpanel"
          id="stock-tab-insiders"
          aria-hidden={activeTab !== "insiders"}
          className={activeTab === "insiders" ? "block" : "hidden"}
        >
          <StockInsidersTab ticker={ticker} />
        </div>
      ) : null}

      {tabsMounted.charting ? (
        <div
          role="tabpanel"
          id="stock-tab-charting"
          aria-hidden={activeTab !== "charting"}
          className={activeTab === "charting" ? "block" : "hidden"}
        >
          <StockChartingTab
            ticker={ticker}
            metricParam={chartingMetricParam}
            initialAnnualPoints={initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesAnnual : undefined}
            initialQuarterlyPoints={
              initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesQuarterly : undefined
            }
            initialKeyStatsBundle={initialPageData?.ticker === ticker ? initialPageData.keyStatsBundle : null}
          />
        </div>
      ) : null}

      {tabsMounted.peers ? (
        <div
          role="tabpanel"
          id="stock-tab-peers"
          aria-hidden={activeTab !== "peers"}
          className={activeTab === "peers" ? "block" : "hidden"}
        >
          <StockPeersTab
            ticker={ticker}
            initialCompareRows={initialPageData?.ticker === ticker ? initialPageData.peersCompareRows : undefined}
          />
        </div>
      ) : null}

      {tabsMounted.holdings ? (
        <div
          role="tabpanel"
          id="stock-tab-holdings"
          aria-hidden={activeTab !== "holdings"}
          className={activeTab === "holdings" ? "block" : "hidden"}
        >
          <AssetPortfolioHoldingsTab
            assetKind="stock"
            routeKey={ticker}
            assetDisplayName={headerMeta?.fullName ?? ticker}
            onChartDisplayChange={onHoldingsChartDisplay}
          />
        </div>
      ) : null}

      {tabsMounted.profile ? (
        <div
          role="tabpanel"
          id="stock-tab-profile"
          aria-hidden={activeTab !== "profile"}
          className={activeTab === "profile" ? "block" : "hidden"}
        >
          <StockProfileTab
            ticker={ticker}
            initialProfile={initialPageData?.ticker === ticker ? initialPageData.profile : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
