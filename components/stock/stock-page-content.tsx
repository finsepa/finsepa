"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CompanyPick } from "@/components/charting/company-picker";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { parseStockDetailTabQuery } from "@/lib/stock/stock-detail-tab";
import { coerceStockDetailTabForEtf, isStockDetailEtf, normalizeStockDetailTab } from "@/lib/stock/stock-etf";
import { AssetPortfolioHoldingsTab } from "@/components/portfolio/asset-portfolio-holdings-tab";
import { StockDetailTabNav } from "./stock-detail-tab-nav";
import { MultichartsTabSkeleton } from "@/components/stock/stock-multicharts-tab-skeleton";
import { StockFinancialsTabSkeleton } from "@/components/stock/stock-financials-tab-skeleton";
import { StockChartingTab } from "./stock-charting-tab";
import { StockEarningsTab } from "./stock-earnings-tab";
import { StockInsidersTab } from "./stock-insiders-tab";
import { StockPeersTab } from "./stock-peers-tab";
import { StockProfileTab } from "./stock-profile-tab";
import { StockSuperinvestorsTab } from "./stock-superinvestors-tab";
import { StockTargetPriceTab } from "./stock-target-price-tab";
import { StockBreadcrumbs } from "./stock-breadcrumbs";
import { StockHeader } from "./stock-header";
import { ChartControls } from "./chart-controls";
import { MiniTable } from "./mini-table";
import { StockComparePicker } from "./stock-compare-picker";
import { StockCompareReturnChart } from "./stock-compare-return-chart";
import { KeyStats } from "./key-stats";
import { KeyStatsMetricChartModal } from "./key-stats-metric-chart-modal";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { ChartScreenshotDownloadModal } from "@/components/chart/chart-screenshot-download-modal";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import { Download } from "@/lib/icons";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import {
  revalidateChartingFundamentalsSeriesCached,
  seedChartingFundamentalsSeriesCache,
} from "@/lib/charting/charting-fundamentals-client-cache";
import { LatestNews } from "./latest-news";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";
import { isUsListedStockHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockChartRange, StockChartSeries } from "@/lib/market/stock-chart-types";
import { mergeClosedMarketOverviewHeader, mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import { cn } from "@/lib/utils";
import { priorSessionDayChangeFromPerformance } from "@/lib/market/prior-session-day-change";
import { getUsEquityMarketSession, isUsEquityExtendedHoursHeaderEligible, lastUsRegularSessionCloseUnix } from "@/lib/market/us-equity-market-session";
import { STOCK_1D_LIVE_PRICE_POLL_MS } from "@/lib/chart/stock-1d-live-session-chart";
import {
  formatAssetChartTimestamp,
  formatStockHeaderAtClosePeriodLabel,
  formatStockHeaderSessionPeriodLabel,
  STOCK_DISPLAY_TZ,
} from "@/lib/market/chart-timestamp-format";
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
    loading: () => <StockFinancialsTabSkeleton />,
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
  scrubPeriodLabel: null,
};

function stockHeaderMetaIsIncomplete(meta: StockDetailHeaderMeta | null): boolean {
  if (!meta) return true;
  return !meta.exchange?.trim() && !meta.sector?.trim() && !meta.industry?.trim();
}

