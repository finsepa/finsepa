"use client";

import Link from "next/link";

import {
  MOBILE_ELEVATED_CARD_CLASS,
  STOCK_OVERVIEW_SECTION_TITLE_CLASS,
} from "@/components/design-system/card-surface-styles";
import { CompanyLogo } from "@/components/screener/company-logo";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight } from "@/lib/icons";
import type { EtfHolding, EtfWeight } from "@/lib/market/etf-profile-types";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { useEtfProfile } from "@/lib/market/use-etf-profile";
import { cn } from "@/lib/utils";

const SECTOR_COLORS = ["#6366F1", "#F87171", "#FBBF24", "#4ADE80", "#38BDF8", "#2DD4BF", "#FB923C", "#A78BFA"];
const OTHER_COLOR = "#A1A1AA";
const MAX_LEGEND_SECTORS = 6;

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

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_88px_minmax(96px,1.2fr)_20px] items-center gap-4 md:grid-cols-[minmax(0,1.4fr)_120px_minmax(160px,1.6fr)_20px]";

function HoldingRow({ holding, maxWeight }: { holding: EtfHolding; maxWeight: number }) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <CompanyLogo name={holding.name} logoUrl={holding.logoUrl} symbol={holding.code} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold leading-5 text-fg">{holding.code}</span>
          <span className="block truncate text-[12px] leading-4 text-fg-muted">{holding.name}</span>
        </span>
      </span>
      <span className="text-right text-[14px] tabular-nums text-fg">
        {holding.valueUsd != null ? formatUsdCompact(holding.valueUsd) : "—"}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted">
          <span
            className="block h-full rounded-full bg-fg"
            style={{ width: `${Math.max(1, (holding.weightPct / maxWeight) * 100)}%` }}
          />
        </span>
        <span className="w-14 shrink-0 text-right text-[14px] tabular-nums text-fg">{holding.weightPct.toFixed(2)}%</span>
      </span>
      <ChevronRight className={cn("size-4 text-fg-muted", !holding.href && "invisible")} aria-hidden />
    </>
  );
  const rowClass = cn(ROW_GRID, "rounded-[10px] px-3 py-2.5 transition-colors duration-75");
  return holding.href ? (
    <Link href={holding.href} prefetch={false} className={cn(rowClass, "hover:bg-table-row-hover")}>
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
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

  const holdings = profile.holdings;
  const maxWeight = holdings[0]?.weightPct || 1;
  /** EODHD caps large funds at their top 10 positions. */
  const topTenOnly = holdings.length === 10;

  return (
    <div className={cn("space-y-6 p-4 md:p-5", MOBILE_ELEVATED_CARD_CLASS)}>
      {profile.sectors.length ? <SectorExposure sectors={profile.sectors} /> : null}

      {holdings.length ? (
        <section aria-label="Holdings" className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={STOCK_OVERVIEW_SECTION_TITLE_CLASS}>{topTenOnly ? "Top 10 holdings" : `Holdings (${holdings.length})`}</h3>
            {profile.aumUsd != null ? (
              <span className="text-[13px] text-fg-muted">AUM {formatUsdCompact(profile.aumUsd)}</span>
            ) : null}
          </div>
          <div className={cn(ROW_GRID, "px-3 pb-1 text-[12px] font-medium uppercase tracking-wide text-fg-muted")}>
            <span>Holding</span>
            <span className="text-right">Value</span>
            <span>Weight</span>
            <span />
          </div>
          <div className="divide-y divide-table-row-stroke">
            {holdings.map((h) => (
              <HoldingRow key={h.code} holding={h} maxWeight={maxWeight} />
            ))}
          </div>
          <p className="pt-2 text-[12px] leading-4 text-fg-muted">
            Value is the holding&apos;s weight × fund AUM.
          </p>
        </section>
      ) : null}
    </div>
  );
}
