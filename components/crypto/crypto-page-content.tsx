"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompanyPick } from "@/components/charting/company-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { CryptoBreadcrumbs } from "@/components/crypto/crypto-breadcrumbs";
import { CryptoHeader } from "@/components/crypto/crypto-header";
import { CryptoKeyStats } from "@/components/crypto/crypto-key-stats";
import { CryptoLinksSection } from "@/components/crypto/crypto-links-section";
import { CryptoComparePicker } from "@/components/crypto/crypto-compare-picker";
import { MiniTable } from "@/components/stock/mini-table";
import { StockCompareReturnChart } from "@/components/stock/stock-compare-return-chart";
import { LogoSkeleton, SkeletonBox } from "@/components/markets/skeleton";
import { ChartControls } from "@/components/stock/chart-controls";
import { ChartScreenshotDownloadModal } from "@/components/chart/chart-screenshot-download-modal";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { LatestNews } from "@/components/stock/latest-news";
import { CryptoDetailTabNav } from "@/components/crypto/crypto-detail-tab-nav";
import { AssetPortfolioHoldingsTab } from "@/components/portfolio/asset-portfolio-holdings-tab";
import { parseCryptoDetailTabQuery, type CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";
import { mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import type { CryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import { isCryptoLive1DSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { formatAssetChartTimestamp } from "@/lib/market/chart-timestamp-format";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import type { StockChartPoint, StockChartRange, StockChartSeries } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { Download } from "@/lib/icons";
import { cn } from "@/lib/utils";

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

function buildInitialSessionHeaderUi(
  data: CryptoPageInitialData | null | undefined,
  routeSymbol: string,
): ChartDisplayState {
  if (!data || data.routeSymbol.trim().toUpperCase() !== routeSymbol.trim().toUpperCase()) {
    return EMPTY_CHART_DISPLAY;
  }
  return mergeSessionHeaderWithPerformanceSpot(
    EMPTY_CHART_DISPLAY,
    data.performance,
    "price",
    data.headerLiveSpotUsd,
  );
}

const OFFSCREEN_PRICE_CHART =
  "pointer-events-none fixed left-0 top-0 -z-10 h-[320px] w-[min(1200px,calc(100vw-4.5rem))] -translate-x-[120vw] opacity-0";

export function CryptoPageContent({
  routeSymbol,
  initialData,
  initialActiveTab = "overview",
}: {
  routeSymbol: string;
  initialData?: CryptoPageInitialData | null;
  initialActiveTab?: CryptoDetailTabId;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const symKey = routeSymbol.trim().toUpperCase();
  const serverMatch =
    initialData != null && initialData.routeSymbol.trim().toUpperCase() === symKey ? initialData : null;

  const [loading, setLoading] = useState(!serverMatch);
  const [row, setRow] = useState<CryptoAssetRow | null>(serverMatch?.asset ?? null);
  // BTC (live 24/7) defaults to the rolling 24H view; other crypto keeps the 1Y default.
  const [range, setRange] = useState<StockChartRange>(() =>
    isCryptoLive1DSymbol(routeSymbol.trim().toUpperCase()) ? "1D" : "1Y",
  );
  const [comparePicks, setComparePicks] = useState<CompanyPick[]>([]);
  const [chartSeries, setChartSeries] = useState<StockChartSeries>("price");
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(() =>
    buildInitialSessionHeaderUi(serverMatch, symKey),
  );
  const symUpper = routeSymbol.trim().toUpperCase();

  /**
   * Live 24/7 crypto (BTC): the header is always driven by the rolling last-24h (1D) feed, so it uses
   * the stock-style layout (change inline + date/time below) and a `24H` range label — for any selected range.
   */
  const isLiveCrypto = isCryptoLive1DSymbol(symUpper);

  /** URL tab from the client router — applied after mount so the first paint matches SSR (`initialActiveTab`). */
  const [searchSyncedTab, setSearchSyncedTab] = useState<CryptoDetailTabId | null>(null);

  useEffect(() => {
    const next = parseCryptoDetailTabQuery(searchParams.get("tab")) ?? initialActiveTab;
    queueMicrotask(() => {
      setSearchSyncedTab(next);
    });
  }, [searchParams, initialActiveTab]);

  const activeTab: CryptoDetailTabId = searchSyncedTab ?? initialActiveTab;

  const setTabInUrl = useCallback(
    (tab: CryptoDetailTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onSessionHeaderDisplay = useCallback((s: ChartDisplayState) => {
    setSessionHeaderUi(s);
  }, []);

  /** BTC live 24/7: visible overview chart display (drives the header movement for 5D/1M/… ranges). */
  const [rangeHeaderUi, setRangeHeaderUi] = useState<ChartDisplayState | null>(null);
  const onRangeChartDisplay = useCallback((s: ChartDisplayState) => {
    setRangeHeaderUi(s);
  }, []);

  const onAddComparePick = useCallback((pick: CompanyPick) => {
    const sym = pick.symbol.trim().toUpperCase();
    if (!sym || sym === symUpper) return;
    setComparePicks((cur) => {
      if (cur.some((p) => p.symbol.trim().toUpperCase() === sym)) return cur;
      return [...cur, pick];
    });
  }, [symUpper]);

  const onRemoveComparePick = useCallback((symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    setComparePicks((cur) => cur.filter((p) => p.symbol.trim().toUpperCase() !== sym));
  }, []);

  // BTC only: hidden 1D chart feeds the header. Other crypto uses performance + live-price poll
  // (avoids a second lightweight-charts instance + extra intraday fetch on SOL/ETH/…).
  const cryptoChartDrivesHeader = isLiveCrypto;

  const performanceFromServer = useMemo(
    (): StockPerformance | null =>
      serverMatch?.performance != null ? serverMatch.performance : null,
    [serverMatch],
  );

  const [performanceClient, setPerformanceClient] = useState<StockPerformance | null>(null);

  const [headerLiveSpotClient, setHeaderLiveSpotClient] = useState<number | null>(null);
  /** Data timestamp + source for the live spot (BTC live-price API). Drives the header timestamp. */
  const [headerLiveQuote, setHeaderLiveQuote] = useState<{
    quotedAtSec: number | null;
    source: string | null;
  } | null>(null);
  /** Latest value we pushed to `headerLiveSpotClient` — lets the poll compare without effect deps. */
  const liveSpotRef = useRef<number | null>(null);
  /** Latest timestamp label rendered under the header price. */
  const renderedTimestampRef = useRef<string | null>(null);
  /** Latest price actually rendered in the header (post-override). */
  const renderedPriceRef = useRef<number | null>(null);

  useEffect(() => {
    liveSpotRef.current = null;
    setHeaderLiveSpotClient(null);
    setHeaderLiveQuote(null);
    setSessionHeaderUi(buildInitialSessionHeaderUi(serverMatch, symUpper));
  }, [symUpper]);

  useEffect(() => {
    let cancelled = false;
    const debug = process.env.NODE_ENV === "development" && isCryptoLive1DSymbol(symUpper);
    const tick = async () => {
      try {
        const res = await fetch(`/api/crypto/${encodeURIComponent(symUpper)}/live-price`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const fetchedTimestamp = res.headers.get("date");
        const cacheControl = res.headers.get("cache-control");
        const json = (await res.json()) as {
          price?: unknown;
          quotedAtSec?: unknown;
          source?: unknown;
        };
        const p = json.price;
        const quotedAtSec =
          typeof json.quotedAtSec === "number" && Number.isFinite(json.quotedAtSec)
            ? json.quotedAtSec
            : null;
        const source = typeof json.source === "string" ? json.source : null;
        if (typeof p === "number" && Number.isFinite(p) && p > 0 && !cancelled) {
          const previousPrice = liveSpotRef.current;
          const stateChanged = previousPrice !== p;
          liveSpotRef.current = p;
          setHeaderLiveSpotClient(p);
          setHeaderLiveQuote({ quotedAtSec, source });
          if (debug) {
            console.info("[crypto-live-price poll]", symUpper, {
              source, // ws | realtime | intraday | performance
              price: p,
              quotedAtSec, // data timestamp of the quote (not render time)
              quotedAt: quotedAtSec != null ? new Date(quotedAtSec * 1000).toISOString() : null,
              previousPrice,
              renderedPrice: renderedPriceRef.current, // price currently shown in the header
              stateChanged, // false ⇒ React bails out, no header re-render
              fetchedTimestamp, // server `Date` header for this response
              renderedTimestamp: renderedTimestampRef.current, // date/time shown under the price
              cacheControl, // expect "private, no-store"
              polledAt: new Date().toISOString(),
            });
          }
        } else if (debug) {
          console.info("[crypto-live-price poll]", symUpper, {
            source,
            price: p,
            note: "ignored (non-positive / not a finite number)",
            cacheControl,
            polledAt: new Date().toISOString(),
          });
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    // BTC (live 1D) polls faster so the header keeps pace with the ~60s chart.
    const pollMs = isCryptoLive1DSymbol(symUpper) ? 30_000 : 90_000;
    const id = window.setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symUpper]);

  useEffect(() => {
    setPerformanceClient(null);
    if (performanceFromServer?.price != null && Number.isFinite(performanceFromServer.price)) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/crypto/${encodeURIComponent(symUpper)}/performance`, {
          credentials: "include",
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
  }, [symUpper, performanceFromServer?.price]);

  const performanceForHeaderFallback = performanceFromServer ?? performanceClient;

  const headerLiveSpotForMerge =
    headerLiveSpotClient ?? (serverMatch?.headerLiveSpotUsd != null ? serverMatch.headerLiveSpotUsd : null);

  /** Crypto 24H chart tip only — same WS price/time as the header; null falls back to series tip. */
  const cryptoLiveWsTipSpot =
    isLiveCrypto && headerLiveQuote?.source === "ws" ? headerLiveSpotClient : null;
  const cryptoLiveWsTipQuotedAtSec =
    isLiveCrypto && headerLiveQuote?.source === "ws" ? headerLiveQuote.quotedAtSec : null;

  const spotUi = useMemo(
    () =>
      mergeSessionHeaderWithPerformanceSpot(
      sessionHeaderUi,
      performanceForHeaderFallback,
      "price",
      headerLiveSpotForMerge,
      ),
    [headerLiveSpotForMerge, performanceForHeaderFallback, sessionHeaderUi],
  );

  // BTC live 24H: headline comes from the hidden 1D chart (first → last bar), not US-equity session merge.
  // For non-1D price ranges (5D/1M/…), the visible overview chart drives the movement instead.
  const btcRangeHeader =
    isLiveCrypto &&
    range !== "1D" &&
    chartSeries === "price" &&
    activeTab === "overview" &&
    comparePicks.length === 0;

  const chartUi = !isLiveCrypto
    ? spotUi
    : btcRangeHeader
      ? (rangeHeaderUi ?? sessionHeaderUi)
      : sessionHeaderUi;

  /**
   * BTC (live 24/7): pin the headline to the freshest live spot, but keep the move vs the active
   * chart's first bar (24H for the default view, or the selected 5D/1M/… range). Skipped while
   * scrubbing/hovering (crosshair drives the header then).
   */
  const headerUi = useMemo<ChartDisplayState>(() => {
    if (!isLiveCrypto) return chartUi;
    if (chartUi.isHovering || chartUi.selectionActive) return chartUi;
    const live = headerLiveSpotClient;
    if (!(typeof live === "number" && Number.isFinite(live) && live > 0)) return chartUi;

    const periodStart =
      chartUi.displayPrice != null &&
      chartUi.displayChangeAbs != null &&
      Number.isFinite(chartUi.displayPrice) &&
      Number.isFinite(chartUi.displayChangeAbs)
        ? chartUi.displayPrice - chartUi.displayChangeAbs
        : null;
    const abs = periodStart != null ? live - periodStart : chartUi.displayChangeAbs;
    const pct =
      periodStart != null && Math.abs(periodStart) > 1e-9 && abs != null
        ? (abs / periodStart) * 100
        : chartUi.displayChangePct;

    const quotedAtSec = headerLiveQuote?.quotedAtSec ?? null;
    const priceTimestampLabel =
      quotedAtSec != null
        ? formatAssetChartTimestamp(quotedAtSec, { kind: "crypto" })
        : chartUi.priceTimestampLabel;

    return {
      ...chartUi,
      loading: false,
      empty: false,
      displayPrice: live,
      displayChangeAbs: abs,
      displayChangePct: pct,
      priceTimestampLabel,
    };
  }, [isLiveCrypto, chartUi, headerLiveSpotClient, headerLiveQuote]);

  // Mirror what the header actually renders into refs so the live-price poll can log it.
  useEffect(() => {
    renderedTimestampRef.current = headerUi.priceTimestampLabel;
    renderedPriceRef.current = headerUi.displayPrice;
  }, [headerUi.priceTimestampLabel, headerUi.displayPrice]);

  const initialChartMemo = useMemo(() => (serverMatch ? serverMatch.chart : null), [serverMatch]);

  const initialSessionChartMemo = useMemo(
    () => (serverMatch?.sessionChart ? serverMatch.sessionChart : null),
    [serverMatch],
  );

  const [mountHeaderChart, setMountHeaderChart] = useState(false);

  useEffect(() => {
    if (!cryptoChartDrivesHeader) {
      setMountHeaderChart(false);
      return;
    }
    const enable = () => setMountHeaderChart(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(enable, { timeout: 2_000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(enable, 400);
    return () => window.clearTimeout(t);
  }, [symUpper, cryptoChartDrivesHeader]);

  const initialPerformance = useMemo((): StockPerformance | null | undefined => {
    if (!serverMatch?.performance) return undefined;
    return serverMatch.performance;
  }, [serverMatch]);

  const initialNews = useMemo(() => {
    if (!serverMatch?.news?.length) return undefined;
    return serverMatch.news;
  }, [serverMatch]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (serverMatch) {
        if (!mounted) return;
        setRow(serverMatch.asset);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/crypto/asset/${encodeURIComponent(routeSymbol)}`);
        if (!res.ok) {
          if (!mounted) return;
          setRow(null);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { row?: CryptoAssetRow };
        if (!mounted) return;
        setRow(json.row ?? null);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setRow(null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [routeSymbol, serverMatch]);

  const safeRow = useMemo(() => row, [row]);

  const [cryptoLogoFailedFor, setCryptoLogoFailedFor] = useState<string | null>(null);
  const cryptoLogoFailed = cryptoLogoFailedFor === symUpper;
  const serverCryptoLogo = safeRow?.logoUrl?.trim() ?? "";
  const memCryptoLogo = readLogoMemory(symUpper)?.trim() ?? "";
  const cryptoLogoSrc = useMemo(() => {
    if (cryptoLogoFailed) return "";
    return serverCryptoLogo || memCryptoLogo;
  }, [serverCryptoLogo, memCryptoLogo, cryptoLogoFailed]);

  useEffect(() => {
    if (serverCryptoLogo) mergeLogoMemory(symUpper, serverCryptoLogo);
  }, [symUpper, serverCryptoLogo]);

  const displayName = safeRow?.name ?? symUpper;
  const headerLogoUrl = loading ? null : cryptoLogoSrc || null;

  const [overviewDownloadOpen, setOverviewDownloadOpen] = useState(false);
  const [overviewDownloadSnapshot, setOverviewDownloadSnapshot] =
    useState<ChartScreenshotSnapshot | null>(null);
  const [overviewDownloadFetching, setOverviewDownloadFetching] = useState(false);

  const handleOpenCryptoDownload = useCallback(async () => {
    if (comparePicks.length > 0 || overviewDownloadFetching) return;
    setOverviewDownloadFetching(true);
    try {
      const path = `/api/crypto/${encodeURIComponent(symUpper)}/chart?range=${encodeURIComponent(range)}&series=${encodeURIComponent(chartSeries)}`;
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as { points?: StockChartPoint[] };
      const points = Array.isArray(json.points) ? json.points : [];
      if (points.length === 0) return;
      setOverviewDownloadSnapshot({
        variant: "stockOverview",
        ticker: symUpper,
        companyName: safeRow?.name ?? null,
        logoUrl: cryptoLogoSrc || serverCryptoLogo || null,
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
    symUpper,
    range,
    chartSeries,
    safeRow?.name,
    cryptoLogoSrc,
    serverCryptoLogo,
  ]);

  const cryptoDownloadDisabled =
    comparePicks.length > 0 || chartUi.loading || chartUi.empty || overviewDownloadFetching;

  return (
    <div className="relative min-w-0">
      <ChartScreenshotDownloadModal
        open={overviewDownloadOpen}
        onClose={() => setOverviewDownloadOpen(false)}
        snapshot={overviewDownloadSnapshot}
      />
      <CryptoBreadcrumbs symbol={symUpper} />
      <div className="space-y-5 px-4 py-0 max-md:pt-4 sm:space-y-5 sm:px-9 sm:py-6">
      <Suspense fallback={null}>
        <AssetPageTopLoader />
      </Suspense>

      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <LogoSkeleton sizeClass="h-12 w-12" />
            <div className="space-y-2">
              <SkeletonBox className="h-7 w-48 rounded-md" />
              <SkeletonBox className="h-4 w-32 rounded-md" />
            </div>
          </div>
          <SkeletonBox className="h-9 w-56 rounded-md" />
        </div>
      ) : !safeRow ? (
        <p className="text-[14px] text-[#71717A]">This asset is not available.</p>
      ) : (
        <CryptoHeader
          symbol={symUpper}
          displayName={displayName}
          logoUrl={headerLogoUrl}
          logoLetter={safeRow.symbol}
          periodLabel={isLiveCrypto ? (btcRangeHeader ? range : "Past 24 Hours") : "Past 24 Hours"}
          periodLabelOverride={headerUi.periodLabelOverride}
          chartRangeLabel={isLiveCrypto ? (btcRangeHeader ? range : "24H") : range}
          stockStyleLayout
          price={headerUi.displayPrice}
          changePct={headerUi.displayChangePct}
          changeAbs={headerUi.displayChangeAbs}
          selectionChangeAbs={headerUi.selectionChangeAbs}
          selectionChangePct={headerUi.selectionChangePct}
          chartLoading={headerUi.loading}
          chartEmpty={headerUi.empty}
          priceTimestampLabel={headerUi.priceTimestampLabel}
          scrubPeriodLabel={headerUi.scrubPeriodLabel}
          chartHovering={headerUi.isHovering && !headerUi.selectionActive}
          headerLoading={false}
        />
      )}

      {safeRow ? (
        <>
          <CryptoDetailTabNav activeTab={activeTab} onTabChange={setTabInUrl} />

          {/* BTC header 1D chart lives outside tabs so Overview can unmount without freezing the header. */}
          {cryptoChartDrivesHeader && mountHeaderChart ? (
            <div className={OFFSCREEN_PRICE_CHART} aria-hidden>
              <PriceChart
                key={`${symUpper}-header-1d`}
                kind="crypto"
                symbol={symUpper}
                range="1D"
                height={320}
                initialChart={initialSessionChartMemo}
                onDisplayChange={onSessionHeaderDisplay}
                liveSpotUsd={cryptoLiveWsTipSpot}
                liveQuotedAtSec={cryptoLiveWsTipQuotedAtSec}
              />
            </div>
          ) : null}

          {/* Active-tab only: keep-alive + hidden left multiple live charts (overview + portfolio) and froze the UI. */}
          {activeTab === "overview" ? (
            <div
              role="tabpanel"
              id="crypto-tab-overview"
              className="space-y-5 max-md:space-y-3"
            >
              <ChartControls
                activeRange={range}
                onRangeChange={setRange}
                rangeLabels={isLiveCrypto ? { "1D": "24H" } : undefined}
                chartSeries={chartSeries}
                onChartSeriesChange={setChartSeries}
                seriesSelectDisabled={comparePicks.length > 0}
                compareSlot={
                  <CryptoComparePicker
                    baseSymbol={symUpper}
                    values={comparePicks}
                    onAdd={onAddComparePick}
                    onRemove={onRemoveComparePick}
                  />
                }
                downloadSlot={
                  comparePicks.length > 0 ? null : (
                    <button
                      type="button"
                      onClick={() => void handleOpenCryptoDownload()}
                      disabled={cryptoDownloadDisabled}
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
                    key={`compare-${symUpper}-${comparePicks.map((p) => p.symbol.trim().toUpperCase()).join("-")}-${range}`}
                    primaryTicker={symUpper}
                    comparePicks={comparePicks}
                    range={range}
                  />
                ) : (
                  <PriceChart
                    kind="crypto"
                    symbol={symUpper}
                    range={range}
                    series={chartSeries}
                    initialChart={isLiveCrypto ? initialSessionChartMemo : initialChartMemo}
                    onDisplayChange={isLiveCrypto ? onRangeChartDisplay : undefined}
                    liveSpotUsd={range === "1D" ? cryptoLiveWsTipSpot : null}
                    liveQuotedAtSec={range === "1D" ? cryptoLiveWsTipQuotedAtSec : null}
                  />
                )}
              </ChartControls>
              {comparePicks.length > 0 ? (
                <MiniTable
                  ticker={symUpper}
                  cryptoPrimary={{
                    displayName: safeRow.name,
                    logoUrl: cryptoLogoSrc || serverCryptoLogo,
                  }}
                  initialPerformance={initialPerformance ?? null}
                  comparePicks={comparePicks}
                  onRemoveCompare={onRemoveComparePick}
                />
              ) : null}
              <div className="max-md:pt-0 md:pt-2">
                <CryptoKeyStats row={safeRow} />
              </div>
              <CryptoLinksSection links={safeRow.links} />
              <div className="pt-2">
                <LatestNews ticker={symUpper} initialItems={initialNews} variant="crypto" />
              </div>
            </div>
          ) : null}

          {activeTab === "holdings" ? (
            <div role="tabpanel" id="crypto-tab-holdings" className="block pt-1">
              <AssetPortfolioHoldingsTab
                assetKind="crypto"
                routeKey={symUpper}
                assetDisplayName={safeRow.name}
              />
            </div>
          ) : null}
        </>
      ) : null}
      </div>
    </div>
  );
}
