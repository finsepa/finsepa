"use client";

import { useEffect, useMemo, useState } from "react";

import { formatUsdPrice } from "@/lib/market/key-stats-basic-format";
import { normalizeAnalystLabel, toneForConsensusLabel } from "@/lib/market/analyst-consensus-tone";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockAnalystDistributionBucket, StockTargetPricePayload } from "@/lib/market/stock-target-price-types";
import {
  fetchStockTargetPricePayloadClient,
  peekStockTargetPricePayloadClient,
} from "@/lib/market/stock-target-price-client";

const DISTRIBUTION_FILLS = ["#16A34A", "#84CC16", "#CA8A04", "#FB923C", "#DC2626"] as const;

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function analystBucketScore(label: string): number | null {
  const l = normalizeAnalystLabel(label);
  if (l === "strong buy") return 5;
  if (l === "buy") return 4;
  if (l === "neutral") return 3;
  if (l === "sell") return 2;
  if (l === "strong sell") return 1;
  return null;
}

function labelFromAvgScore(avg: number): string {
  if (avg >= 4.5) return "Strong buy";
  if (avg >= 3.5) return "Buy";
  if (avg >= 2.5) return "Neutral";
  if (avg >= 1.5) return "Sell";
  return "Strong sell";
}

function avgScoreFromBuckets(buckets: StockAnalystDistributionBucket[]): number | null {
  let num = 0;
  let den = 0;
  for (const b of buckets) {
    const s = analystBucketScore(b.label);
    if (s == null) continue;
    const c = b.count;
    if (!Number.isFinite(c) || c <= 0) continue;
    num += s * c;
    den += c;
  }
  if (den <= 0) return null;
  return num / den;
}

function majorityLabelFromBuckets(buckets: StockAnalystDistributionBucket[]): string | null {
  let best: { label: string; count: number; score: number } | null = null;
  for (const b of buckets) {
    const score = analystBucketScore(b.label);
    if (score == null) continue;
    const c = b.count;
    if (!Number.isFinite(c) || c <= 0) continue;
    if (!best || c > best.count || (c === best.count && score > best.score)) {
      best = { label: b.label, count: c, score };
    }
  }
  return best ? labelFromAvgScore(best.score) : null;
}

function dashPrice(n: number | null): string {
  return n != null && Number.isFinite(n) ? formatUsdPrice(n) : "—";
}

type UpsideVsLast = { kind: "ok"; pct: number; pctLabel: string } | { kind: "dash" };

function upsideVsLastPrice(current: number | null, target: number | null): UpsideVsLast {
  if (current == null || target == null || !Number.isFinite(current) || !Number.isFinite(target) || current === 0) {
    return { kind: "dash" };
  }
  const pct = ((target - current) / current) * 100;
  const sign = pct > 0 ? "+" : "";
  return { kind: "ok", pct, pctLabel: `${sign}${pct.toFixed(2)}%` };
}

