"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompanyPick } from "@/components/charting/company-picker";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { chartingMetricToParam, type ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { parseStockDetailTabQuery } from "@/lib/stock/stock-detail-tab";
import { AssetPortfolioHoldingsTab } from "@/components/portfolio/asset-portfolio-holdings-tab";
import { StockDetailTabNav } from "./stock-detail-tab-nav";
import { MultichartsTabSkeleton } from "@/components/stock/stock-multicharts-tab-skeleton";
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
import { LatestNews } from "./latest-news";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockChartRange, StockChartSeries } from "@/lib/market/stock-chart-types";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";

/** Client-only: avoids SSR/client HTML drift for this tab (charts + evolving layout). */
const StockMultichartsTab = dynamic(
  () => import("./stock-multicharts-tab").then((m) => m.StockMultichartsTab),
  { ssr: false, loading: () => <MultichartsTabSkeleton /> },
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
    holdings: tab === "holdings",
    charting: tab === "charting",
    multicharts: tab === "multicharts",
    peers: tab === "peers",
    "target-price": tab === "target-price",
    earnings: tab === "earnings",
    insiders: tab === "insiders",
    profile: tab === "profile",
  };
}

function parseStockHeaderMetaPayload(json: {
  fullName?: unknown;
  logoUrl?: unknown;
  sector?: unknown;
  industry?: unknown;
  earningsDateDisplay?: unknown;
  watchlistCount?: unknown;
}): StockDetailHeaderMeta {
  return {
    fullName: typeof json.fullName === "string" ? json.fullName : null,
    logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : null,
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

  const openChartingWithMetric = useCallback(
    (id: ChartingMetricId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "charting");
      params.set("metric", chartingMetricToParam(id));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** 1D session series — drives header price / change (today / live window). */
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(EMPTY_CHART_DISPLAY);
  /** Visible overview chart: only range-drag selection overrides the session header. */
  const [rangeSelectionHeaderUi, setRangeSelectionHeaderUi] = useState<ChartDisplayState | null>(null);
  /** Holdings tab chart owns the header while that tab is active. */
  const [holdingsHeaderUi, setHoldingsHeaderUi] = useState<ChartDisplayState | null>(null);

  const onSessionHeaderDisplay = useCallback((s: ChartDisplayState) => {
    setSessionHeaderUi(s);
  }, []);

  const onRangeChartDisplay = useCallback((s: ChartDisplayState) => {
    if (s.selectionActive) setRangeSelectionHeaderUi(s);
    else setRangeSelectionHeaderUi(null);
  }, []);

  const onHoldingsChartDisplay = useCallback((s: ChartDisplayState) => {
    setHoldingsHeaderUi(s);
  }, []);

  const chartUi = useMemo((): ChartDisplayState => {
    if (activeTab === "holdings") {
      return holdingsHeaderUi ?? EMPTY_CHART_DISPLAY;
    }
    if (rangeSelectionHeaderUi?.selectionActive) {
      return rangeSelectionHeaderUi;
    }
    return sessionHeaderUi;
  }, [activeTab, holdingsHeaderUi, rangeSelectionHeaderUi, sessionHeaderUi]);

  const initialChartMemo = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.chart : null),
    [initialPageData, ticker],
  );

  /** Holdings tab uses its own area chart for the header; all other tabs use the overview price series. */
  const stockChartDrivesHeader = activeTab !== "holdings";

  return (
    <div className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
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
            onDisplayChange={stockChartDrivesHeader ? onRangeChartDisplay : undefined}
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
              onRevenueProfitMetricClick={openChartingWithMetric}
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
