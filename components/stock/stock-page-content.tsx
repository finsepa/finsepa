"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { chartingMetricToParam, type ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { parseStockDetailTabQuery } from "@/lib/stock/stock-detail-tab";
import { StockDetailTabNav } from "./stock-detail-tab-nav";
import { AssetPortfolioHoldingsTab } from "@/components/portfolio/asset-portfolio-holdings-tab";

function initialTabsMounted(tab: StockDetailTabId): Record<StockDetailTabId, boolean> {
  return {
    overview: tab === "overview",
    holdings: tab === "holdings",
    charting: tab === "charting",
    peers: tab === "peers",
    profile: tab === "profile",
  };
}
import { StockChartingTab } from "./stock-charting-tab";
import { StockPeersTab } from "./stock-peers-tab";
import { StockProfileTab } from "./stock-profile-tab";
import { StockHeader } from "./stock-header";
import { ChartControls } from "./chart-controls";
import { MiniTable } from "./mini-table";
import { KeyStats } from "./key-stats";
import { LatestNews } from "./latest-news";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockChartRange, StockChartSeries } from "@/lib/market/stock-chart-types";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";

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
  const ticker = (routeTicker?.trim() ? routeTicker.trim() : "AAPL").toUpperCase();

  const activeTab: StockDetailTabId =
    parseStockDetailTabQuery(searchParams.get("tab")) ?? initialActiveTab;
  const chartingMetricParam = searchParams.get("metric");

  const [tabsMounted, setTabsMounted] = useState<Record<StockDetailTabId, boolean>>(() => initialTabsMounted(activeTab));

  useEffect(() => {
    setTabsMounted((m) => ({ ...m, [activeTab]: true }));
  }, [activeTab]);

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

  const [chartUi, setChartUi] = useState<ChartDisplayState>({
    loading: true,
    empty: true,
    displayPrice: null,
    displayChangePct: null,
    displayChangeAbs: null,
    isHovering: false,
    selectionActive: false,
    periodLabelOverride: null,
    priceTimestampLabel: null,
  });

  const onChartDisplay = useCallback((s: ChartDisplayState) => {
    setChartUi(s);
  }, []);

  const initialChartMemo = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.chart : null),
    [initialPageData, ticker],
  );

  return (
    <div className="relative space-y-5 px-9 py-6">
      <Suspense fallback={null}>
        <AssetPageTopLoader />
      </Suspense>
      <StockHeader
        ticker={ticker}
        periodLabel={range}
        periodLabelOverride={chartUi.periodLabelOverride}
        price={chartUi.displayPrice}
        changePct={chartUi.displayChangePct}
        changeAbs={chartUi.displayChangeAbs}
        chartLoading={chartUi.loading}
        chartEmpty={chartUi.empty}
        priceTimestampLabel={chartUi.priceTimestampLabel}
        chartHovering={chartUi.isHovering && !chartUi.selectionActive}
        headerMeta={headerMeta}
        headerMetaLoading={headerMetaLoading}
        headerChartMetric={chartSeries}
      />

      <StockDetailTabNav activeTab={activeTab} onTabChange={setTabInUrl} />

      {tabsMounted.overview ? (
        <div
          role="tabpanel"
          id="stock-tab-overview"
          aria-hidden={activeTab !== "overview"}
          className={activeTab === "overview" ? "space-y-5" : "hidden"}
        >
          <ChartControls
            activeRange={range}
            onRangeChange={setRange}
            chartSeries={chartSeries}
            onChartSeriesChange={setChartSeries}
          />
          <PriceChart
            kind="stock"
            symbol={ticker}
            range={range}
            series={chartSeries}
            onDisplayChange={onChartDisplay}
            initialChart={initialChartMemo}
          />
          <MiniTable
            ticker={ticker}
            headerMeta={headerMeta}
            headerMetaLoading={headerMetaLoading}
            initialPerformance={initialPageData?.ticker === ticker ? initialPageData.performance : null}
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
            onChartDisplayChange={onChartDisplay}
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
