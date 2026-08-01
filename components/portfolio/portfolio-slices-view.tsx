"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { AllocationDonutChart } from "@/components/portfolio/allocation-donut-chart";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { PortfolioHoldingsEmptyState } from "@/components/portfolio/portfolio-holdings-empty-state";
import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import type { AllocationDonutRow } from "@/lib/portfolio/allocation-donut-rows";
import {
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalNetWorth,
} from "@/lib/portfolio/overview-metrics";
import { lifetimeEquityProfitUsd } from "@/lib/portfolio/realized-pnl-from-trades";
import { CompanyLogo } from "@/components/screener/company-logo";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Coins,
  Landmark,
  Laptop,
  PieChart,
  ShoppingBag,
  Smartphone,
  Wallet,
  type AppIcon,
} from "@/lib/icons";

/** Same palette as {@link PortfolioAllocationView} for visual consistency. */
const PALETTE = [
  "#2563EB",
  "#DC2626",
  "#9333EA",
  "#EA580C",
  "#16A34A",
  "#CA8A04",
  "#B91C1C",
  "#64748B",
  "#0891B2",
  "#DB2777",
  "#4F46E5",
  "#65A30D",
] as const;

const pct1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Matches the overview cards' percent formatter. */
const pct2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EM_DASH = "\u2014";

function formatSignedUsd2(n: number): string {
  const v = normalizeUsdForDisplay(n);
  const s = usd2.format(Math.abs(v));
  return v >= 0 ? `+${s}` : `-${s}`;
}

function formatSignedPct1(n: number): string {
  const s = pct1.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function formatSignedPct2(n: number): string {
  const s = pct2.format(Math.abs(n));
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

/** Chart edge length — sized so the donut plus label pills fit the 320px card column. */
const SLICES_CHART_SIZE_PX = 232;
const SLICES_BADGE_PAD_PX = 28;
/** Inner hole radius — larger than the avatar default so the center numbers fit. */
const SLICES_CENTER_HOLE_RADIUS_PX = 78;

function holdingIsCrypto(symbol: string): boolean {
  return isSupportedCryptoAssetSymbol(symbol);
}

type SectorBucket = {
  key: string;
  label: string;
  totalUsd: number;
  holdings: PortfolioHolding[];
  kind: "equity" | "crypto" | "cash";
};

function allocationDenominatorUsd(holdings: PortfolioHolding[], transactions: PortfolioTransaction[]): number {
  const equity = holdings.reduce((s, h) => s + h.currentValue, 0);
  const cashUsd = netCashUsd(transactions);
  return equity + Math.max(0, cashUsd);
}

function sectorIconFor(kind: SectorBucket["kind"], label: string): AppIcon {
  if (kind === "cash") return Wallet;
  if (kind === "crypto") return Coins;
  const L = label.toLowerCase();
  if (L.includes("technolog") || L === "tech") return Laptop;
  if (L.includes("communication") || L.includes("telecom")) return Smartphone;
  if (L.includes("financial") || L.includes("finance")) return Landmark;
  if (L.includes("consumer")) return ShoppingBag;
  return PieChart;
}

type SectorTableRow = {
  key: string;
  label: string;
  kind: SectorBucket["kind"];
  color: string;
  assetCount: number;
  valueUsd: number;
  investedUsd: number;
  gainUsd: number | null;
  gainPct: number | null;
  allocationPct: number;
};

function buildSectorTableRows(buckets: SectorBucket[], allocationDenomUsd: number): SectorTableRow[] {
  if (allocationDenomUsd <= 0) return [];
  return buckets.map((b, i) => {
    const color = PALETTE[i % PALETTE.length]!;
    const investedUsd =
      b.kind === "cash" ?
        b.totalUsd
      : b.holdings.reduce((s, h) => s + h.costBasis, 0);
    const gainUsd =
      b.kind === "cash" ? null : normalizeUsdForDisplay(b.totalUsd - investedUsd);
    const gainPct =
      b.kind === "cash" || investedUsd <= 0 || gainUsd === null ? null : (gainUsd / investedUsd) * 100;
    const assetCount = b.kind === "cash" ? 1 : b.holdings.length;
    const allocationPct = Math.min(100, Math.max(0, (b.totalUsd / allocationDenomUsd) * 100));
    return {
      key: b.key,
      label: b.label,
      kind: b.kind,
      color,
      assetCount,
      valueUsd: b.totalUsd,
      investedUsd,
      gainUsd,
      gainPct,
      allocationPct,
    };
  });
}

type SortKey = "name" | "value" | "gain" | "allocation";

/**
 * Full-width grid so headers and body share one column map. `w-full` fixes `<button>` rows
 * that otherwise shrink-wrap and misalign numeric columns vs headers.
 */
const SLICES_TABLE_GRID =
  "w-full min-w-0 grid grid-cols-[minmax(0,1.5fr)_minmax(112px,1fr)_minmax(112px,1fr)_minmax(88px,96px)] items-center gap-x-3 sm:gap-x-4";

const slicesStartCellClass = cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS);
const slicesEndCellClass = cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS);

function SlicesSortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "end",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "start" | "end";
}) {
  const active = activeKey === sortKey;
  return (
    <div className={align === "end" ? slicesEndCellClass : slicesStartCellClass}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded text-[14px] font-medium leading-5 text-fg-muted hover:text-fg",
          align === "end" && "w-full justify-end",
        )}
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ?
          dir === "desc" ?
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        : null}
      </button>
    </div>
  );
}

function compareSectorRows(a: SectorTableRow, b: SectorTableRow, key: SortKey, dir: number): number {
  const mul = dir;
  if (key === "name") return a.label.localeCompare(b.label) * mul;
  if (key === "value") return (a.valueUsd - b.valueUsd) * mul;
  if (key === "gain") {
    const ga = a.gainUsd ?? 0;
    const gb = b.gainUsd ?? 0;
    return (ga - gb) * mul;
  }
  return (a.allocationPct - b.allocationPct) * mul;
}

type HoldingTableRow = {
  id: string;
  name: string;
  symbol: string;
  valueUsd: number;
  investedUsd: number;
  gainUsd: number | null;
  gainPct: number | null;
  allocationPct: number;
  color: string;
};

function buildHoldingTableRows(bucket: SectorBucket, cashUsd: number): HoldingTableRow[] {
  if (bucket.kind === "cash") {
    if (cashUsd <= 0) return [];
    return [
      {
        id: "cash-usd",
        name: "US Dollar",
        symbol: "USD",
        valueUsd: cashUsd,
        investedUsd: cashUsd,
        gainUsd: null,
        gainPct: null,
        allocationPct: 100,
        color: PALETTE[0]!,
      },
    ];
  }

  const sliceTotal = bucket.holdings.reduce((s, h) => s + h.currentValue, 0);
  if (sliceTotal <= 0) return [];

  // Largest-first so palette indices match the donut (also sorted by weight).
  return [...bucket.holdings]
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((h, i) => {
      const investedUsd = h.costBasis;
      const gainUsd = normalizeUsdForDisplay(h.currentValue - investedUsd);
      const gainPct = investedUsd > 0 ? (gainUsd / investedUsd) * 100 : null;
      return {
        id: h.id,
        name: h.name.trim() || h.symbol,
        symbol: h.symbol,
        valueUsd: h.currentValue,
        investedUsd,
        gainUsd,
        gainPct,
        allocationPct: (h.currentValue / sliceTotal) * 100,
        color: PALETTE[i % PALETTE.length]!,
      };
    });
}

function compareHoldingRows(a: HoldingTableRow, b: HoldingTableRow, key: SortKey, dir: number): number {
  const mul = dir;
  if (key === "name") return a.name.localeCompare(b.name) * mul;
  if (key === "value") return (a.valueUsd - b.valueUsd) * mul;
  if (key === "gain") {
    const ga = a.gainUsd ?? 0;
    const gb = b.gainUsd ?? 0;
    return (ga - gb) * mul;
  }
  return (a.allocationPct - b.allocationPct) * mul;
}

