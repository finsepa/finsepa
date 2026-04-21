"use client";

import { useEffect, useMemo, useState } from "react";

import { formatUsdPrice } from "@/lib/market/key-stats-basic-format";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockAnalystDistributionBucket, StockTargetPricePayload } from "@/lib/market/stock-target-price-types";

const DISTRIBUTION_FILLS = ["#16A34A", "#84CC16", "#CA8A04", "#FB923C", "#DC2626"] as const;

function dashPrice(n: number | null): string {
  return n != null && Number.isFinite(n) ? formatUsdPrice(n) : "—";
}

function pctVsCurrent(current: number | null, target: number | null): string {
  if (current == null || target == null || !Number.isFinite(current) || !Number.isFinite(target) || current === 0) {
    return "—";
  }
  const pct = ((target - current) / current) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}% vs last price`;
}

function AnalystDistributionCard({ buckets }: { buckets: StockAnalystDistributionBucket[] }) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="w-full min-w-0 rounded-[12px] border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
      <h3 className="mb-4 text-[14px] font-semibold leading-5 text-[#09090B]">Analyst distribution</h3>
      <div className="space-y-3.5">
        {buckets.map((row, i) => {
          const pct = maxCount > 0 ? Math.min(100, (row.count / maxCount) * 100) : 0;
          const fill = DISTRIBUTION_FILLS[i] ?? "#71717A";
          return (
            <div key={row.label} className="flex items-center gap-3 sm:gap-4">
              <span className="w-[92px] shrink-0 text-[14px] leading-5 text-[#09090B] sm:w-[100px]">{row.label}</span>
              <span className="w-8 shrink-0 text-right text-[14px] tabular-nums leading-5 text-[#09090B]">{row.count}</span>
              <div className="min-w-0 flex-1">
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F4F4F5]">
                  {row.count > 0 ? (
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: fill }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizePayload(json: StockTargetPricePayload | null): StockTargetPricePayload | null {
  if (!json) return null;
  const analystDistribution =
    Array.isArray(json.analystDistribution) && json.analystDistribution.length > 0
      ? json.analystDistribution
      : [
          { label: "Strong buy", count: 0 },
          { label: "Buy", count: 0 },
          { label: "Neutral", count: 0 },
          { label: "Sell", count: 0 },
          { label: "Strong sell", count: 0 },
        ];
  return { ...json, analystDistribution };
}

export function StockTargetPriceTab({ ticker }: { ticker: string }) {
  const sym = ticker.trim().toUpperCase();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<StockTargetPricePayload | null>(null);
  const [perf, setPerf] = useState<StockPerformance | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tpRes, perfRes] = await Promise.all([
          fetch(`/api/stocks/${encodeURIComponent(sym)}/target-price`, { credentials: "include" }),
          fetch(`/api/stocks/${encodeURIComponent(sym)}/performance`, { credentials: "include" }),
        ]);
        const raw = tpRes.ok ? ((await tpRes.json()) as StockTargetPricePayload) : null;
        const perfJson = perfRes.ok ? ((await perfRes.json()) as StockPerformance) : null;
        if (!cancelled) {
          setTargets(normalizePayload(raw));
          setPerf(perfJson);
        }
      } catch {
        if (!cancelled) {
          setTargets(null);
          setPerf(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  const lastPrice = perf?.price != null && Number.isFinite(perf.price) ? perf.price : null;
  const consensus = targets?.consensusTarget ?? null;

  const buckets = targets?.analystDistribution ?? [];
  const hasDistribution = buckets.some((b) => b.count > 0);

  const hasAnyTarget =
    targets != null &&
    [
      targets.consensusTarget,
      targets.wallStreetTarget,
      targets.meanTarget,
      targets.highTarget,
      targets.lowTarget,
      targets.fairValue,
    ].some((v) => v != null && Number.isFinite(v));

  const hasAnyData = hasAnyTarget || hasDistribution;
  const upsideLine = useMemo(() => pctVsCurrent(lastPrice, consensus), [lastPrice, consensus]);

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-4 pt-1">
        <div className="h-40 w-full animate-pulse rounded-[12px] bg-[#F4F4F5]" />
        <div className="h-32 w-full animate-pulse rounded-[12px] bg-[#F4F4F5]" />
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="w-full min-w-0 pt-1">
        <p className="w-full text-[14px] leading-6 text-[#71717A]">
          No analyst consensus, price target, or distribution data is available for this symbol from the current data provider.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 pt-1">
      {hasAnyTarget ? (
        <div className="w-full min-w-0 rounded-[12px] border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#71717A]">Consensus target</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums leading-8 tracking-tight text-[#09090B]">
            {dashPrice(consensus)}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#71717A]">{upsideLine}</p>
        </div>
      ) : null}

      {hasDistribution ? <AnalystDistributionCard buckets={buckets} /> : null}
    </div>
  );
}
