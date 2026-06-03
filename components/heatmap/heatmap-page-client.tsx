"use client";

import { Info, Maximize2, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { HeatmapMarket, HeatmapMetric, HeatmapPagePayload } from "@/lib/heatmap/heatmap-types";
import { HEATMAP_LEGEND_STEPS, heatmapLegendHex } from "@/lib/heatmap/heatmap-colors";
import { MarketHeatmap } from "@/components/heatmap/market-heatmap";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { dropdownMenuPanelBodyClassName } from "@/components/design-system/dropdown-menu-styles";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

function PerformanceLegendFigma() {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label="Performance scale">
      {HEATMAP_LEGEND_STEPS.map((s) => (
        <div
          key={s}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold leading-4 text-white sm:h-9 sm:w-9 sm:rounded-[10px] sm:text-sm sm:font-medium sm:leading-5"
          style={{ backgroundColor: heatmapLegendHex(s) }}
        >
          {s > 0 ? `+${s}%` : `${s}%`}
        </div>
      ))}
    </div>
  );
}

function PerformanceLegendInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-solid border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
          aria-label="Performance scale info"
        >
          <Info className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className={cn(dropdownMenuPanelBodyClassName, "gap-2 px-2 py-2")}>
          <p className="px-2 text-[11px] font-medium leading-4 text-[#71717A]">Performance scale</p>
          <div className="px-2">
            <PerformanceLegendFigma />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
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
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="flex min-h-9 min-w-0 items-center">
          <MarketClassTabs market={market} onChange={(next) => router.push(heatmapHref(next, metric))} />
        </div>
        <div className="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-2">
          <PerformanceLegendInfo />
          <FormListboxSelect
            value={metric}
            onChange={(next) => router.push(heatmapHref(market, next))}
            options={metricOptions}
            aria-label="Performance window"
            compact
            className="min-w-[88px] shrink-0"
            triggerClassName="border border-solid border-[#E4E4E7] bg-white px-3 shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] hover:bg-[#FAFAFA] sm:px-4"
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
