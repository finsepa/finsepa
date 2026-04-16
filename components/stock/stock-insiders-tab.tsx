"use client";

import { format, parseISO, subMonths } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { HoldingsTradeMarker, HoldingsTradeTooltipItem } from "@/components/chart/PriceChart";
import { PriceChart } from "@/components/chart/PriceChart";
import { SegmentedControl } from "@/components/design-system";
import { SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import type { InsiderTransactionKind, InsiderTransactionRow } from "@/lib/market/insider-transactions-types";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

/** Column layout aligned with `screener-table`: `gap-x-2`, `px-4`, fixed date + flexible rights. */
const INSIDER_GRID =
  "grid min-w-[900px] grid-cols-[148px_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-x-2 px-4";

const INSIDERS_CHART_RANGES = ["1Y", "5Y"] as const satisfies readonly StockChartRange[];

function formatDisplayDate(ymd: string): string {
  try {
    return format(parseISO(ymd), "MMM d, yyyy");
  } catch {
    return ymd;
  }
}

function formatCompactUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${sign}$${Math.round(v / 1_000)}K`;
  return `${sign}$${v.toFixed(2)}`;
}

function formatCardUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0.00";
  return formatCompactUsd(n);
}

type PeriodAgg = { sellCount: number; buyCount: number; sellValue: number; buyValue: number };

function aggregateInsiderWindow(
  rows: readonly InsiderTransactionRow[],
  anchorYmd: string,
  lookbackMonths: number,
): PeriodAgg {
  let sellCount = 0;
  let buyCount = 0;
  let sellValue = 0;
  let buyValue = 0;
  const anchor = parseISO(`${anchorYmd}T12:00:00`);
  const fromStr = format(subMonths(anchor, lookbackMonths), "yyyy-MM-dd");
  const toStr = anchorYmd;

  for (const r of rows) {
    if (r.transactionDate < fromStr || r.transactionDate > toStr) continue;
    const v = r.value != null && Number.isFinite(r.value) ? Math.abs(r.value) : 0;
    if (r.kind === "purchase") {
      buyCount += 1;
      buyValue += v;
    } else {
      sellCount += 1;
      sellValue += v;
    }
  }
  return { sellCount, buyCount, sellValue, buyValue };
}

function InsiderPeriodCard({
  title,
  agg,
}: {
  title: string;
  agg: PeriodAgg;
}) {
  const total = agg.sellCount + agg.buyCount;
  const sellPct = total > 0 ? (agg.sellCount / total) * 100 : 0;
  const buyPct = total > 0 ? (agg.buyCount / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
      <p className="mb-3 text-[13px] font-semibold leading-5 text-[#71717A]">{title}</p>
      <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-[#F4F4F5]">
        {total === 0 ? (
          <div className="h-full w-full bg-[#E4E4E7]" />
        ) : (
          <>
            {sellPct > 0 ? (
              <div className="h-full shrink-0 bg-[#DC2626]" style={{ width: `${sellPct}%` }} title="Sells" />
            ) : null}
            {buyPct > 0 ? (
              <div className="h-full shrink-0 bg-[#16A34A]" style={{ width: `${buyPct}%` }} title="Buys" />
            ) : null}
          </>
        )}
      </div>
      <div className="mb-2 flex items-center justify-between text-[14px] font-medium leading-5 text-[#09090B]">
        <span>
          {agg.sellCount} {agg.sellCount === 1 ? "Sell" : "Sells"}
        </span>
        <span>
          {agg.buyCount} {agg.buyCount === 1 ? "Buy" : "Buys"}
        </span>
      </div>
      <div className="flex items-center justify-between text-[14px] font-normal leading-5 text-[#71717A]">
        <span className="tabular-nums">{formatCardUsd(agg.sellValue)}</span>
        <span className="tabular-nums">{formatCardUsd(agg.buyValue)}</span>
      </div>
    </div>
  );
}

function InsiderSummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <SkeletonBox className="mb-3 h-4 w-28 rounded" />
          <SkeletonBox className="mb-4 h-2 w-full rounded-full" />
          <div className="mb-2 flex justify-between">
            <SkeletonBox className="h-4 w-16 rounded" />
            <SkeletonBox className="h-4 w-14 rounded" />
          </div>
          <div className="flex justify-between">
            <SkeletonBox className="h-4 w-12 rounded" />
            <SkeletonBox className="h-4 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function sharesFmt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function insiderKindLabel(kind: InsiderTransactionKind): string {
  if (kind === "purchase") return "Purchase";
  if (kind === "planned_sale") return "Planned sale";
  if (kind === "sale") return "Sale";
  return "Other";
}

function insiderMarkerSide(kind: InsiderTransactionKind): "buy" | "sell" {
  return kind === "purchase" ? "buy" : "sell";
}

function TransactionBadge({ kind }: { kind: InsiderTransactionKind }) {
  if (kind === "purchase") {
    return (
      <span className="inline-flex rounded-lg bg-[#F0FDF4] px-2 py-0.5 text-[12px] font-normal leading-4 text-[#16A34A]">
        Purchase
      </span>
    );
  }
  if (kind === "planned_sale") {
    return (
      <span className="inline-flex rounded-lg bg-[#FFF1F2] px-2 py-0.5 text-[12px] font-normal leading-4 text-[#DC2626]">
        Planned sale
      </span>
    );
  }
  if (kind === "sale") {
    return (
      <span className="inline-flex rounded-lg bg-[#FEF2F2] px-2 py-0.5 text-[12px] font-normal leading-4 text-[#DC2626]">
        Sale
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-lg bg-[#F4F4F5] px-2 py-0.5 text-[12px] font-normal leading-4 text-[#52525B]">
      Other
    </span>
  );
}

function InsidersTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div className={`${INSIDER_GRID} min-h-[44px] items-center bg-white py-0`}>
        <div className="flex items-center justify-start gap-1">
          <SkeletonBox className="h-3.5 w-10 rounded" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-end">
            <SkeletonBox className="h-3 w-16 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className={`${INSIDER_GRID} h-[60px] max-h-[60px] items-center bg-white transition-colors duration-75 hover:bg-neutral-50`}
        >
          <div className="flex justify-start">
            <TextSkeleton wClass="w-24" />
          </div>
          <div className="flex min-w-0 justify-end">
            <TextSkeleton wClass="w-[70%] max-w-[140px]" />
          </div>
          <div className="flex min-w-0 justify-end">
            <TextSkeleton wClass="w-[80%] max-w-[120px]" />
          </div>
          <div className="flex justify-end">
            <SkeletonBox className="h-5 w-16 rounded-lg" />
          </div>
          <div className="flex justify-end">
            <TextSkeleton wClass="w-20" />
          </div>
          <div className="flex justify-end">
            <TextSkeleton wClass="w-14" />
          </div>
          <div className="flex justify-end">
            <TextSkeleton wClass="w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsiderRow({ row }: { row: InsiderTransactionRow }) {
  const isBuy = row.kind === "purchase";
  const isSellSide = row.kind === "sale" || row.kind === "planned_sale";
  const shareColor =
    row.shares == null ? "text-[#71717A]" : isBuy ? "text-[#16A34A]" : isSellSide ? "text-[#DC2626]" : "text-[#09090B]";
  const pctColor = shareColor;

  const sharesText =
    row.shares != null && Number.isFinite(row.shares)
      ? `${row.shares < 0 ? "" : "+"}${sharesFmt(row.shares)}`
      : "-";
  const pctText =
    row.positionChangePct != null && Number.isFinite(row.positionChangePct)
      ? `${row.positionChangePct > 0 ? "+" : ""}${row.positionChangePct.toFixed(1)}%`
      : null;

  return (
    <div
      className={`${INSIDER_GRID} h-[60px] max-h-[60px] items-center bg-white text-[14px] font-normal leading-5 transition-colors duration-75 hover:bg-neutral-50`}
    >
      <div className="text-left tabular-nums text-[#09090B]">{formatDisplayDate(row.transactionDate)}</div>
      <div className="min-w-0 truncate text-right text-[#09090B]" title={row.ownerName}>
        {row.ownerName}
      </div>
      <div className="min-w-0 truncate text-right text-[#09090B]" title={row.ownerTitle ?? undefined}>
        {row.ownerTitle?.trim() ? row.ownerTitle : "-"}
      </div>
      <div className="flex min-w-0 justify-end">
        <TransactionBadge kind={row.kind} />
      </div>
      <div className={`min-w-0 w-full text-right tabular-nums ${shareColor}`}>
        <span>{sharesText}</span>
        {pctText ? <span className={`ml-2 ${pctColor}`}>{pctText}</span> : null}
      </div>
      <div className="min-w-0 w-full text-right font-['Inter'] tabular-nums text-[#09090B]">
        {row.price != null && Number.isFinite(row.price) ? `$${row.price.toFixed(2)}` : "-"}
      </div>
      <div className="min-w-0 w-full text-right font-['Inter'] tabular-nums text-[#09090B]">
        {row.value != null && Number.isFinite(row.value) ? formatCompactUsd(row.value) : "-"}
      </div>
    </div>
  );
}

export function StockInsidersTab({ ticker }: { ticker: string }) {
  const sym = ticker.trim().toUpperCase();
  const [rows, setRows] = useState<InsiderTransactionRow[] | null>(null);
  const [windowTo, setWindowTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insidersChartRange, setInsidersChartRange] = useState<StockChartRange>("1Y");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/insider-transactions`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setRows([]);
        setWindowTo(null);
        setError("Could not load insider transactions.");
        return;
      }
      const json = (await res.json()) as { rows?: InsiderTransactionRow[]; windowTo?: string };
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setWindowTo(typeof json.windowTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(json.windowTo) ? json.windowTo : null);
    } catch {
      setRows([]);
      setWindowTo(null);
      setError("Could not load insider transactions.");
    } finally {
      setLoading(false);
    }
  }, [sym]);

  useEffect(() => {
    void load();
  }, [load]);

  const anchorYmd = windowTo ?? format(new Date(), "yyyy-MM-dd");
  const summary = useMemo(() => {
    const list = rows ?? [];
    return {
      m3: aggregateInsiderWindow(list, anchorYmd, 3),
      m6: aggregateInsiderWindow(list, anchorYmd, 6),
      m12: aggregateInsiderWindow(list, anchorYmd, 12),
    };
  }, [rows, anchorYmd]);

  const insiderTradeMarkers = useMemo((): readonly HoldingsTradeMarker[] => {
    const list = rows ?? [];
    return [...list]
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))
      .map((r) => ({ date: r.transactionDate, side: insiderMarkerSide(r.kind) }));
  }, [rows]);

  const insiderTradeTooltipItems = useMemo((): HoldingsTradeTooltipItem[] => {
    const list = rows ?? [];
    const byDate = new Map<string, string[]>();
    for (const r of list) {
      const sideLabel = r.kind === "purchase" ? "Buy" : "Sell";
      const kindLabel = insiderKindLabel(r.kind);
      const sharesPart =
        r.shares != null && Number.isFinite(r.shares)
          ? `${r.shares < 0 ? "" : r.kind === "purchase" && r.shares > 0 ? "+" : ""}${sharesFmt(r.shares)} sh`
          : null;
      const pricePart = r.price != null && Number.isFinite(r.price) ? `$${r.price.toFixed(2)}` : null;
      const valuePart = r.value != null && Number.isFinite(r.value) ? formatCompactUsd(r.value) : null;
      const detail =
        r.kind === "purchase"
          ? [r.ownerName, sharesPart, pricePart, valuePart].filter(Boolean).join(" · ")
          : [kindLabel, r.ownerName, sharesPart, pricePart, valuePart].filter(Boolean).join(" · ");
      const line = `${sideLabel} · ${detail}`;
      const lines = byDate.get(r.transactionDate) ?? [];
      lines.push(line);
      byDate.set(r.transactionDate, lines);
    }
    return [...byDate.entries()].map(([date, lines]) => ({ date, lines }));
  }, [rows]);

  return (
    <div className="space-y-5 pt-1">
      <div className="mb-8 space-y-6">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Insiders</h2>
            <SegmentedControl
              className="shrink-0"
              options={INSIDERS_CHART_RANGES.map((r) => ({ value: r, label: r }))}
              value={insidersChartRange}
              onChange={setInsidersChartRange}
              size="sm"
              aria-label="Insiders chart range"
            />
          </div>
          <div className="overflow-visible rounded-[12px] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
            <PriceChart
              kind="stock"
              symbol={sym}
              range={insidersChartRange}
              holdingsStyle
              tradeMarkers={insiderTradeMarkers}
              tradeTooltipItems={insiderTradeTooltipItems}
            />
          </div>
        </section>

        {loading ? (
          <InsiderSummaryCardsSkeleton />
        ) : error ? null : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InsiderPeriodCard title="Last 3 Months" agg={summary.m3} />
            <InsiderPeriodCard title="Last 6 Months" agg={summary.m6} />
            <InsiderPeriodCard title="Last 12 Months" agg={summary.m12} />
          </div>
        )}
        <h2 className="text-[24px] font-semibold leading-9 tracking-tight text-[#09090B]">Latest transactions</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          <InsidersTableSkeleton rows={8} />
          <div className="flex items-center justify-center gap-2 py-4 text-[14px] text-[#2563EB]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span>Loading…</span>
          </div>
        </div>
      ) : error ? (
        <p className="py-8 text-center text-[14px] leading-6 text-[#DC2626]">{error}</p>
      ) : !rows?.length ? (
        <p className="py-10 text-center text-[14px] leading-6 text-[#71717A]">No insider transactions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
            <div
              className={`${INSIDER_GRID} min-h-[44px] items-center bg-white py-0 text-[14px] font-medium leading-5 text-[#71717A]`}
            >
              <div className="text-left">Date</div>
              <div className="min-w-0 w-full text-right">Insider</div>
              <div className="min-w-0 w-full text-right">Position</div>
              <div className="min-w-0 w-full text-right">Transaction type</div>
              <div className="min-w-0 w-full text-right">Number of shares</div>
              <div className="min-w-0 w-full text-right">Price</div>
              <div className="min-w-0 w-full text-right">Value</div>
            </div>
            {rows.map((row, i) => (
              <InsiderRow key={`${row.transactionDate}-${row.ownerName}-${row.transactionCode}-${i}`} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
