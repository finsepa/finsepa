"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AssetPageTopLoader } from "@/components/layout/asset-page-top-loader";
import type { ChartDisplayState } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { CryptoHeader } from "@/components/crypto/crypto-header";
import { CryptoKeyStats } from "@/components/crypto/crypto-key-stats";
import { CryptoLinksSection } from "@/components/crypto/crypto-links-section";
import { CryptoMiniTable } from "@/components/crypto/crypto-mini-table";
import { LogoSkeleton, SkeletonBox } from "@/components/markets/skeleton";
import { ChartControls } from "@/components/stock/chart-controls";
import { LatestNews } from "@/components/stock/latest-news";
import { CryptoDetailTabNav } from "@/components/crypto/crypto-detail-tab-nav";
import { AssetPortfolioHoldingsTab } from "@/components/portfolio/asset-portfolio-holdings-tab";
import { parseCryptoDetailTabQuery, type CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";
import { mergeSessionHeaderWithPerformanceSpot } from "@/lib/chart/merge-session-header-with-performance-spot";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import type { CryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

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

const OFFSCREEN_PRICE_CHART =
  "pointer-events-none fixed left-0 top-0 -z-10 h-[320px] w-[min(1200px,calc(100vw-4.5rem))] -translate-x-[120vw] opacity-0";

function initialCryptoTabsMounted(tab: CryptoDetailTabId): Record<CryptoDetailTabId, boolean> {
  return {
    overview: tab === "overview",
    holdings: tab === "holdings",
  };
}

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
  const [range, setRange] = useState<StockChartRange>("1Y");
  const [sessionHeaderUi, setSessionHeaderUi] = useState<ChartDisplayState>(EMPTY_CHART_DISPLAY);
  const [rangeSelectionHeaderUi, setRangeSelectionHeaderUi] = useState<ChartDisplayState | null>(null);
  const [holdingsHeaderUi, setHoldingsHeaderUi] = useState<ChartDisplayState | null>(null);
  const symUpper = routeSymbol.trim().toUpperCase();

  /** URL tab from the client router — applied after mount so the first paint matches SSR (`initialActiveTab`). */
  const [searchSyncedTab, setSearchSyncedTab] = useState<CryptoDetailTabId | null>(null);
  const [tabsMounted, setTabsMounted] = useState<Record<CryptoDetailTabId, boolean>>(() =>
    initialCryptoTabsMounted(initialActiveTab),
  );

  useEffect(() => {
    const next = parseCryptoDetailTabQuery(searchParams.get("tab")) ?? initialActiveTab;
    queueMicrotask(() => {
      setSearchSyncedTab(next);
      setTabsMounted((m) => ({ ...m, [next]: true }));
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

  const onRangeChartDisplay = useCallback((s: ChartDisplayState) => {
    if (s.selectionActive) setRangeSelectionHeaderUi(s);
    else setRangeSelectionHeaderUi(null);
  }, []);

  const onHoldingsChartDisplay = useCallback((s: ChartDisplayState) => {
    setHoldingsHeaderUi(s);
  }, []);

  const cryptoChartDrivesHeader = activeTab !== "holdings";

  const performanceFromServer = useMemo(
    (): StockPerformance | null =>
      serverMatch?.performance != null ? serverMatch.performance : null,
    [serverMatch],
  );

  const [performanceClient, setPerformanceClient] = useState<StockPerformance | null>(null);

  const [headerLiveSpotClient, setHeaderLiveSpotClient] = useState<number | null>(null);

  useEffect(() => {
    setHeaderLiveSpotClient(null);
  }, [symUpper]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/crypto/${encodeURIComponent(symUpper)}/live-price`, {
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
  }, [symUpper, performanceFromServer?.price]);

  const performanceForHeaderFallback = performanceFromServer ?? performanceClient;

  const headerLiveSpotForMerge =
    headerLiveSpotClient ?? (serverMatch?.headerLiveSpotUsd != null ? serverMatch.headerLiveSpotUsd : null);

  const chartUi = useMemo((): ChartDisplayState => {
    if (activeTab === "holdings") {
      return holdingsHeaderUi ?? EMPTY_CHART_DISPLAY;
    }
    if (rangeSelectionHeaderUi?.selectionActive) {
      return rangeSelectionHeaderUi;
    }
    return mergeSessionHeaderWithPerformanceSpot(
      sessionHeaderUi,
      performanceForHeaderFallback,
      "price",
      headerLiveSpotForMerge,
    );
  }, [
    activeTab,
    headerLiveSpotForMerge,
    holdingsHeaderUi,
    performanceForHeaderFallback,
    rangeSelectionHeaderUi,
    sessionHeaderUi,
  ]);

  const initialChartMemo = useMemo(() => (serverMatch ? serverMatch.chart : null), [serverMatch]);

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

  return (
    <div className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
      <Suspense fallback={null}>
        <AssetPageTopLoader />
      </Suspense>

      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
            <span>Crypto</span>
            <span>/</span>
            <span className="font-medium text-[#09090B]">{symUpper}</span>
          </div>
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
          headerLoading={false}
        />
      )}

      {safeRow ? (
        <>
          <CryptoDetailTabNav activeTab={activeTab} onTabChange={setTabInUrl} />

          {tabsMounted.overview ? (
            <div
              role="tabpanel"
              id="crypto-tab-overview"
              aria-hidden={activeTab !== "overview"}
              className={activeTab === "overview" ? "space-y-5" : "hidden"}
            >
              <ChartControls activeRange={range} onRangeChange={setRange} />
              <PriceChart
                kind="crypto"
                symbol={symUpper}
                range={range}
                onDisplayChange={cryptoChartDrivesHeader ? onRangeChartDisplay : undefined}
                initialChart={initialChartMemo}
              />
              {cryptoChartDrivesHeader ? (
                <div className={OFFSCREEN_PRICE_CHART} aria-hidden>
                  <PriceChart
                    key={`${symUpper}-header-1d`}
                    kind="crypto"
                    symbol={symUpper}
                    range="1D"
                    height={320}
                    onDisplayChange={onSessionHeaderDisplay}
                  />
                </div>
              ) : null}
              <CryptoMiniTable
                symbol={symUpper}
                displayName={safeRow.name}
                logoUrl={cryptoLogoSrc || serverCryptoLogo}
                initialPerformance={initialPerformance ?? null}
              />
              <div className="pt-2">
                <CryptoKeyStats row={safeRow} />
              </div>
              <CryptoLinksSection links={safeRow.links} />
              <div className="pt-2">
                <LatestNews ticker={symUpper} initialItems={initialNews} variant="crypto" />
              </div>
            </div>
          ) : null}

          {tabsMounted.holdings ? (
            <div
              role="tabpanel"
              id="crypto-tab-holdings"
              aria-hidden={activeTab !== "holdings"}
              className={activeTab === "holdings" ? "block pt-1" : "hidden"}
            >
              <AssetPortfolioHoldingsTab
                assetKind="crypto"
                routeKey={symUpper}
                assetDisplayName={safeRow.name}
                onChartDisplayChange={onHoldingsChartDisplay}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
