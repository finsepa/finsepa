import { Suspense } from "react";

import { ScreenerBrowserTrace } from "@/components/screener/screener-browser-trace";
import { MarketsSection } from "@/components/screener/markets-section";
import { buildScreenerPagePayload } from "@/lib/screener/screener-page-payload";

export default async function ScreenerPage() {
  const payload = await buildScreenerPagePayload();

  return (
    <div className="px-9 py-6">
      <ScreenerBrowserTrace />
      <Suspense fallback={null}>
        <MarketsSection
          stockRows={payload.stockRows}
          cryptoRows={payload.cryptoRows}
          indicesRows={payload.indicesRows}
          indexCards={payload.indexCards}
        />
      </Suspense>
    </div>
  );
}
