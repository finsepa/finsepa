"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

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
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import type { CryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

export function CryptoPageContent({
  routeSymbol,
  initialData,
}: {
  routeSymbol: string;
  initialData?: CryptoPageInitialData | null;
}) {
  const symKey = routeSymbol.trim().toUpperCase();
  const serverMatch =
    initialData != null && initialData.routeSymbol.trim().toUpperCase() === symKey ? initialData : null;

  const [loading, setLoading] = useState(!serverMatch);
  const [row, setRow] = useState<CryptoAssetRow | null>(serverMatch?.asset ?? null);
  const [range, setRange] = useState<StockChartRange>("1Y");
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
  const symUpper = routeSymbol.trim().toUpperCase();

  const onChartDisplay = useCallback((s: ChartDisplayState) => {
    setChartUi(s);
  }, []);

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
    <div className="relative space-y-5 px-9 py-6">
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
          periodLabel={range}
          periodLabelOverride={chartUi.periodLabelOverride}
          price={chartUi.displayPrice}
          changePct={chartUi.displayChangePct}
          changeAbs={chartUi.displayChangeAbs}
          chartLoading={chartUi.loading}
          chartEmpty={chartUi.empty}
          priceTimestampLabel={chartUi.priceTimestampLabel}
          chartHovering={chartUi.isHovering && !chartUi.selectionActive}
          headerLoading={false}
        />
      )}

      {safeRow ? (
        <>
          <ChartControls activeRange={range} onRangeChange={setRange} />
          <PriceChart
            kind="crypto"
            symbol={symUpper}
            range={range}
            onDisplayChange={onChartDisplay}
            initialChart={initialChartMemo}
          />
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
        </>
      ) : null}
    </div>
  );
}
