"use client";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  CHART_SCREENSHOT_ASSET_HEADER_HEIGHT_PX,
  CHART_SCREENSHOT_ASSET_HEADER_TOP_OFFSET_PX,
} from "@/lib/chart/chart-screenshot-constants";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";

type ChartScreenshotAssetHeaderProps = {
  ticker: string;
  companyName?: string | null;
  logoUrl?: string | null;
  /** Key Stats metric export — metric name as primary title, company as subtitle. */
  metricTitle?: string | null;
};

export function ChartScreenshotAssetHeader({
  ticker,
  companyName,
  logoUrl,
  metricTitle,
}: ChartScreenshotAssetHeaderProps) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const titleName = companyName?.trim() || meta.name;
  const resolvedLogo = logoUrl?.trim() || meta.logoUrl || "";
  const metricLine = metricTitle?.trim() || null;

  return (
    <div
      className="flex w-full min-w-0 shrink-0 items-center justify-center gap-3"
      style={{
        height: CHART_SCREENSHOT_ASSET_HEADER_HEIGHT_PX,
        marginTop: CHART_SCREENSHOT_ASSET_HEADER_TOP_OFFSET_PX,
      }}
    >
      <CompanyLogo
        name={titleName}
        logoUrl={resolvedLogo}
        symbol={symbol}
        size="40"
        eagerLoad
      />
      {metricLine ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[18px] font-semibold leading-6 text-[#09090B]">{metricLine}</span>
          <span className="shrink-0 text-[18px] font-normal leading-6 text-[#71717A]" aria-hidden>
            ·
          </span>
          <span className="truncate text-[18px] font-semibold leading-6 text-[#09090B]">{titleName}</span>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[18px] font-semibold leading-6 text-[#09090B]">{titleName}</span>
          <span className="shrink-0 text-[18px] font-normal leading-6 text-[#71717A]" aria-hidden>
            ·
          </span>
          <span className="shrink-0 text-[18px] font-semibold leading-6 text-[#71717A]">{symbol}</span>
        </div>
      )}
    </div>
  );
}
