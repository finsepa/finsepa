import { Suspense } from "react";

import { MacroPage } from "@/components/macro/macro-page";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { getMacroDashboardPayloadCached } from "@/lib/market/macro-dashboard-payload";
import MacroLoading from "./loading";

async function MacroPageLoader() {
  const { items } = await getMacroDashboardPayloadCached();
  return <MacroPage initialItems={items} />;
}

export default function Page() {
  if (isSingleAssetMode()) {
    return <div className="px-4 py-4 text-fg-muted sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  // Fetch inside Suspense so client navigations swap to the skeleton immediately
  // instead of keeping the previous page frozen while macro data loads.
  return (
    <Suspense fallback={<MacroLoading />}>
      <MacroPageLoader />
    </Suspense>
  );
}