function AnalystConsensusGaugeCard({ buckets }: { buckets: StockAnalystDistributionBucket[] }) {
  const majorityLabel = useMemo(() => majorityLabelFromBuckets(buckets), [buckets]);
  const avgScore = useMemo(() => avgScoreFromBuckets(buckets), [buckets]);
  const consensusLabel = majorityLabel ?? (avgScore == null ? "—" : labelFromAvgScore(avgScore));
  const consensusScore =
    majorityLabel != null ? analystBucketScore(majorityLabel) : avgScore == null ? null : avgScore;
  const consensusNorm =
    consensusScore == null ? 0.5 : Math.max(0, Math.min(1, (consensusScore - 1) / 4));
  const tone = useMemo(() => toneForConsensusLabel(consensusLabel), [consensusLabel]);

  const gauge = useMemo(() => {
    // Top-half semicircle sweep -90..90 (left→right), map 0..1 onto that sweep.
    const angle = -90 + consensusNorm * 180;
    const cx = 160;
    // Keep the circle center below the viewBox so only the top half is visible (matches design).
    const cy = 188;
    const r = 152;
    const dot = polarToCartesian(cx, cy, r, angle);
    return { cx, cy, r, dot };
  }, [consensusNorm]);

  return (
    <div className="w-full max-w-[358px] min-w-0 justify-self-start rounded-[12px] border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
      <div className="h-[190px] w-full">
        <svg viewBox="0 0 320 200" className="h-full w-full" role="img" aria-label="Analyst consensus gauge">
          <defs>
            <linearGradient id="analyst-consensus-grad" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#DC2626" />
              <stop offset="0.35" stopColor="#F59E0B" />
              <stop offset="0.6" stopColor="#EAB308" />
              <stop offset="1" stopColor="#16A34A" />
            </linearGradient>
          </defs>

          <path
            d={arcPath(gauge.cx, gauge.cy, gauge.r, -90, 90)}
            stroke="url(#analyst-consensus-grad)"
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
          />

          <circle cx={gauge.dot.x} cy={gauge.dot.y} r="14" fill="#FFFFFF" />
          <circle cx={gauge.dot.x} cy={gauge.dot.y} r="11" fill={tone.dot} opacity={consensusScore == null ? 0.35 : 1} />

          <text
            x="160"
            y="122"
            textAnchor="middle"
            style={{ fill: tone.text, fontFamily: "Inter", fontSize: 24, fontWeight: 600, lineHeight: "36px", letterSpacing: "0px" }}
          >
            {consensusLabel}
          </text>
          <text
            x="160"
            y="154"
            textAnchor="middle"
            className="fill-[#71717A]"
            style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 400, lineHeight: "20px", letterSpacing: "0px" }}
          >
            Total Consensus
          </text>
        </svg>
      </div>
    </div>
  );
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

export function StockTargetPriceTab({
  ticker,
  initialPerformance = null,
}: {
  ticker: string;
  initialPerformance?: StockPerformance | null;
}) {
  const sym = ticker.trim().toUpperCase();
  const cachedTargets = peekStockTargetPricePayloadClient(sym);
  const [loading, setLoading] = useState(() => !cachedTargets);
  const [targets, setTargets] = useState<StockTargetPricePayload | null>(() => normalizePayload(cachedTargets));
  const [perf, setPerf] = useState<StockPerformance | null>(() => initialPerformance);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      if (initialPerformance) setPerf(initialPerformance);
      const cached = peekStockTargetPricePayloadClient(sym);
      if (cached) {
        setTargets(normalizePayload(cached));
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [raw, perfJson] = await Promise.all([
          fetchStockTargetPricePayloadClient(sym, controller.signal),
          initialPerformance
            ? Promise.resolve(initialPerformance)
            : fetch(`/api/stocks/${encodeURIComponent(sym)}/performance`, {
                credentials: "include",
                signal: controller.signal,
              }).then(async (res) => (res.ok ? ((await res.json()) as StockPerformance) : null)),
        ]);
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
      controller.abort();
    };
  }, [sym, initialPerformance]);

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
  const upsideVsLast = useMemo(() => upsideVsLastPrice(lastPrice, consensus), [lastPrice, consensus]);

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
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#71717A]">Target price</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums leading-8 tracking-tight text-[#09090B]">
            {dashPrice(consensus)}
          </p>
          <p className="mt-1 text-[13px] leading-5">
            {upsideVsLast.kind === "dash" ? (
              <span className="text-[#71717A]">—</span>
            ) : (
              <>
                <span
                  className={
                    upsideVsLast.pct > 0
                      ? "font-medium text-[#16A34A]"
                      : upsideVsLast.pct < 0
                        ? "font-medium text-[#DC2626]"
                        : "text-[#71717A]"
                  }
                >
                  {upsideVsLast.pctLabel}
                </span>
                <span className="text-[#71717A]"> vs last price</span>
              </>
            )}
          </p>
        </div>
      ) : null}

      {hasDistribution ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,358px)_minmax(0,1fr)] lg:items-start">
          <AnalystConsensusGaugeCard buckets={buckets} />
          <AnalystDistributionCard buckets={buckets} />
        </div>
      ) : null}
    </div>
  );
}
