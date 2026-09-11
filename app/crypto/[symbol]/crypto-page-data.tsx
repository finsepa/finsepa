import { loadCryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import type { CryptoDetailTabId } from "@/lib/crypto/crypto-detail-tab";

import { CryptoPageClient } from "./crypto-page-client";

/** Async RSC child — streams after Suspense / loading.tsx shell. */
export async function CryptoPageData({
  routeSymbol,
  initialActiveTab,
}: {
  routeSymbol: string;
  initialActiveTab: CryptoDetailTabId;
}) {
  const initialData = await loadCryptoPageInitialData(routeSymbol);
  return (
    <CryptoPageClient
      routeSymbol={routeSymbol}
      initialData={initialData}
      initialActiveTab={initialActiveTab}
    />
  );
}
