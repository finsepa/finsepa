"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import type { HeatmapMarket, HeatmapMetric, HeatmapPagePayload } from "@/lib/heatmap/heatmap-types";
import { MarketHeatmap } from "@/components/heatmap/market-heatmap";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";

const METRIC_OPTIONS_STOCKS: { value: HeatmapMetric; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1m", label: "1M" },
  { value: "ytd", label: "YTD" },
];

const METRIC_OPTIONS_CRYPTO: { value: HeatmapMetric; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "ytd", label: "YTD" },
];

function heatmapHref(market: HeatmapMarket, metric: HeatmapMetric): string {
  const m = market === "crypto" ? "crypto" : "stocks";
  return `/heatmaps?market=${m}&metric=${metric}`;
}

function MarketClassTabs({
  market,
  onChange,
}: {
  market: HeatmapMarket;
  onChange: (next: HeatmapMarket) => void;
}) {
  const options: readonly TabSwitcherOption<HeatmapMarket>[] = [
    { value: "stocks", label: "Stocks" },
    { value: "crypto", label: "Crypto" },
  ];

  return (
    <TabSwitcher
      options={options}
      value={market}
      onChange={onChange}
      aria-label="Asset class"
    />
  );
}

function MetricTabs({
  market,
  metric,
  onChange,
}: {
  market: HeatmapMarket;
  metric: HeatmapMetric;
  onChange: (next: HeatmapMetric) => void;
}) {
  const options: readonly TabSwitcherOption<HeatmapMetric>[] =
    market === "crypto" ? METRIC_OPTIONS_CRYPTO : METRIC_OPTIONS_STOCKS;

  return (
    <TabSwitcher
      options={options}
      value={metric}
      onChange={onChange}
      aria-label="Performance window"
    />
  );
}

export function HeatmapPageClient({ initial }: { initial: HeatmapPagePayload }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [payload, setPayload] = useState(initial);
  const [displayMarket, setDisplayMarket] = useState(initial.market);
  const [displayMetric, setDisplayMetric] = useState(initial.metric);

  useEffect(() => {
    setPayload(initial);
  }, [initial]);

  useEffect(() => {
    setDisplayMarket(initial.market);
    setDisplayMetric(initial.metric);
  }, [initial.market, initial.metric]);

  const setMarket = useCallback(
    (next: HeatmapMarket) => {
      if (next === displayMarket) return;
      setDisplayMarket(next);
      startTransition(() => {
        router.push(heatmapHref(next, displayMetric));
      });
    },
    [displayMarket, displayMetric, router],
  );

  const setMetric = useCallback(
    (next: HeatmapMetric) => {
      if (next === displayMetric) return;
      setDisplayMetric(next);
      startTransition(() => {
        router.push(heatmapHref(displayMarket, next));
      });
    },
    [displayMarket, displayMetric, router],
  );

  const { leaves } = payload;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="flex min-h-9 min-w-0 items-center">
          <MarketClassTabs market={displayMarket} onChange={setMarket} />
        </div>
        <div className="ml-auto flex min-w-0 flex-nowrap items-center justify-end">
          <MetricTabs market={displayMarket} metric={displayMetric} onChange={setMetric} />
        </div>
      </div>

      {leaves.length === 0 ? (
        <p className="rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-4 py-8 text-center text-sm text-[#71717A]">
          No data available for this view.
        </p>
      ) : (
        <MarketHeatmap leaves={leaves} market={payload.market} />
      )}
    </div>
  );
}