function PortfolioSlicesViewInner({
  holdings,
  transactions,
  readOnly = false,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  readOnly?: boolean;
}) {
  const [stockSectorBySymbol, setStockSectorBySymbol] = useState<Record<string, string | null>>({});

  const stockSymbolsKey = useMemo(() => {
    const syms = [...new Set(holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean))]
      .filter((s) => !holdingIsCrypto(s))
      .sort();
    return syms.join(",");
  }, [holdings]);

  useEffect(() => {
    const syms = stockSymbolsKey ? stockSymbolsKey.split(",").filter(Boolean) : [];
    if (syms.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/portfolio/header-meta", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: syms }),
        });
        if (!res.ok) return;
        const j = (await res.json()) as {
          bySymbol?: Record<string, { sector?: string | null }>;
        };
        if (cancelled) return;
        const bySymbol = j.bySymbol ?? {};
        const next: Record<string, string | null> = {};
        for (const s of syms) {
          const sector = bySymbol[s]?.sector ?? null;
          next[s] = typeof sector === "string" && sector.trim() ? sector.trim() : null;
        }
        setStockSectorBySymbol(next);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stockSymbolsKey]);
  const sectorBySymbol = useMemo(() => new Map(Object.entries(stockSectorBySymbol)), [stockSectorBySymbol]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "allocation",
    dir: "desc",
  });
  const [drilledSliceKey, setDrilledSliceKey] = useState<string | null>(null);
  const [holdingSort, setHoldingSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "allocation",
    dir: "desc",
  });

  const sectorFetchPending = stockSymbolsKey.length > 0 && Object.keys(stockSectorBySymbol).length === 0;

  const buckets = useMemo((): SectorBucket[] => {
    const cashUsd = netCashUsd(transactions);
    const map = new Map<string, { label: string; holdings: PortfolioHolding[]; kind: SectorBucket["kind"] }>();

    for (const h of holdings) {
      const sym = h.symbol.trim().toUpperCase();
      let label: string;
      let kind: SectorBucket["kind"];
      if (holdingIsCrypto(h.symbol)) {
        label = "Crypto";
        kind = "crypto";
      } else {
        label = sectorBySymbol.get(sym) ?? "Unclassified";
        kind = "equity";
      }
      const key = `${kind}:${label}`;
      const cur = map.get(key) ?? { label, holdings: [] as PortfolioHolding[], kind };
      cur.holdings.push(h);
      map.set(key, cur);
    }

    if (cashUsd > 0) {
      map.set("cash:Cash", { label: "Cash", holdings: [], kind: "cash" });
    }

    const out: SectorBucket[] = [];
    for (const [, v] of map) {
      const totalUsd =
        v.kind === "cash" ?
          cashUsd
        : v.holdings.reduce((s, x) => s + x.currentValue, 0);
      if (totalUsd <= 0) continue;
      const key = `${v.kind}:${v.label}`;
      out.push({
        key,
        label: v.label,
        totalUsd,
        holdings: v.holdings,
        kind: v.kind,
      });
    }

    out.sort((a, b) => b.totalUsd - a.totalUsd);
    return out;
  }, [holdings, transactions, sectorBySymbol]);

  const allocationDenom = useMemo(
    () => allocationDenominatorUsd(holdings, transactions),
    [holdings, transactions],
  );

  const sectorRows = useMemo(
    () => buildSectorTableRows(buckets, allocationDenom),
    [buckets, allocationDenom],
  );

  const sectorDonutRows = useMemo(
    (): AllocationDonutRow[] =>
      sectorRows.map((r) => ({
        id: r.key,
        name: r.label,
        symbol: r.label,
        weightPct: r.allocationPct,
        color: r.color,
        logoUrl: null,
        badgeIcon: sectorIconFor(r.kind, r.label),
      })),
    [sectorRows],
  );

  const sortedRows = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...sectorRows].sort((a, b) => compareSectorRows(a, b, sort.key, dir));
  }, [sectorRows, sort]);

  const effectiveDrillKey = useMemo(() => {
    if (!drilledSliceKey) return null;
    return buckets.some((b) => b.key === drilledSliceKey) ? drilledSliceKey : null;
  }, [buckets, drilledSliceKey]);

  const drilledBucket = useMemo(
    () => (effectiveDrillKey ? buckets.find((b) => b.key === effectiveDrillKey) ?? null : null),
    [buckets, effectiveDrillKey],
  );

  // Same figures as the overview cards up top: net worth + lifetime (realized + unrealized) profit.
  const cashUsd = netCashUsd(transactions);
  const totalValue = totalNetWorth(holdings, cashUsd);
  const totalGainUsd = lifetimeEquityProfitUsd(holdings, transactions);
  const totalGainPct = lifetimeEquityProfitPct(holdings, transactions);

  const onSort = useCallback((key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }, []);

  const onHoldingSort = useCallback((key: SortKey) => {
    setHoldingSort((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }, []);

  const openSliceDrillDown = useCallback((sliceKey: string) => {
    setDrilledSliceKey(sliceKey);
    setHoldingSort({ key: "allocation", dir: "desc" });
  }, []);

  const holdingRows = useMemo(() => {
    if (!drilledBucket) return [];
    return buildHoldingTableRows(drilledBucket, netCashUsd(transactions));
  }, [drilledBucket, transactions]);

  const sortedHoldingRows = useMemo(() => {
    const dir = holdingSort.dir === "desc" ? -1 : 1;
    return [...holdingRows].sort((a, b) => compareHoldingRows(a, b, holdingSort.key, dir));
  }, [holdingRows, holdingSort]);

  /** When drilled into a slice, the donut shows that folder’s assets (same colors as the list). */
  const drillDonutRows = useMemo(
    (): AllocationDonutRow[] =>
      holdingRows.map((h) => ({
        id: h.id,
        name: h.name,
        symbol: h.symbol,
        weightPct: h.allocationPct,
        color: h.color,
        logoUrl: displayLogoUrlForPortfolioSymbol(h.symbol),
      })),
    [holdingRows],
  );

  const donutRows = drilledBucket ? drillDonutRows : sectorDonutRows;

  const chartCenterValue = drilledBucket ? drilledBucket.totalUsd : totalValue;
  const chartCenterGainUsd: number | null = drilledBucket
    ? drilledBucket.kind === "cash"
      ? null
      : holdingRows.reduce((s, h) => s + (h.gainUsd ?? 0), 0)
    : totalGainUsd;
  const chartCenterGainPct: number | null = drilledBucket
    ? (() => {
        if (chartCenterGainUsd === null) return null;
        const invested = holdingRows.reduce((s, h) => s + h.investedUsd, 0);
        if (invested <= 0) return null;
        return (chartCenterGainUsd / invested) * 100;
      })()
    : totalGainPct;

  const hasAnyPositions = holdings.length > 0 || netCashUsd(transactions) > 0;

  if (!hasAnyPositions) {
    return (
      <div className="rounded-[12px] border border-stroke bg-surface px-6 py-12 text-center text-sm text-fg-muted shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
        Add positions to see them grouped by sector.
      </div>
    );
  }

  if (sectorFetchPending) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="flex w-full min-h-[280px] shrink-0 animate-pulse flex-col items-center justify-center rounded-[12px] border border-stroke bg-surface px-4 py-8 lg:max-w-[320px]">
          <div className="h-[220px] w-[220px] rounded-full bg-stroke" />
        </div>
        <div className="min-h-[220px] flex-1 animate-pulse space-y-3 rounded-[12px] border border-stroke bg-surface px-4 py-4">
          <div className="h-4 w-1/3 rounded bg-stroke" />
          <div className="h-10 w-full rounded bg-stroke" />
          <div className="h-10 w-full rounded bg-stroke" />
          <div className="h-10 w-full rounded bg-stroke" />
        </div>
      </div>
    );
  }

  if (sectorRows.length === 0) {
    return <PortfolioHoldingsEmptyState readOnly={readOnly} />;
  }

  return (
    <div className="relative">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
        <div
          className={cn(
            MOBILE_PANEL_CARD_CLASS,
            "flex w-full shrink-0 flex-col items-center justify-center px-4 py-5 sm:py-8 lg:max-w-[320px]",
          )}
        >
          <div className="flex min-h-[240px] w-full flex-col items-center justify-center sm:min-h-[280px]">
            <AllocationDonutChart
              key={drilledBucket ? `drill:${drilledBucket.key}` : "sectors"}
              rows={donutRows}
              chartSizePx={SLICES_CHART_SIZE_PX}
              badgeOverflowPadPx={SLICES_BADGE_PAD_PX}
              centerHoleRadiusPx={SLICES_CENTER_HOLE_RADIUS_PX}
              className="mx-auto shrink-0"
              center={
                <div className="flex flex-col items-center gap-0.5 px-4 text-center">
                  <div className="text-[18px] font-semibold leading-tight tabular-nums text-fg">
                    {usd2.format(normalizeUsdForDisplay(chartCenterValue))}
                  </div>
                  <div
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      chartCenterGainUsd === null
                        ? "text-fg-muted"
                        : chartCenterGainUsd >= 0
                          ? "text-up"
                          : "text-down",
                    )}
                  >
                    {chartCenterGainUsd === null ? EM_DASH : formatSignedUsd2(chartCenterGainUsd)}
                  </div>
                  {chartCenterGainPct !== null ? (
                    <div
                      className={cn(
                        "text-[12px] font-medium tabular-nums",
                        chartCenterGainPct >= 0 ? "text-up" : "text-down",
                      )}
                    >
                      {formatSignedPct2(chartCenterGainPct)}
                    </div>
                  ) : (
                    <div className="text-[12px] tabular-nums text-fg-muted">{EM_DASH}</div>
                  )}
                </div>
              }
            />
          </div>
        </div>

        <ScreenerTableScroll className="min-w-0 flex-1" minWidthClassName="min-w-[640px]">
          {effectiveDrillKey ? (
            <>
              <div
                className={cn(
                  SCREENER_TABLE_HEADER_STICKY_CLASS,
                  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                  "md:border-b-0",
                )}
              >
                <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      "flex items-center gap-2 py-3",
                      TABLE_START_ALIGNED_PAD_CLASS,
                      TABLE_END_ALIGNED_PAD_CLASS,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setDrilledSliceKey(null)}
                      aria-label="Back to all slices"
                      className={cn(topbarSquircleIconClass, "h-8 w-8")}
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                    {drilledBucket ? (
                      <div className="min-w-0 truncate text-left font-['Inter'] text-[16px] font-semibold leading-6 tracking-normal text-fg">
                        {drilledBucket.label}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      SLICES_TABLE_GRID,
                      "min-h-[44px] py-0 text-[14px] font-medium leading-5 text-fg-muted",
                    )}
                  >
                    <SlicesSortHeader
                      label="Name"
                      sortKey="name"
                      activeKey={holdingSort.key}
                      dir={holdingSort.dir}
                      onSort={onHoldingSort}
                      align="start"
                    />
                    <SlicesSortHeader
                      label="Value / invested"
                      sortKey="value"
                      activeKey={holdingSort.key}
                      dir={holdingSort.dir}
                      onSort={onHoldingSort}
                    />
                    <SlicesSortHeader
                      label="Gain"
                      sortKey="gain"
                      activeKey={holdingSort.key}
                      dir={holdingSort.dir}
                      onSort={onHoldingSort}
                    />
                    <SlicesSortHeader
                      label="Allocation"
                      sortKey="allocation"
                      activeKey={holdingSort.key}
                      dir={holdingSort.dir}
                      onSort={onHoldingSort}
                    />
                  </div>
                </div>
                <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
              </div>

              {sortedHoldingRows.length === 0 ? (
                <div className={cn("px-6 py-8 text-center text-[14px] leading-6 text-fg-muted")}>
                  No positions in this slice.
                </div>
              ) : (
                sortedHoldingRows.map((hRow, rowIdx) => (
                  <div key={hRow.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                    <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                      <div
                        className={cn(
                          SLICES_TABLE_GRID,
                          "min-h-[56px] sm:min-h-[60px]",
                          SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                        )}
                      >
                        <div className={cn("min-w-0", TABLE_START_ALIGNED_PAD_CLASS)}>
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-8 w-1 shrink-0 self-center rounded-full"
                              style={{ backgroundColor: hRow.color }}
                              aria-hidden
                            />
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[10px] bg-surface">
                              <CompanyLogo
                                name={hRow.name}
                                logoUrl={displayLogoUrlForPortfolioSymbol(hRow.symbol)}
                                symbol={hRow.symbol}
                                size="md"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-semibold leading-5 text-fg">
                                {hRow.name}
                              </div>
                              <div className="text-[12px] font-normal leading-4 text-fg-muted">
                                {hRow.symbol}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={slicesEndCellClass}>
                          <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-fg">
                            {usd2.format(hRow.valueUsd)}
                          </div>
                          <div className="text-[12px] font-normal leading-4 text-fg-muted">
                            {usd2.format(hRow.investedUsd)} invested
                          </div>
                        </div>
                        <div className={slicesEndCellClass}>
                          {hRow.gainUsd === null ? (
                            <div className="w-full text-[14px] font-medium leading-5 text-fg-muted">
                              {EM_DASH}
                            </div>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  "font-['Inter'] text-[14px] font-medium leading-5 tabular-nums",
                                  hRow.gainUsd >= 0 ? "text-up" : "text-down",
                                )}
                              >
                                {formatSignedUsd2(hRow.gainUsd)}
                              </div>
                              {hRow.gainPct !== null ? (
                                <div
                                  className={cn(
                                    "text-[14px] font-medium leading-5 tabular-nums",
                                    hRow.gainUsd >= 0 ? "text-up" : "text-down",
                                  )}
                                >
                                  {formatSignedPct1(hRow.gainPct)}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                        <div
                          className={cn(
                            "font-['Inter'] text-[14px] font-normal leading-5 tracking-normal tabular-nums text-fg",
                            slicesEndCellClass,
                          )}
                        >
                          {pct1.format(hRow.allocationPct)}%
                        </div>
                      </div>
                    </div>
                    {rowIdx < sortedHoldingRows.length - 1 ? (
                      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                    ) : null}
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div
                className={cn(
                  SCREENER_TABLE_HEADER_STICKY_CLASS,
                  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
                  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                  "md:border-b-0",
                )}
              >
                <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      SLICES_TABLE_GRID,
                      "min-h-[44px] py-0 text-[14px] font-medium leading-5 text-fg-muted",
                    )}
                  >
                    <SlicesSortHeader
                      label="Name"
                      sortKey="name"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSort}
                      align="start"
                    />
                    <SlicesSortHeader
                      label="Value / invested"
                      sortKey="value"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSort}
                    />
                    <SlicesSortHeader
                      label="Gain"
                      sortKey="gain"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSort}
                    />
                    <SlicesSortHeader
                      label="Allocation"
                      sortKey="allocation"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSort}
                    />
                  </div>
                </div>
                <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
              </div>

              {sortedRows.map((row, rowIdx) => {
                const Icon = sectorIconFor(row.kind, row.label);
                return (
                  <div key={row.key} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                    <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                      <button
                        type="button"
                        className={cn(
                          SLICES_TABLE_GRID,
                          "min-h-[56px] text-left sm:min-h-[60px]",
                          SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                        )}
                        aria-label={`View holdings in ${row.label}`}
                        onClick={() => openSliceDrillDown(row.key)}
                      >
                        <div className={cn("min-w-0", TABLE_START_ALIGNED_PAD_CLASS)}>
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-8 w-1 shrink-0 self-center rounded-full"
                              style={{ backgroundColor: row.color }}
                              aria-hidden
                            />
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                              style={{ backgroundColor: row.color }}
                              aria-hidden
                            >
                              <Icon className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-semibold leading-5 text-fg">
                                {row.label}
                              </div>
                              <div className="text-[12px] font-normal leading-4 text-fg-muted">
                                {row.assetCount} {row.assetCount === 1 ? "asset" : "assets"}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={slicesEndCellClass}>
                          <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-fg">
                            {usd2.format(row.valueUsd)}
                          </div>
                          <div className="text-[12px] font-normal leading-4 text-fg-muted">
                            {usd2.format(row.investedUsd)} invested
                          </div>
                        </div>
                        <div className={slicesEndCellClass}>
                          {row.gainUsd === null ? (
                            <div className="w-full text-[14px] font-medium leading-5 text-fg-muted">
                              {EM_DASH}
                            </div>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  "font-['Inter'] text-[14px] font-medium leading-5 tabular-nums",
                                  row.gainUsd >= 0 ? "text-up" : "text-down",
                                )}
                              >
                                {formatSignedUsd2(row.gainUsd)}
                              </div>
                              {row.gainPct !== null ? (
                                <div
                                  className={cn(
                                    "text-[14px] font-medium leading-5 tabular-nums",
                                    row.gainUsd >= 0 ? "text-up" : "text-down",
                                  )}
                                >
                                  {formatSignedPct1(row.gainPct)}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                        <div
                          className={cn(
                            "font-['Inter'] text-[14px] font-normal leading-5 tracking-normal tabular-nums text-fg",
                            slicesEndCellClass,
                          )}
                        >
                          {pct1.format(row.allocationPct)}%
                        </div>
                      </button>
                    </div>
                    {rowIdx < sortedRows.length - 1 ? (
                      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </ScreenerTableScroll>
      </div>
    </div>
  );
}

export const PortfolioSlicesView = memo(PortfolioSlicesViewInner);
