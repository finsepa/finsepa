"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "@/lib/icons";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import type { CompanyPickerOpenControls } from "@/components/charting/company-picker";
import {
  useChartingRailPickerAnchors,
  useRegisterChartingCompanyRail,
} from "@/components/charting/charting-company-rail-context";
import { ComparisonCompanyLimitModal } from "@/components/comparison/comparison-company-limit-modal";
import {
  COMPARISON_MAX_COMPANIES,
  capComparisonTickers,
  writeComparisonSessionTickers,
} from "@/lib/comparison/comparison-session";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { buildComparisonPath, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";

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
    () => capComparisonTickers(tickersFromRouter.length > 0 ? tickersFromRouter : tickers),
    [tickers, tickersFromRouter],
  );

  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const companyPickerControlsRef = useRef<CompanyPickerOpenControls | null>(null);
  const { useRailPickers, companyAddAnchorRef } = useChartingRailPickerAnchors();

  const syncUrl = useCallback(
    (nextTickers: string[]) => {
      const normalized = capComparisonTickers(
        parseChartingTickerList(
          nextTickers
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)
            .join(","),
        ),
      );
      writeComparisonSessionTickers(normalized);
      router.replace(buildComparisonPath(normalized, []), { scroll: false });
    },
    [router],
  );

  const removeTicker = useCallback(
    (sym: string) => {
      syncUrl(displayTickers.filter((t) => t !== sym));
    },
    [displayTickers, syncUrl],
  );

  const tryAddTicker = useCallback(
    (sym: string) => {
      const u = sym.trim().toUpperCase();
      if (displayTickers.includes(u)) return;
      if (displayTickers.length >= COMPARISON_MAX_COMPANIES) {
        setLimitModalOpen(true);
        return;
      }
      syncUrl([...displayTickers, u]);
    },
    [displayTickers, syncUrl],
  );

  const openCompanyPicker = useCallback(() => {
    companyPickerControlsRef.current?.open();
  }, []);

  useRegisterChartingCompanyRail(
    {
      openMetricPicker: () => {},
      openCompanyPicker,
      metricAddDisabled: true,
      companyAddDisabled: displayTickers.length >= COMPARISON_MAX_COMPANIES,
      companies: useRailPickers ? displayTickers.map((ticker) => ({ ticker })) : undefined,
      onRemoveCompany: useRailPickers ? removeTicker : undefined,
    },
    useRailPickers,
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold leading-9 tracking-tight text-[#0F0F0F]">Comparison</h1>

      {useRailPickers ? (
        <div className="sr-only">
          <ChartingCompanyAddDropdown
            hideTrigger
            anchorRef={companyAddAnchorRef}
            menuPortal
            menuAlign="trailing"
            registerOpenControl={(controls) => {
              companyPickerControlsRef.current = controls;
              return () => {
                if (companyPickerControlsRef.current === controls) {
                  companyPickerControlsRef.current = null;
                }
              };
            }}
            onPickStock={tryAddTicker}
            maxExtraCompanies={Math.max(0, COMPARISON_MAX_COMPANIES - displayTickers.length)}
            excludeSymbols={displayTickers}
            alwaysAllowOpen
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {displayTickers.map((sym) => (
            <div
              key={sym}
              className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
            >
              <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#0F0F0F]">
                <span className="truncate">{sym}</span>
              </span>
              <button
                type="button"
                onClick={() => removeTicker(sym)}
                className="flex w-9 shrink-0 items-center justify-center text-[#0F0F0F] transition-colors hover:bg-[#FAFAFA]"
                aria-label={`Remove ${sym}`}
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          ))}
          <ChartingCompanyAddDropdown
            onPickStock={tryAddTicker}
            maxExtraCompanies={Math.max(0, COMPARISON_MAX_COMPANIES - displayTickers.length)}
            excludeSymbols={displayTickers}
            alwaysAllowOpen
          />
        </div>
      )}

      <ComparisonCompanyLimitModal open={limitModalOpen} onClose={() => setLimitModalOpen(false)} />
    </div>
  );
}