function buildInitialSessionHeaderUi(
  data: StockPageInitialData | null | undefined,
  routeTicker: string,
): ChartDisplayState {
  if (data?.ticker !== routeTicker.trim().toUpperCase()) return EMPTY_CHART_DISPLAY;
  const headerLiveSpotUsd =
    getUsEquityMarketSession(new Date()) === "regular" ? data.headerLiveSpotUsd : null;
  const headerPriorCloseUsd =
    getUsEquityMarketSession(new Date()) === "regular" ? data.headerPriorCloseUsd : null;
  return mergeSessionHeaderWithPerformanceSpot(
    EMPTY_CHART_DISPLAY,
    data.performance,
    "price",
    headerLiveSpotUsd,
    new Date(),
    headerPriorCloseUsd,
  );
}

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
    superinvestors: tab === "superinvestors",
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
  countryIso?: unknown;
  sector?: unknown;
  industry?: unknown;
  earningsDateDisplay?: unknown;
  watchlistCount?: unknown;
  screenerRank?: unknown;
}): StockDetailHeaderMeta {
  return {
    fullName: typeof json.fullName === "string" ? json.fullName : null,
    logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : null,
    exchange: typeof json.exchange === "string" ? json.exchange : null,
    countryIso: typeof json.countryIso === "string" ? json.countryIso : null,
    sector: typeof json.sector === "string" ? json.sector : null,
    industry: typeof json.industry === "string" ? json.industry : null,
    earningsDateDisplay: typeof json.earningsDateDisplay === "string" ? json.earningsDateDisplay : null,
    watchlistCount: typeof json.watchlistCount === "number" ? json.watchlistCount : null,
    screenerRank: typeof json.screenerRank === "number" && Number.isFinite(json.screenerRank) ? json.screenerRank : null,
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

  const [range, setRange] = useState<StockChartRange>(
    () => initialPageData?.chart?.range ?? "1D",
  );
  const [chartSeries, setChartSeries] = useState<StockChartSeries>("price");
  const [comparePicks, setComparePicks] = useState<CompanyPick[]>([]);
  const chartSeriesBeforeCompareRef = useRef<StockChartSeries>("price");
  const comparePicksRef = useRef<CompanyPick[]>([]);
  comparePicksRef.current = comparePicks;
  const ticker = (routeTicker?.trim() ? routeTicker.trim() : "AAPL").toUpperCase();
  const pageDataReady = initialPageData?.ticker === ticker;

  /** URL tab from the client router — applied after mount so the first paint matches SSR (`initialActiveTab`). */
  const [searchSyncedTab, setSearchSyncedTab] = useState<StockDetailTabId | null>(null);
  const [tabsMounted, setTabsMounted] = useState<Record<StockDetailTabId, boolean>>(() =>
    initialTabsMounted(initialActiveTab),
  );

  useEffect(() => {
    const raw = parseStockDetailTabQuery(searchParams.get("tab")) ?? initialActiveTab;
    queueMicrotask(() => {
      setSearchSyncedTab(raw);
      setTabsMounted((m) => ({ ...m, [raw]: true }));
    });
  }, [searchParams, initialActiveTab]);

  const serverHeader =
    initialPageData?.ticker === ticker ? initialPageData.headerMeta : null;
  const [headerMeta, setHeaderMeta] = useState<StockDetailHeaderMeta | null>(serverHeader);
  const [headerMetaLoading, setHeaderMetaLoading] = useState(!serverHeader);

  const serverIsEtf = initialPageData?.ticker === ticker ? initialPageData.isEtf : false;
  const isEtf = useMemo(
    () => serverIsEtf || isStockDetailEtf(ticker, headerMeta),
    [serverIsEtf, ticker, headerMeta],
  );

  const urlTab: StockDetailTabId = useMemo(() => {
    const raw = searchSyncedTab ?? initialActiveTab;
    return normalizeStockDetailTab(raw, isEtf);
  }, [searchSyncedTab, initialActiveTab, isEtf]);

  const [displayTab, setDisplayTab] = useState<StockDetailTabId>(() =>
    normalizeStockDetailTab(initialActiveTab, serverIsEtf),
  );
  const [, startTabTransition] = useTransition();

  useEffect(() => {
    setDisplayTab(urlTab);
    setTabsMounted((m) => ({ ...m, [urlTab]: true }));
  }, [urlTab]);

  const chartingMetricParam = searchParams.get("metric");

  const refetchHeaderMeta = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setHeaderMetaLoading(true);
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
    if (!stockHeaderMetaIsIncomplete(serverHeader)) return;
    void refetchHeaderMeta({ silent: Boolean(serverHeader) });
  }, [ticker, serverHeader, refetchHeaderMeta]);

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
    setRange("1D");
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

  useEffect(() => {
    if (!isEtf) return;
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;
    const parsed = parseStockDetailTabQuery(tabParam);
    if (!parsed) return;
    const coerced = coerceStockDetailTabForEtf(parsed);
    if (coerced === parsed) return;
    const params = new URLSearchParams(searchParams.toString());
    if (coerced === "overview") {
      params.delete("tab");
      params.delete("metric");
    } else {
      params.set("tab", coerced);
      params.delete("metric");
    }
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [isEtf, searchParams, pathname, router]);

  const setTabInUrl = useCallback(
    (tab: StockDetailTabId) => {
      const next = isEtf ? coerceStockDetailTabForEtf(tab) : tab;
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") {
        params.delete("tab");
        params.delete("metric");
      } else {
        params.set("tab", next);
        if (next !== "charting") params.delete("metric");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, isEtf],
  );

  const handleTabChange = useCallback(
    (tab: StockDetailTabId) => {
      const next = isEtf ? coerceStockDetailTabForEtf(tab) : tab;
      if (next === displayTab) return;
      setDisplayTab(next);
      setTabsMounted((m) => ({ ...m, [next]: true }));
      startTabTransition(() => setTabInUrl(next));
    },
    [displayTab, isEtf, setTabInUrl],
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
  const fundamentalsModalTtm = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.fundamentalsTtmPoint : null),
    [initialPageData, ticker],
  );

  /** Same fundamentals-series cache as Charting — Key Stats modals (Yield, Revenue, …) read without a loading flash. */
  useEffect(() => {
    if (fundamentalsModalAnnual?.length) {
      seedChartingFundamentalsSeriesCache(ticker, "annual", fundamentalsModalAnnual, fundamentalsModalTtm);
    }
    if (fundamentalsModalQuarterly?.length) {
      seedChartingFundamentalsSeriesCache(ticker, "quarterly", fundamentalsModalQuarterly);
    }
    void revalidateChartingFundamentalsSeriesCached(ticker, "annual");
    void revalidateChartingFundamentalsSeriesCached(ticker, "quarterly");
  }, [ticker, fundamentalsModalAnnual, fundamentalsModalQuarterly, fundamentalsModalTtm]);

  /** Hidden 1D price chart — drives header on non-overview tabs (today / live spot). */
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(() =>
    buildInitialSessionHeaderUi(initialPageData, ticker),
  );
  const onSessionHeaderDisplay = useCallback((s: ChartDisplayState) => {
    setSessionHeaderUi((prev) => {
      const next: ChartDisplayState = { ...s };
      if (s.loading && prev.displayPrice != null && !s.selectionActive) {
        next.loading = false;
        next.displayPrice = s.displayPrice ?? prev.displayPrice;
        next.displayChangeAbs = s.displayChangeAbs ?? prev.displayChangeAbs;
        next.displayChangePct = s.displayChangePct ?? prev.displayChangePct;
      }
      if (next.priceTimestampLabel == null && prev.priceTimestampLabel != null) {
        next.priceTimestampLabel = prev.priceTimestampLabel;
      }
      return next;
    });
  }, []);

  /** Visible overview chart — drives header metric + range on Overview (price / market cap / return). */
  const [overviewHeaderUi, setOverviewHeaderUi] = useState<ChartDisplayState | null>(null);
  const onOverviewHeaderDisplay = useCallback((s: ChartDisplayState) => {
    setOverviewHeaderUi(s);
  }, []);

  useEffect(() => {
    setSessionHeaderUi(buildInitialSessionHeaderUi(initialPageData, ticker));
    setOverviewHeaderUi(null);
  }, [ticker, initialPageData]);

  useEffect(() => {
    setOverviewHeaderUi(null);
  }, [chartSeries, range]);

  const performanceFromServer = useMemo(
    (): StockPerformance | null =>
      initialPageData?.ticker === ticker ? (initialPageData.performance ?? null) : null,
    [initialPageData, ticker],
  );

  const [performanceClient, setPerformanceClient] = useState<StockPerformance | null>(null);

  const [regularSessionClock, setRegularSessionClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setRegularSessionClock((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /** Phase 7: intraday-aligned spot; client poll refines SSR `headerLiveSpotUsd` for signed-in users. */
  const [headerLiveSpotClient, setHeaderLiveSpotClient] = useState<number | null>(null);
  const [headerPriorCloseClient, setHeaderPriorCloseClient] = useState<number | null>(null);

  useEffect(() => {
    setHeaderLiveSpotClient(null);
    setHeaderPriorCloseClient(null);
  }, [ticker]);

  const showExtendedHoursHeader = useMemo(
    () =>
      comparePicks.length === 0 &&
      chartSeries === "price" &&
      isUsListedStockHeaderMeta(headerMeta) &&
      isUsEquityExtendedHoursHeaderEligible(new Date()),
    [comparePicks.length, chartSeries, headerMeta, regularSessionClock],
  );

  const [extendedHoursQuote, setExtendedHoursQuote] = useState<StockExtendedHoursHeader | null>(null);
  const [extendedHoursLoading, setExtendedHoursLoading] = useState(false);

  useEffect(() => {
    setExtendedHoursQuote(null);
    setExtendedHoursLoading(false);
  }, [ticker]);

  useEffect(() => {
    const session = getUsEquityMarketSession(new Date());
    if (session === "closed") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/live-price`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { price?: unknown; previousClose?: unknown };
        const p = json.price;
        const prev = json.previousClose;
        if (
          getUsEquityMarketSession(new Date()) === "regular" &&
          typeof p === "number" &&
          Number.isFinite(p) &&
          p > 0 &&
          !cancelled
        ) {
          setHeaderLiveSpotClient(p);
        }
        if (typeof prev === "number" && Number.isFinite(prev) && prev > 0 && !cancelled) {
          setHeaderPriorCloseClient(prev);
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, STOCK_1D_LIVE_PRICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ticker, regularSessionClock]);

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
    getUsEquityMarketSession(new Date()) === "regular"
      ? (headerLiveSpotClient ??
          (initialPageData?.ticker === ticker ? (initialPageData.headerLiveSpotUsd ?? null) : null))
      : null;

  const headerPriorCloseForMerge =
    headerPriorCloseClient ??
    (initialPageData?.ticker === ticker ? (initialPageData.headerPriorCloseUsd ?? null) : null);

  const sessionSpotHeaderUi = useMemo(
    () =>
      mergeSessionHeaderWithPerformanceSpot(
        sessionHeaderUi,
        performanceForHeaderFallback,
        "price",
        headerLiveSpotForMerge,
        new Date(),
        headerPriorCloseForMerge,
      ),
    [headerLiveSpotForMerge, headerPriorCloseForMerge, performanceForHeaderFallback, sessionHeaderUi],
  );

  const initialSessionChartMemo = useMemo(
    () =>
      initialPageData?.ticker === ticker && initialPageData.chart.range === "1D"
        ? initialPageData.chart
        : null,
    [initialPageData, ticker],
  );

  const initialChartMemo = useMemo(
    () => (initialPageData?.ticker === ticker ? initialPageData.chart : null),
    [initialPageData, ticker],
  );

  const overviewDrivesHeader = displayTab === "overview" && comparePicks.length === 0;

  const overviewHeaderUiMerged = useMemo(() => {
    if (!overviewHeaderUi) return null;
    if (chartSeries !== "price") return overviewHeaderUi;

    const closed = getUsEquityMarketSession(new Date()) !== "regular";
    if (range === "1D") {
      return mergeSessionHeaderWithPerformanceSpot(
        overviewHeaderUi,
        performanceForHeaderFallback,
        "price",
        headerLiveSpotForMerge,
        new Date(),
        headerPriorCloseForMerge,
        true,
      );
    }
    if (closed) {
      return mergeClosedMarketOverviewHeader(
        overviewHeaderUi,
        performanceForHeaderFallback,
        "price",
      );
    }
    return overviewHeaderUi;
  }, [
    chartSeries,
    headerLiveSpotForMerge,
    headerPriorCloseForMerge,
    overviewHeaderUi,
    performanceForHeaderFallback,
    range,
    regularSessionClock,
  ]);

  const overviewHeaderFallback = useMemo(() => {
    const base = { ...EMPTY_CHART_DISPLAY, loading: true, empty: false };
    if (chartSeries !== "price") return base;
    const closed = getUsEquityMarketSession(new Date()) !== "regular";
    if (range === "1D") {
      return mergeSessionHeaderWithPerformanceSpot(
        base,
        performanceForHeaderFallback,
        "price",
        headerLiveSpotForMerge,
        new Date(),
        headerPriorCloseForMerge,
        true,
      );
    }
    if (closed) {
      return mergeClosedMarketOverviewHeader(base, performanceForHeaderFallback, "price");
    }
    return base;
  }, [chartSeries, headerLiveSpotForMerge, headerPriorCloseForMerge, performanceForHeaderFallback, range, regularSessionClock]);

  const chartUi = useMemo((): ChartDisplayState => {
    const raw = overviewDrivesHeader
      ? (overviewHeaderUiMerged ?? overviewHeaderFallback)
      : sessionSpotHeaderUi;

    const settled =
      raw.displayPrice != null && raw.loading && !overviewDrivesHeader
        ? { ...raw, loading: false }
        : raw;
    if (settled.priceTimestampLabel != null) return settled;

    const pts = overviewDrivesHeader
      ? initialChartMemo?.range === range
        ? initialChartMemo.points
        : null
      : initialSessionChartMemo?.points;

    if (!pts?.length || settled.displayPrice == null) return settled;
    const last = pts[pts.length - 1];
    if (!last || !Number.isFinite(last.time)) return settled;
    return {
      ...settled,
      priceTimestampLabel: formatAssetChartTimestamp(last.time, {
        kind: "stock",
        timeZone: last.timeZone,
      }),
    };
  }, [
    overviewDrivesHeader,
    overviewHeaderUiMerged,
    overviewHeaderFallback,
    sessionSpotHeaderUi,
    initialChartMemo,
    initialSessionChartMemo,
    range,
  ]);

  const sessionCloseForExtendedHours =
    performanceForHeaderFallback?.price ?? chartUi.displayPrice ?? null;

  useEffect(() => {
    if (!showExtendedHoursHeader) {
      setExtendedHoursQuote(null);
      setExtendedHoursLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const params = new URLSearchParams();
      if (headerMeta?.exchange?.trim()) params.set("exchange", headerMeta.exchange.trim());
      if (headerMeta?.countryIso?.trim()) params.set("country", headerMeta.countryIso.trim());
      if (
        sessionCloseForExtendedHours != null &&
        Number.isFinite(sessionCloseForExtendedHours) &&
        sessionCloseForExtendedHours > 0
      ) {
        params.set("close", String(sessionCloseForExtendedHours));
      }
      const qs = params.toString();

      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/extended-hours${qs ? `?${qs}` : ""}`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { quote?: StockExtendedHoursHeader | null };
        if (!cancelled) setExtendedHoursQuote(json.quote ?? null);
      } catch {
        if (!cancelled) setExtendedHoursQuote(null);
      } finally {
        if (!cancelled) setExtendedHoursLoading(false);
      }
    };

    setExtendedHoursLoading(true);
    void load();
    const id = window.setInterval(() => void load(), STOCK_1D_LIVE_PRICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    ticker,
    showExtendedHoursHeader,
    headerMeta?.exchange,
    headerMeta?.countryIso,
    regularSessionClock,
    sessionCloseForExtendedHours,
  ]);

  const extendedHoursHeaderLeft = useMemo(() => {
    if (!showExtendedHoursHeader || chartSeries !== "price") return null;

    const priorClose =
      headerPriorCloseClient ??
      (initialPageData?.ticker === ticker ? (initialPageData.headerPriorCloseUsd ?? null) : null);
    const priorSessionDay = priorSessionDayChangeFromPerformance(
      performanceForHeaderFallback,
      priorClose,
    );

    if (extendedHoursQuote) {
      return {
        price: extendedHoursQuote.closePrice,
        changeAbs: priorSessionDay?.changeAbs ?? extendedHoursQuote.closeChangeAbs,
        changePct: priorSessionDay?.changePct ?? extendedHoursQuote.closeChangePct,
      };
    }

    if (!priorSessionDay) return null;
    return {
      price: priorSessionDay.closePrice,
      changeAbs: priorSessionDay.changeAbs,
      changePct: priorSessionDay.changePct,
    };
  }, [
    showExtendedHoursHeader,
    extendedHoursQuote,
    chartSeries,
    performanceForHeaderFallback,
    headerPriorCloseClient,
    initialPageData,
    ticker,
  ]);

  const [overviewDownloadOpen, setOverviewDownloadOpen] = useState(false);
  const [overviewDownloadSnapshot, setOverviewDownloadSnapshot] =
    useState<ChartScreenshotSnapshot | null>(null);
  const [overviewDownloadFetching, setOverviewDownloadFetching] = useState(false);

  const handleOpenOverviewDownload = useCallback(async () => {
    if (comparePicks.length > 0 || overviewDownloadFetching) return;
    setOverviewDownloadFetching(true);
    try {
      const path = `/api/stocks/${encodeURIComponent(ticker)}/chart?range=${encodeURIComponent(range)}&series=${encodeURIComponent(chartSeries)}`;
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as { points?: StockChartPoint[] };
      const points = Array.isArray(json.points) ? json.points : [];
      if (points.length === 0) return;
      setOverviewDownloadSnapshot({
        variant: "stockOverview",
        ticker,
        companyName: headerMeta?.fullName ?? null,
        logoUrl: headerMeta?.logoUrl ?? null,
        periodMode: "annual",
        timeRange: "all",
        chartType: "bars",
        selectedMetrics: [],
        fullPoints: [],
        stockOverview: { range, series: chartSeries, points },
      });
      setOverviewDownloadOpen(true);
    } catch {
      /* ignore */
    } finally {
      setOverviewDownloadFetching(false);
    }
  }, [
    comparePicks.length,
    overviewDownloadFetching,
    ticker,
    range,
    chartSeries,
    headerMeta?.fullName,
    headerMeta?.logoUrl,
  ]);

  const overviewDownloadDisabled =
    comparePicks.length > 0 ||
    chartUi.loading ||
    chartUi.empty ||
    overviewDownloadFetching;

  const headerPeriodLabel = useMemo(() => {
    const session = getUsEquityMarketSession(new Date());

    if (session === "regular") {
      const showLiveTimestamp = overviewDrivesHeader ? range === "1D" : true;
      if (showLiveTimestamp) {
        const label = formatStockHeaderSessionPeriodLabel(
          Math.floor(Date.now() / 1000),
          STOCK_DISPLAY_TZ,
        );
        return label || "Today";
      }
      return overviewDrivesHeader ? (range === "1D" ? "Today" : range) : "Today";
    }

    const closeUnix = lastUsRegularSessionCloseUnix(new Date(), STOCK_DISPLAY_TZ);
    return formatStockHeaderAtClosePeriodLabel(closeUnix, STOCK_DISPLAY_TZ);
  }, [overviewDrivesHeader, range, regularSessionClock]);

  /** Hidden 1D chart keeps session/live spot for the header on every tab (including Holdings). */
  const stockChartDrivesHeader = true;

  return (
    <div className="relative min-w-0">
      <StockBreadcrumbs ticker={ticker} headerMeta={headerMeta} isEtf={isEtf} />
      <div className="space-y-5 px-4 py-0 max-md:pt-4 sm:space-y-5 sm:px-9 sm:py-6">
      <KeyStatsMetricChartModal
        key={revenueProfitModalMetric ?? "closed"}
        ticker={ticker}
        metricId={revenueProfitModalMetric}
        onClose={() => setRevenueProfitModalMetric(null)}
        initialAnnualPoints={fundamentalsModalAnnual}
        initialQuarterlyPoints={fundamentalsModalQuarterly}
        headerMeta={headerMeta}
      />
      <ChartScreenshotDownloadModal
        open={overviewDownloadOpen}
        onClose={() => setOverviewDownloadOpen(false)}
        snapshot={overviewDownloadSnapshot}
      />
      <Suspense fallback={null}>
        <AssetPageTopLoader />
      </Suspense>
      <StockHeader
        ticker={ticker}
        periodLabel={headerPeriodLabel}
        periodLabelOverride={chartUi.periodLabelOverride}
        chartRangeLabel={overviewDrivesHeader ? range : "1D"}
        price={extendedHoursHeaderLeft?.price ?? chartUi.displayPrice}
        changePct={extendedHoursHeaderLeft?.changePct ?? chartUi.displayChangePct}
        changeAbs={extendedHoursHeaderLeft?.changeAbs ?? chartUi.displayChangeAbs}
        selectionChangeAbs={chartUi.selectionChangeAbs}
        selectionChangePct={chartUi.selectionChangePct}
        chartLoading={chartUi.loading}
        chartEmpty={chartUi.empty}
        priceTimestampLabel={chartUi.priceTimestampLabel}
        scrubPeriodLabel={chartUi.scrubPeriodLabel}
        chartHovering={chartUi.isHovering && !chartUi.selectionActive}
        headerMeta={headerMeta}
        headerMetaLoading={headerMetaLoading}
        headerChartMetric={comparePicks.length > 0 ? "price" : chartSeries}
        showExtendedHours={showExtendedHoursHeader}
        extendedHours={extendedHoursQuote}
        extendedHoursLoading={extendedHoursLoading}
      />

      {stockChartDrivesHeader ? (
        <div className={OFFSCREEN_PRICE_CHART} aria-hidden>
          <PriceChart
            key={`${ticker}-price-header-1d`}
            kind="stock"
            symbol={ticker}
            range="1D"
            series="price"
            height={320}
            initialChart={initialSessionChartMemo}
            liveSpotUsd={headerLiveSpotForMerge}
            onDisplayChange={onSessionHeaderDisplay}
          />
        </div>
      ) : null}

      <StockDetailTabNav
        activeTab={displayTab}
        onTabChange={handleTabChange}
        isEtf={isEtf}
        sticky={displayTab !== "financials"}
      />

      {/*
        Overview price chart must stay mounted when other tabs are open — `hidden` on the tabpanel
        skips mount on deep links (e.g. ?tab=insiders), which left the header stuck on "Loading…".
        Offscreen + opacity-0 keeps layout engines and `onDisplayChange` alive without showing the chart.
      */}
      <div
        className={
          displayTab === "overview"
            ? "space-y-5"
            : "pointer-events-none fixed left-0 top-0 -z-10 h-[420px] w-[min(1200px,calc(100vw-4.5rem))] -translate-x-[120vw] opacity-0"
        }
        aria-hidden={displayTab !== "overview"}
      >
        {displayTab === "overview" ? (
          <ChartControls
            activeRange={range}
            onRangeChange={setRange}
            chartSeries={chartSeries}
            onChartSeriesChange={setChartSeries}
            seriesSelectDisabled={comparePicks.length > 0}
            compareSlot={
              <StockComparePicker baseTicker={ticker} values={comparePicks} onAdd={onAddComparePick} onRemove={onRemoveComparePick} />
            }
            downloadSlot={
              comparePicks.length > 0 ? null : (
                <button
                  type="button"
                  onClick={() => void handleOpenOverviewDownload()}
                  disabled={overviewDownloadDisabled}
                  className={cn(topbarSquircleIconClass, "disabled:cursor-not-allowed disabled:opacity-40")}
                  aria-label="Download chart"
                >
                  <Download className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </button>
              )
            }
          >
            {comparePicks.length > 0 ? (
              <StockCompareReturnChart
                key={`compare-${ticker}-${comparePicks.map((p) => p.symbol.trim().toUpperCase()).join("-")}-${range}`}
                primaryTicker={ticker}
                comparePicks={comparePicks}
                range={range}
              />
            ) : (
              <div className="relative min-h-[320px] w-full">
                {!pageDataReady ? (
                  <div className="absolute inset-0 z-10">
                    <AssetChartSkeleton heightPx={320} className="h-full" />
                  </div>
                ) : null}
                <PriceChart
                  key={`stock-overview-${ticker}-${chartSeries}-${range}`}
                  kind="stock"
                  symbol={ticker}
                  range={range}
                  series={chartSeries}
                  initialChart={initialChartMemo?.range === range ? initialChartMemo : null}
                  liveSpotUsd={range === "1D" ? headerLiveSpotForMerge : null}
                  onDisplayChange={onOverviewHeaderDisplay}
                />
              </div>
            )}
          </ChartControls>
        ) : null}
      </div>

      {tabsMounted.overview ? (
        <div
          role="tabpanel"
          id="stock-tab-overview"
          aria-hidden={displayTab !== "overview"}
          className={displayTab === "overview" ? "space-y-5 max-md:-mt-2" : "hidden"}
        >
          {comparePicks.length > 0 ? (
            <MiniTable
              ticker={ticker}
              headerMeta={headerMeta}
              headerMetaLoading={headerMetaLoading}
              initialPerformance={initialPageData?.ticker === ticker ? initialPageData.performance : null}
              comparePicks={comparePicks}
              onRemoveCompare={onRemoveComparePick}
            />
          ) : null}
          {!isEtf ? (
            <div className="max-md:pt-0 md:pt-2">
              <KeyStats
                ticker={ticker}
                initialBundle={initialPageData?.ticker === ticker ? initialPageData.keyStatsBundle : null}
                onOpenMetricChart={openRevenueProfitMetricModal}
              />
            </div>
          ) : null}
          {!isEtf ? (
            <div className="pt-2">
              <LatestNews
                ticker={ticker}
                initialItems={initialPageData?.ticker === ticker ? initialPageData.news : undefined}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {tabsMounted.financials ? (
        <div
          role="tabpanel"
          id="stock-tab-financials"
          aria-hidden={displayTab !== "financials"}
          className={displayTab === "financials" ? "block" : "hidden"}
        >
          <StockFinancialsTab
            ticker={ticker}
            initialAnnualPoints={initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesAnnual : undefined}
            initialQuarterlyPoints={
              initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesQuarterly : undefined
            }
            initialTtmPoint={initialPageData?.ticker === ticker ? initialPageData.fundamentalsTtmPoint : undefined}
            onOpenMetricChart={openRevenueProfitMetricModal}
          />
        </div>
      ) : null}

      {tabsMounted.earnings ? (
        <div
          role="tabpanel"
          id="stock-tab-earnings"
          aria-hidden={displayTab !== "earnings"}
          className={displayTab === "earnings" ? "block" : "hidden"}
        >
          <StockEarningsTab
            ticker={ticker}
            initialPayload={
              initialPageData?.ticker === ticker ? (initialPageData.earningsTabPayload ?? null) : null
            }
          />
        </div>
      ) : null}

      {tabsMounted.multicharts ? (
        <div
          role="tabpanel"
          id="stock-tab-multicharts"
          aria-hidden={displayTab !== "multicharts"}
          className={displayTab === "multicharts" ? "block" : "hidden"}
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
          aria-hidden={displayTab !== "target-price"}
          className={displayTab === "target-price" ? "block" : "hidden"}
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
          aria-hidden={displayTab !== "insiders"}
          className={displayTab === "insiders" ? "block" : "hidden"}
        >
          <StockInsidersTab ticker={ticker} />
        </div>
      ) : null}

      {tabsMounted.superinvestors ? (
        <div
          role="tabpanel"
          id="stock-tab-superinvestors"
          aria-hidden={displayTab !== "superinvestors"}
          className={displayTab === "superinvestors" ? "block" : "hidden"}
        >
          <StockSuperinvestorsTab ticker={ticker} />
        </div>
      ) : null}

      {tabsMounted.charting ? (
        <div
          role="tabpanel"
          id="stock-tab-charting"
          aria-hidden={displayTab !== "charting"}
          className={displayTab === "charting" ? "block" : "hidden"}
        >
          <StockChartingTab
            ticker={ticker}
            metricParam={chartingMetricParam}
            initialAnnualPoints={initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesAnnual : undefined}
            initialQuarterlyPoints={
              initialPageData?.ticker === ticker ? initialPageData.fundamentalsSeriesQuarterly : undefined
            }
            initialTtmPoint={initialPageData?.ticker === ticker ? initialPageData.fundamentalsTtmPoint : undefined}
            initialKeyStatsBundle={initialPageData?.ticker === ticker ? initialPageData.keyStatsBundle : null}
            assetDisplayName={headerMeta?.fullName}
            assetLogoUrl={headerMeta?.logoUrl}
          />
        </div>
      ) : null}

      {tabsMounted.peers ? (
        <div
          role="tabpanel"
          id="stock-tab-peers"
          aria-hidden={displayTab !== "peers"}
          className={displayTab === "peers" ? "block" : "hidden"}
        >
          <StockPeersTab
            ticker={ticker}
            initialPageData={initialPageData?.ticker === ticker ? initialPageData : undefined}
          />
        </div>
      ) : null}

      {tabsMounted.holdings ? (
        <div
          role="tabpanel"
          id="stock-tab-holdings"
          aria-hidden={displayTab !== "holdings"}
          className={displayTab === "holdings" ? "block" : "hidden"}
        >
          <AssetPortfolioHoldingsTab
            assetKind="stock"
            routeKey={ticker}
            assetDisplayName={headerMeta?.fullName ?? ticker}
          />
        </div>
      ) : null}

      {tabsMounted.profile ? (
        <div
          role="tabpanel"
          id="stock-tab-profile"
          aria-hidden={displayTab !== "profile"}
          className={displayTab === "profile" ? "block" : "hidden"}
        >
          <StockProfileTab
            ticker={ticker}
            initialProfile={initialPageData?.ticker === ticker ? initialPageData.profile : undefined}
          />
        </div>
      ) : null}
      </div>
    </div>
  );
}
