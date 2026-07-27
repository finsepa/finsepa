"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "@/lib/icons";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import type { CompanyPickerOpenControls } from "@/components/charting/company-picker";
import {
  useChartingRailPickerAnchors,
  useRegisterChartingCompanyRail,
} from "@/components/charting/charting-company-rail-context";
import { ComparisonCompanyLimitModal } from "@/components/comparison/comparison-company-limit-modal";
import { ComparisonPageBar } from "@/components/comparison/comparison-page-bar";
import {
  whiteSurfaceChipDividerClass,
  whiteSurfaceChipLabelClass,
  whiteSurfaceChipRemoveClass,
  whiteSurfaceChipShellClass,
} from "@/components/design-system";
import { CompanyRailCard } from "@/components/layout/company-rail";
import { cn } from "@/lib/utils";
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
  children?: ReactNode;
};

/** Comparison empty state — company picker only (no charting metric / period chrome). */
export function ComparisonEmptyToolbar({ tickers, allowedChartingTickers, children }: Props) {
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
    <div className="flex flex-col gap-5 px-4 py-4 sm:px-9 sm:py-6">
      <ComparisonPageBar showReset={false} />

      <div className="flex items-start gap-5">
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            useRailPickers ? undefined : "gap-5",
          )}
        >
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
                <div key={sym} className={whiteSurfaceChipShellClass}>
                  <span className={cn(whiteSurfaceChipLabelClass, whiteSurfaceChipDividerClass)}>
                    <span className="truncate">{sym}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTicker(sym)}
                    className={whiteSurfaceChipRemoveClass}
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

          {children}
        </div>

        {useRailPickers ? (
          <CompanyRailCard showMetrics={false} className="hidden w-[240px] self-start md:block" />
        ) : null}
      </div>

      <ComparisonCompanyLimitModal open={limitModalOpen} onClose={() => setLimitModalOpen(false)} />
    </div>
  );
}
