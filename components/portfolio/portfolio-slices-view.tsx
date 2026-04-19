"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import {
  netCashUsd,
  normalizeUsdForDisplay,
  totalNetWorth,
  unrealizedProfitPct,
  unrealizedProfitUsd,
} from "@/lib/portfolio/overview-metrics";
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
  type LucideIcon,
} from "lucide-react";

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

const VB = 100;
const CX = 50;
const CY = 50;
const R_OUT = 48;
const R_IN = 42.5;

const pct1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
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

type SliceRow = { id: string; name: string; weightPct: number; color: string };

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  const sweep = a1 - a0;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

function FullRing({ color }: { color: string }) {
  const mid = (R_OUT + R_IN) / 2;
  const sw = R_OUT - R_IN;
  return <circle cx={CX} cy={CY} r={mid} fill="none" stroke={color} strokeWidth={sw} />;
}

type TooltipState = { name: string; pctLabel: string; x: number; y: number } | null;

function SliceDonut({
  rows,
  onTooltipChange,
}: {
  rows: SliceRow[];
  onTooltipChange: (t: TooltipState) => void;
}) {
  const [dimIndex, setDimIndex] = useState<number | null>(null);

  const slices = useMemo(() => {
    const prefix: number[] = [];
    let cum = 0;
    for (const row of rows) {
      prefix.push(cum);
      cum += row.weightPct;
    }
    return rows.map((row, i) => {
      const start = prefix[i] ?? 0;
      const end = start + row.weightPct;
      const a0 = -Math.PI / 2 + (start / 100) * 2 * Math.PI;
      const a1 = -Math.PI / 2 + (end / 100) * 2 * Math.PI;
      return { row, i, a0, a1 };
    });
  }, [rows]);

  const moveTip = useCallback(
    (e: MouseEvent, row: SliceRow) => {
      onTooltipChange({
        name: row.name,
        pctLabel: `${pct1.format(row.weightPct)}%`,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [onTooltipChange],
  );

  const leave = useCallback(() => {
    setDimIndex(null);
    onTooltipChange(null);
  }, [onTooltipChange]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[12px] text-[#71717A]">—</div>
    );
  }

  if (rows.length === 1) {
    const row = rows[0]!;
    return (
      <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={leave}>
        <g
          onMouseEnter={(e) => {
            setDimIndex(0);
            moveTip(e, row);
          }}
          onMouseMove={(e) => moveTip(e, row)}
          onMouseLeave={leave}
          className="cursor-pointer"
        >
          <FullRing color={row.color} />
          <title>
            {row.name} {pct1.format(row.weightPct)}%
          </title>
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={leave}>
      {slices.map(({ row, i, a0, a1 }) => (
        <path
          key={row.id}
          d={donutSlicePath(CX, CY, R_OUT, R_IN, a0, a1)}
          fill={row.color}
          stroke="none"
          className="cursor-pointer transition-[opacity] duration-150"
          style={{ opacity: dimIndex !== null && dimIndex !== i ? 0.45 : 1 }}
          onMouseEnter={(e) => {
            setDimIndex(i);
            moveTip(e, row);
          }}
          onMouseMove={(e) => moveTip(e, row)}
          onMouseLeave={leave}
        >
          <title>
            {row.name} {pct1.format(row.weightPct)}%
          </title>
        </path>
      ))}
    </svg>
  );
}

async function fetchStockSector(symbol: string): Promise<string | null> {
  const enc = encodeURIComponent(symbol.trim());
  try {
    const res = await fetch(`/api/stocks/${enc}/header-meta`, { cache: "force-cache" });
    if (!res.ok) return null;
    const j = (await res.json()) as { sector?: string | null };
    if (typeof j.sector === "string") {
      const s = j.sector.trim();
      return s.length > 0 ? s : null;
    }
    return null;
  } catch {
    return null;
  }
}

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

function sectorIconFor(kind: SectorBucket["kind"], label: string): LucideIcon {
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
      },
    ];
  }

  const sliceTotal = bucket.holdings.reduce((s, h) => s + h.currentValue, 0);
  if (sliceTotal <= 0) return [];

  return bucket.holdings.map((h) => {
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
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}) {
  const [sectorBySymbol, setSectorBySymbol] = useState<Map<string, string>>(() => new Map());
  const [resolvedStockKey, setResolvedStockKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "allocation",
    dir: "desc",
  });
  const [drilledSliceKey, setDrilledSliceKey] = useState<string | null>(null);
  const [holdingSort, setHoldingSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "allocation",
    dir: "desc",
  });

  const stockSymbols = useMemo(() => {
    const u = new Set<string>();
    for (const h of holdings) {
      if (holdingIsCrypto(h.symbol)) continue;
      u.add(h.symbol.trim().toUpperCase());
    }
    return [...u];
  }, [holdings]);

  const stockKey = useMemo(() => [...stockSymbols].sort().join(","), [stockSymbols]);
  const stockKeyRef = useRef(stockKey);

  useEffect(() => {
    stockKeyRef.current = stockKey;
  }, [stockKey]);

  const sectorFetchPending =
    stockSymbols.length > 0 && resolvedStockKey !== stockKey;

  useEffect(() => {
    if (stockSymbols.length === 0) return;
    if (stockKey === resolvedStockKey) return;
    const fetchKey = stockKey;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        stockSymbols.map(async (sym) => {
          const sec = await fetchStockSector(sym);
          return [sym, sec ?? "Unclassified"] as const;
        }),
      );
      if (cancelled) return;
      if (stockKeyRef.current !== fetchKey) return;
      setSectorBySymbol(new Map(entries));
      setResolvedStockKey(fetchKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [stockKey, resolvedStockKey, stockSymbols]);

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

  const donutRows = useMemo(
    (): SliceRow[] =>
      sectorRows.map((r) => ({
        id: r.key,
        name: r.label,
        weightPct: r.allocationPct,
        color: r.color,
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

  const drilledSliceColor = useMemo(() => {
    if (!effectiveDrillKey) return PALETTE[0]!;
    const i = sectorRows.findIndex((r) => r.key === effectiveDrillKey);
    return i >= 0 ? sectorRows[i]!.color : PALETTE[0]!;
  }, [effectiveDrillKey, sectorRows]);

  const cashUsd = netCashUsd(transactions);
  const totalValue = totalNetWorth(holdings, cashUsd);
  const totalGainUsd = unrealizedProfitUsd(holdings);
  const totalGainPct = unrealizedProfitPct(holdings);

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

  const hasAnyPositions = holdings.length > 0 || netCashUsd(transactions) > 0;

  if (!hasAnyPositions) {
    return (
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-12 text-center text-sm text-[#71717A] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        Add positions to see them grouped by sector.
      </div>
    );
  }

  if (sectorFetchPending) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="flex w-full min-h-[280px] shrink-0 animate-pulse flex-col items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-8 lg:max-w-[320px]">
          <div className="h-[220px] w-[220px] rounded-full bg-[#E4E4E7]" />
        </div>
        <div className="min-h-[220px] flex-1 animate-pulse space-y-3 rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4">
          <div className="h-4 w-1/3 rounded bg-[#E4E4E7]" />
          <div className="h-10 w-full rounded bg-[#E4E4E7]" />
          <div className="h-10 w-full rounded bg-[#E4E4E7]" />
          <div className="h-10 w-full rounded bg-[#E4E4E7]" />
        </div>
      </div>
    );
  }

  if (sectorRows.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-12 text-center text-sm text-[#71717A] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        No sector breakdown to display.
      </div>
    );
  }

  return (
    <div className="relative">
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-[200] max-w-[min(calc(100vw-1rem),280px)] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-left shadow-[0px_4px_12px_0px_rgba(10,10,10,0.08)]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="text-[13px] font-semibold leading-5 text-[#09090B]">{tooltip.name}</div>
          <div className="text-[12px] tabular-nums leading-4 text-[#71717A]">{tooltip.pctLabel}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
        <div className="flex w-full shrink-0 flex-col items-center justify-center rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-8 lg:max-w-[320px]">
          <div className="flex min-h-[280px] w-full flex-col items-center justify-center">
            <div className="relative mx-auto h-[220px] w-[220px] shrink-0">
              <div className="absolute inset-0" aria-hidden>
                <SliceDonut rows={donutRows} onTooltipChange={setTooltip} />
              </div>
              <div className="pointer-events-none relative z-10 flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center">
                <div className="text-[22px] font-semibold leading-tight tabular-nums text-[#09090B]">
                  {usd2.format(totalValue)}
                </div>
                <div
                  className={cn(
                    "text-[14px] font-semibold tabular-nums",
                    totalGainUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                  )}
                >
                  {formatSignedUsd2(totalGainUsd)}
                </div>
                {totalGainPct !== null ? (
                  <div
                    className={cn(
                      "text-[13px] font-medium tabular-nums",
                      totalGainUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                    )}
                  >
                    {formatSignedPct1(totalGainPct)}
                  </div>
                ) : (
                  <div className="text-[13px] tabular-nums text-[#71717A]">{EM_DASH}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden rounded-[12px] border border-[#E4E4E7] bg-white">
          <div className="-mx-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:-mx-0">
            <div className="w-full min-w-[640px]">
              <div className="divide-y divide-[#E4E4E7] bg-white">
                {effectiveDrillKey ?
                  <>
                    <div className="bg-white px-2 py-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => setDrilledSliceKey(null)}
                        className="inline-flex items-center gap-1 rounded text-[14px] font-medium leading-5 text-[#09090B] hover:text-[#71717A]"
                      >
                        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                        Back
                      </button>
                      {drilledBucket ?
                        <div className="mt-2 text-left font-['Inter'] text-[16px] font-semibold leading-6 tracking-normal text-[#09090B]">
                          {drilledBucket.label}
                        </div>
                      : null}
                    </div>
                    <div
                      className={`${SLICES_TABLE_GRID} min-h-[44px] bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
                    >
                      <div className="text-left">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onHoldingSort("name")}
                        >
                          Name
                          {holdingSort.key === "name" ?
                            holdingSort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                      <div className="min-w-0 w-full text-right">
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-end gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onHoldingSort("value")}
                        >
                          Value / invested
                          {holdingSort.key === "value" ?
                            holdingSort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                      <div className="min-w-0 w-full text-right">
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-end gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onHoldingSort("gain")}
                        >
                          Gain
                          {holdingSort.key === "gain" ?
                            holdingSort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                      <div className="min-w-0 w-full text-right">
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-end gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onHoldingSort("allocation")}
                        >
                          Allocation
                          {holdingSort.key === "allocation" ?
                            holdingSort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                    </div>
                    {sortedHoldingRows.length === 0 ?
                      <div className="bg-white px-4 py-8 text-center text-[14px] leading-6 text-[#71717A]">
                        No positions in this slice.
                      </div>
                    : sortedHoldingRows.map((hRow) => (
                        <div
                          key={hRow.id}
                          className={`${SLICES_TABLE_GRID} min-h-[56px] bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:min-h-[60px] sm:px-4`}
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="h-8 w-1 shrink-0 self-center rounded-full"
                                style={{ backgroundColor: drilledSliceColor }}
                                aria-hidden
                              />
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[10px] bg-white">
                                <CompanyLogo
                                  name={hRow.name}
                                  logoUrl={displayLogoUrlForPortfolioSymbol(hRow.symbol)}
                                  symbol={hRow.symbol}
                                  size="md"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">
                                  {hRow.name}
                                </div>
                                <div className="text-[12px] font-normal leading-4 text-[#71717A]">{hRow.symbol}</div>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 w-full text-right">
                            <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
                              {usd2.format(hRow.valueUsd)}
                            </div>
                            <div className="text-[12px] font-normal leading-4 text-[#71717A]">
                              {usd2.format(hRow.investedUsd)} invested
                            </div>
                          </div>
                          <div className="min-w-0 w-full text-right">
                            {hRow.gainUsd === null ?
                              <div className="w-full text-[14px] font-medium leading-5 text-[#71717A]">{EM_DASH}</div>
                            : <>
                                <div
                                  className={cn(
                                    "font-['Inter'] text-[14px] font-medium leading-5 tabular-nums",
                                    hRow.gainUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                                  )}
                                >
                                  {formatSignedUsd2(hRow.gainUsd)}
                                </div>
                                {hRow.gainPct !== null ?
                                  <div
                                    className={cn(
                                      "text-[14px] font-medium leading-5 tabular-nums",
                                      hRow.gainUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                                    )}
                                  >
                                    {formatSignedPct1(hRow.gainPct)}
                                  </div>
                                : null}
                              </>
                            }
                          </div>
                          <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tracking-normal tabular-nums text-[#09090B]">
                            {pct1.format(hRow.allocationPct)}%
                          </div>
                        </div>
                      ))
                    }
                  </>
                : <>
                    <div
                      className={`${SLICES_TABLE_GRID} min-h-[44px] bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
                    >
                      <div className="text-left">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onSort("name")}
                        >
                          Name
                          {sort.key === "name" ?
                            sort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                      <div className="min-w-0 w-full text-right">
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-end gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onSort("value")}
                        >
                          Value / invested
                          {sort.key === "value" ?
                            sort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                      <div className="min-w-0 w-full text-right">
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-end gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onSort("gain")}
                        >
                          Gain
                          {sort.key === "gain" ?
                            sort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                      <div className="min-w-0 w-full text-right">
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-end gap-1 rounded hover:text-[#09090B]"
                          onClick={() => onSort("allocation")}
                        >
                          Allocation
                          {sort.key === "allocation" ?
                            sort.dir === "desc" ?
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            : <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          : null}
                        </button>
                      </div>
                    </div>

                    {sortedRows.map((row) => {
                      const Icon = sectorIconFor(row.kind, row.label);
                      return (
                        <button
                          key={row.key}
                          type="button"
                          className={`${SLICES_TABLE_GRID} min-h-[56px] bg-white px-2 text-left transition-colors duration-75 hover:bg-neutral-50 sm:min-h-[60px] sm:px-4`}
                          aria-label={`View holdings in ${row.label}`}
                          onClick={() => openSliceDrillDown(row.key)}
                        >
                          <div className="min-w-0">
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
                                <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">
                                  {row.label}
                                </div>
                                <div className="text-[12px] font-normal leading-4 text-[#71717A]">
                                  {row.assetCount} {row.assetCount === 1 ? "asset" : "assets"}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 w-full text-right">
                            <div className="font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-[#09090B]">
                              {usd2.format(row.valueUsd)}
                            </div>
                            <div className="text-[12px] font-normal leading-4 text-[#71717A]">
                              {usd2.format(row.investedUsd)} invested
                            </div>
                          </div>
                          <div className="min-w-0 w-full text-right">
                            {row.gainUsd === null ?
                              <div className="w-full text-[14px] font-medium leading-5 text-[#71717A]">{EM_DASH}</div>
                            : <>
                                <div
                                  className={cn(
                                    "font-['Inter'] text-[14px] font-medium leading-5 tabular-nums",
                                    row.gainUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                                  )}
                                >
                                  {formatSignedUsd2(row.gainUsd)}
                                </div>
                                {row.gainPct !== null ?
                                  <div
                                    className={cn(
                                      "text-[14px] font-medium leading-5 tabular-nums",
                                      row.gainUsd >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                                    )}
                                  >
                                    {formatSignedPct1(row.gainPct)}
                                  </div>
                                : null}
                              </>
                            }
                          </div>
                          <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tracking-normal tabular-nums text-[#09090B]">
                            {pct1.format(row.allocationPct)}%
                          </div>
                        </button>
                      );
                    })}
                  </>
                }
              </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export const PortfolioSlicesView = memo(PortfolioSlicesViewInner);
