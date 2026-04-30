import { HeatmapPageClient } from "@/components/heatmap/heatmap-page-client";
import {
  buildHeatmapPagePayload,
  heatmapMarketFromSearchParam,
  heatmapMetricFromSearchParam,
} from "@/lib/heatmap/build-heatmap-payload";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HeatmapsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const market = heatmapMarketFromSearchParam(sp.market);
  const metric = heatmapMetricFromSearchParam(sp.metric);
  const payload = await buildHeatmapPagePayload(market, metric);

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <HeatmapPageClient key={`${market}-${metric}`} initial={payload} />
    </div>
  );
}
