"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { HeatmapMarket, HeatmapMetric, HeatmapPagePayload } from "@/lib/heatmap/heatmap-types";
import { HEATMAP_LEGEND_STEPS, heatmapLegendHex } from "@/lib/heatmap/heatmap-colors";
import { MarketHeatmap } from "@/components/heatmap/market-heatmap";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import { cn } from "@/lib/utils";

const METRIC_OPTIONS_STOCKS: { value: HeatmapMetric; label: string }[] = [
  { value: "1d", label: "1D Performance" },
  { value: "5d", label: "5D Performance" },
  { value: "1m", label: "1M Performance" },
  { value: "ytd", label: "YTD Performance" },
];

const METRIC_OPTIONS_CRYPTO: { value: HeatmapMetric; label: string }[] = [
  { value: "1d", label: "1D Performance" },
  { value: "5d", label: "1W Performance" },
  { value: "1m", label: "1M Performance" },
  { value: "ytd", label: "YTD Performance" },
];

function heatmapHref(market: HeatmapMarket, metric: HeatmapMetric): string {
  const m = market === "crypto" ? "crypto" : "stocks";
  return `/heatmaps?market=${m}&metric=${metric}`;
}

function PerformanceLegendFigma() {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label="Performance scale">
      {HEATMAP_LEGEND_STEPS.map((s) => (
        <div
          key={s}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-medium leading-5 text-white"
          style={{ backgroundColor: heatmapLegendHex(s) }}
        >
          {s > 0 ? `+${s}` : s}
        </div>
      ))}
    </div>
  );
}

function MarketClassTabs({
  market,
  onChange,
}: {
  market: HeatmapMarket;
  onChange: (next: HeatmapMarket) => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1" role="tablist" aria-label="Asset class">
      {(["stocks", "crypto"] as const).map((m) => {
        const selected = market === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(m)}
            className={cn(
              "rounded-[10px] px-5 py-2 text-sm font-medium leading-5 text-[#09090B] transition-colors",
              selected ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]/70",
            )}
          >
            {m === "stocks" ? "Stocks" : "Crypto"}
          </button>
        );
      })}
    </div>
  );
}

export function HeatmapPageClient({ initial }: { initial: HeatmapPagePayload }) {
  const { market, metric, leaves } = initial;
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setFs(true);
      } else {
        await document.exitFullscreen();
        setFs(false);
      }
    } catch {
      setFs(!!document.fullscreenElement);
    }
  }, []);

  const metricOptions = market === "crypto" ? METRIC_OPTIONS_CRYPTO : METRIC_OPTIONS_STOCKS;

  return (
    <div
      ref={containerRef}
      className={cn("flex min-w-0 flex-col gap-5", fs && "rounded-xl bg-[#FAFAFA] p-4")}
    >
      {/* Figma: single toolbar — tabs | legend + dropdown + fullscreen */}
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-1">
        <div className="flex min-h-9 min-w-0 sm:flex-1 sm:items-center">
          <MarketClassTabs market={market} onChange={(next) => router.push(heatmapHref(next, metric))} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-3 sm:ml-auto sm:flex-1 sm:justify-end sm:gap-4">
          <PerformanceLegendFigma />
          <FormListboxSelect
            value={metric}
            onChange={(next) => router.push(heatmapHref(market, next))}
            options={metricOptions}
            aria-label="Performance window"
            className="w-[min(100%,200px)] shrink-0 sm:w-[200px]"
            triggerClassName="border border-solid border-[#E4E4E7] bg-white shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] hover:bg-[#FAFAFA]"
          />
          <button
            type="button"
            onClick={() => void toggleFs()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-solid border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
            aria-label={fs ? "Exit full screen" : "Full screen"}
          >
            {fs ? <Minimize2 className="h-5 w-5" strokeWidth={1.75} /> : <Maximize2 className="h-5 w-5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {leaves.length === 0 ? (
        <p className="rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-4 py-8 text-center text-sm text-[#71717A]">
          No data available for this view.
        </p>
      ) : (
        <MarketHeatmap leaves={leaves} market={market} />
      )}
    </div>
  );
}
