"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import {
  CHARTING_MAX_COMPARE_TICKERS,
  buildStandaloneChartPath,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";

type Props = {
  tickers: string[];
  allowedChartingTickers: string[];
};

/** Comparison empty state — company picker only (no charting metric / period chrome). */
export function ComparisonEmptyToolbar({ tickers, allowedChartingTickers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chartingAllowSet = useMemo(
    () => new Set(allowedChartingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
    [allowedChartingTickers],
  );

  const tickersFromRouter = useMemo(() => {
    const raw = searchParams.get("ticker")?.trim() ?? "";
    const parsed = parseChartingTickerList(raw || null);
    return parsed.filter((t) => {
      if (isSingleAssetMode()) return isSupportedAsset(t);
      return chartingAllowSet.has(t.trim().toUpperCase());
    });
  }, [searchParams, chartingAllowSet]);

  const displayTickers = useMemo(
    () => (tickersFromRouter.length > 0 ? tickersFromRouter : tickers),
    [tickers, tickersFromRouter],
  );

  const syncUrl = useCallback(
    (nextTickers: string[]) => {
      router.replace(buildStandaloneChartPath("/comparison", nextTickers, []), { scroll: false });
    },
    [router],
  );

  const removeTicker = useCallback(
    (sym: string) => {
      syncUrl(displayTickers.filter((t) => t !== sym));
    },
    [displayTickers, syncUrl],
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">Comparison</h1>

      <div className="flex flex-wrap items-center gap-3">
        {displayTickers.map((sym) => (
          <div
            key={sym}
            className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          >
            <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
              <span className="truncate">{sym}</span>
            </span>
            <button
              type="button"
              onClick={() => removeTicker(sym)}
              className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
              aria-label={`Remove ${sym}`}
            >
              <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ))}
        <ChartingCompanyAddDropdown
          onPickStock={(sym) => {
            const u = sym.trim().toUpperCase();
            if (displayTickers.includes(u)) return;
            if (displayTickers.length >= CHARTING_MAX_COMPARE_TICKERS) return;
            syncUrl([...displayTickers, u]);
          }}
          disabled={displayTickers.length >= CHARTING_MAX_COMPARE_TICKERS}
          maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - displayTickers.length)}
          excludeSymbols={displayTickers}
        />
      </div>
    </div>
  );
}
