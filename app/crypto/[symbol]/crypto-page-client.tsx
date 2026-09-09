"use client";

import { CryptoPageContent } from "@/components/crypto/crypto-page-content";
import type { CryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import type { CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";

export function CryptoPageClient({
  routeSymbol,
  initialData,
  initialActiveTab,
}: {
  routeSymbol: string;
  initialData: CryptoPageInitialData | null;
  initialActiveTab: CryptoDetailTabId;
}) {
  // `useSearchParams` is isolated in SearchParamsBridge so soft-nav does not
  // blank the page behind Suspense fallback={null}.
  return (
    <CryptoPageContent
      key={routeSymbol}
      routeSymbol={routeSymbol}
      initialData={initialData}
      initialActiveTab={initialActiveTab}
    />
  );
}
