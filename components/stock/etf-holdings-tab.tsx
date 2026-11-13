"use client";

import Link from "next/link";

import {
  MOBILE_ELEVATED_CARD_CLASS,
  STOCK_OVERVIEW_SECTION_TITLE_CLASS,
} from "@/components/design-system/card-surface-styles";
import { AllocationWeightValue } from "@/components/portfolio/allocation-weight-pie";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { Spinner } from "@/components/ui/spinner";
import type { EtfHolding, EtfWeight } from "@/lib/market/etf-profile-types";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { useEtfProfile } from "@/lib/market/use-etf-profile";
import { cn } from "@/lib/utils";

const SECTOR_COLORS = ["#6366F1", "#F87171", "#FBBF24", "#4ADE80", "#38BDF8", "#2DD4BF", "#FB923C", "#A78BFA"];
const OTHER_COLOR = "#A1A1AA";
const MAX_LEGEND_SECTORS = 6;
const MAX_LISTED_HOLDINGS = 20;

/** Top sectors + a single "Other" bucket so the bar and legend stay readable. */
function sectorSegments(sectors: EtfWeight[]): { label: string; pct: number; color: string }[] {
  const top = sectors.slice(0, MAX_LEGEND_SECTORS).map((s, i) => ({ ...s, color: SECTOR_COLORS[i % SECTOR_COLORS.length]! }));
  const rest = sectors.slice(MAX_LEGEND_SECTORS).reduce((sum, s) => sum + s.pct, 0);
  return rest > 0.05 ? [...top, { label: "Other", pct: rest, color: OTHER_COLOR }] : top;
}

function SectorExposure({ sectors }: { sectors: EtfWeight[] }) {
  const segments = sectorSegments(sectors);
  const total = segments.reduce((sum, s) => sum + s.pct, 0) || 1;
  return (
    <section aria-label="Sector exposure" className="space-y-3">
      <h3 className={STOCK_OVERVIEW_SECTION_TITLE_CLASS}>Sector exposure</h3>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <span
            key={s.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.pct / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label} ${s.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5 text-[13px] leading-5 text-fg-muted">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
            <span className="font-medium tabular-nums text-fg">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Holding + numerics — same column rhythm as the portfolio holdings table. */
const HOLDINGS_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(88px,160px)_minmax(104px,160px)] items-center gap-x-2";

/** Matches screener / portfolio asset column — ticker, underline on row hover. */
const HOLDING_TICKER_CLASS =
  "truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline";

function HoldingRow({ holding }: { holding: EtfHolding }) {
  const cells = (
    <div
      className={cn(
        HOLDINGS_GRID_CLASS,
        "min-h-[56px] text-[14px] font-normal leading-5",
        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-3 pr-2", TABLE_START_ALIGNED_PAD_CLASS)}>
        <CompanyLogo name={holding.name} logoUrl={holding.logoUrl} symbol={holding.code} />
        <div className="min-w-0 text-left">
          <div className={HOLDING_TICKER_CLASS}>{holding.code}</div>
          <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">{holding.name}</div>
        </div>
      </div>
      <div
        className={cn(
          "min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-fg",
          TABLE_END_ALIGNED_PAD_CLASS,
        )}
      >
        {holding.valueUsd != null ? formatUsdCompact(holding.valueUsd) : "—"}
      </div>
      <div
        className={cn(
          "min-w-0 w-full whitespace-nowrap text-right font-['Inter'] tabular-nums text-fg",
          TABLE_END_ALIGNED_PAD_CLASS,
        )}
      >
        <AllocationWeightValue pct={holding.weightPct} label={holding.weightPct.toFixed(2)} />
      </div>
    </div>
  );
  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        {holding.href ? (
          <Link
            href={holding.href}
            prefetch={false}
            className="block rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
            aria-label={`Open ${holding.name}`}
          >
            {cells}
          </Link>
        ) : (
          cells
        )}
      </div>
    </div>
  );
}

function HoldingsTable({ holdings }: { holdings: EtfHolding[] }) {
  return (
    <ScreenerTableScroll>
      <div className="bg-surface">
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "md:border-b-0",
          )}
        >
          <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
            <div className={cn(HOLDINGS_GRID_CLASS, "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted")}>
              <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Holding</div>
              <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Value</div>
              <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Weight</div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>
        {holdings.map((h) => (
          <HoldingRow key={h.code} holding={h} />
        ))}
      </div>
    </ScreenerTableScroll>
  );
}

/** ETF constituents — sector exposure bar + weighted holdings list (EODHD `ETF_Data`). */
export function EtfHoldingsTab({ ticker, isActive }: { ticker: string; isActive: boolean }) {
  const { profile, loading } = useEtfProfile(ticker, isActive);

  if (loading) {
    return (
      <div className={cn("flex min-h-[240px] items-center justify-center", MOBILE_ELEVATED_CARD_CLASS)}>
        <Spinner className="size-5 text-[#71717A]" />
      </div>
    );
  }

  if (!profile || (!profile.holdings.length && !profile.sectors.length)) {
    return (
      <div className={cn("px-5 py-10 text-center text-[14px] text-fg-muted", MOBILE_ELEVATED_CARD_CLASS)}>
        Holdings aren&apos;t available for this fund.
      </div>
    );
  }

  const lookThrough = profile.lookThrough;
  const allHoldings = lookThrough?.holdings ?? profile.holdings;
  const holdings = allHoldings.slice(0, MAX_LISTED_HOLDINGS);

  return (
    <div className="space-y-4">
      {profile.sectors.length ? (
        <div className={cn("p-4 sm:p-5", MOBILE_ELEVATED_CARD_CLASS)}>
          <SectorExposure sectors={profile.sectors} />
        </div>
      ) : null}

      {holdings.length ? (
        <section aria-label="Holdings" className="space-y-2">
          <HoldingsTable holdings={holdings} />
          <p className="px-1 text-[12px] leading-4 text-fg-muted">
            {lookThrough ? (
              <>
                This fund holds{" "}
                <Link href={`/stock/${encodeURIComponent(lookThrough.viaCode)}`} prefetch={false} className="font-medium text-fg hover:underline">
                  {lookThrough.viaCode}
                </Link>
                ; holdings shown through it, weighted by this fund&apos;s exposure.{" "}
              </>
            ) : null}
            Value is the holding&apos;s weight × fund AUM.
          </p>
        </section>
      ) : null}
    </div>
  );
}
