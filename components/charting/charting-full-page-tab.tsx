"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { ChartingCompareWorkspace } from "@/components/charting/charting-compare-workspace";
import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import { ChartingWorkspace, STANDALONE_CHARTING_TIME_RANGE_ORDER } from "@/components/charting/charting-workspace";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import {
  CHARTING_MAX_COMPARE_TICKERS,
  buildStandaloneChartPath,
  parseChartingMetricsParam,
  type StandaloneChartRoute,
} from "@/lib/market/stock-charting-metrics";

type Props = {
  tickers: string[];
  /** Non-empty when `chartReady` — metrics query string. */
  metricParam: string;
  initialByTicker: Record<string, StockPageInitialData>;
  /** Which standalone route URL updates target (default `/charting`). */
  pathRoute?: StandaloneChartRoute;
  /** Toolbar heading (default `Charting`). */
  workspaceTitle?: string;
};

/** Standalone `/charting` or `/comparison` — multi-company compare or single-ticker workspace. */
export function ChartingFullPageTab({
  tickers,
  metricParam,
  initialByTicker,
  pathRoute = "/charting",
  workspaceTitle = "Charting",
}: Props) {
  const router = useRouter();

  if (tickers.length >= 2) {
    return (
      <ChartingCompareWorkspace
        tickers={tickers}
        metricParam={metricParam}
        initialByTicker={initialByTicker}
        pathRoute={pathRoute}
        workspaceTitle={workspaceTitle}
        timeRangeOrder={STANDALONE_CHARTING_TIME_RANGE_ORDER}
      />
    );
  }

  const t = tickers[0]!;
  const init = initialByTicker[t];
  const metricsInUrl = parseChartingMetricsParam(metricParam);

  return (
    <ChartingWorkspace
      ticker={t}
      metricParam={metricParam}
      initialAnnualPoints={init?.fundamentalsSeriesAnnual}
      initialQuarterlyPoints={init?.fundamentalsSeriesQuarterly}
      toolbarLayout="figma70857"
      pathRoute={pathRoute}
      workspaceTitle={workspaceTitle}
      timeRangeOrder={STANDALONE_CHARTING_TIME_RANGE_ORDER}
      fullPageCompanyChipSlot={
        <div className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white">
          <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
            <span className="truncate">{t}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              router.push(buildStandaloneChartPath(pathRoute, [], metricsInUrl));
            }}
            className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
            aria-label={`Remove ${t}`}
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      }
      fullPageCompanyAddSlot={
        <ChartingCompanyAddDropdown
          onPickStock={(sym) => {
            router.push(buildStandaloneChartPath(pathRoute, [t, sym], metricsInUrl));
          }}
          maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - 1)}
          excludeSymbols={[t]}
        />
      }
    />
  );
}
