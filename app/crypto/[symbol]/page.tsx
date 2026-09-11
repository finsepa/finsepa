import { Suspense } from "react";
import { redirect } from "next/navigation";

import { StockPageSkeleton } from "@/components/stock/stock-page-skeleton";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { parseCryptoDetailTabQuery, type CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";

import { CryptoPageData } from "./crypto-page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function tabFromSearchParams(sp: Record<string, string | string[] | undefined> | undefined): CryptoDetailTabId {
  const raw = sp?.tab;
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseCryptoDetailTabQuery(s ?? null) ?? "overview";
}

/**
 * Stream shell first (`loading.tsx` + Suspense share StockPageSkeleton / pending soft-nav).
 * Slim SSR runs in {@link CryptoPageData}.
 */
export default async function CryptoSymbolPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();
  const canonicalSymbol = cryptoRouteBase(routeSymbol);
  const sp = searchParams ? await searchParams : {};
  const initialActiveTab = tabFromSearchParams(sp);

  if (canonicalSymbol !== routeSymbol) {
    const tabQuery = initialActiveTab !== "overview" ? `?tab=${initialActiveTab}` : "";
    redirect(`/crypto/${encodeURIComponent(canonicalSymbol)}${tabQuery}`);
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeSymbol)) {
    return <div className="px-4 py-4 text-fg-muted sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  return (
    <Suspense fallback={<StockPageSkeleton />}>
      <CryptoPageData routeSymbol={canonicalSymbol} initialActiveTab={initialActiveTab} />
    </Suspense>
  );
}
