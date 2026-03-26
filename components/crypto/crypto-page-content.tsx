"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CompanyLogo } from "@/components/screener/company-logo";
import { LogoSkeleton, PillSkeleton, SparklineSkeleton, SkeletonBox } from "@/components/markets/skeleton";
import type { CryptoAssetRow } from "@/lib/market/crypto-asset";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChangeValue({ value }: { value: number | null }) {
  const missing = value == null || !Number.isFinite(value);
  const positive = !missing && value! >= 0;
  return (
    <span
      className={`inline-flex items-center font-medium tabular-nums ${
        missing ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercent(value)}
    </span>
  );
}

function BigSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 320;
  const h = 110;
  const series = points.length >= 2 ? points : points.length === 1 ? [points[0]!, points[0]!] : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const fillPath = `M${pts[0]} L${pts.slice(1).join(" L")} L${w},${h} L0,${h} Z`;

  const stroke = positive ? "#16A34A" : "#DC2626";
  const fill = positive ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)";
  const lastPt = pts[pts.length - 1]?.split(",") ?? ["0", "0"];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="w-full">
      <path d={fillPath} fill={fill} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill={stroke} />
    </svg>
  );
}

export function CryptoPageContent({ routeSymbol }: { routeSymbol: string }) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<CryptoAssetRow | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/crypto/asset/${encodeURIComponent(routeSymbol)}`, { cache: "no-store" });
        if (!res.ok) {
          if (!mounted) return;
          setRow(null);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { row?: CryptoAssetRow };
        if (!mounted) return;
        setRow(json.row ?? null);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setRow(null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [routeSymbol]);

  const safeRow = useMemo(() => row, [row]);
  const positive = safeRow?.changePercent1D != null ? safeRow.changePercent1D >= 0 : (safeRow?.sparkline5d.at(-1) ?? 0) >= (safeRow?.sparkline5d[0] ?? 0);

  return (
    <div className="px-9 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
          <Link href="/screener" className="hover:text-[#09090B] transition-colors">
            Markets
          </Link>
          <span className="text-[#71717A]">/</span>
          <span className="text-[#09090B] font-medium">{routeSymbol.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {loading ? (
            <LogoSkeleton sizeClass="h-12 w-12" />
          ) : (
            safeRow && <CompanyLogo name={safeRow.symbol} logoUrl={safeRow.logoUrl} />
          )}
          <div>
            {loading ? (
              <>
                <SkeletonBox className="h-7 w-40 rounded-md" />
                <SkeletonBox className="mt-1 h-4 w-24 rounded-md" />
              </>
            ) : safeRow ? (
              <>
                <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">{safeRow.name}</h1>
                <div className="mt-0.5 text-[14px] text-[#71717A] font-medium">{safeRow.symbol}</div>
              </>
            ) : (
              <div className="text-[14px] text-[#71717A]">Not available</div>
            )}
          </div>
        </div>

        <div className="text-right">
          {loading ? (
            <>
              <SkeletonBox className="mx-auto h-9 w-36 rounded-md" />
              <div className="mt-2 flex items-center justify-end gap-2">
                <PillSkeleton wClass="w-20" />
              </div>
            </>
          ) : safeRow ? (
            <>
              <div className="flex items-baseline gap-2 justify-end">
                <span className="text-[28px] font-semibold leading-9 tabular-nums text-[#09090B]">
                  {safeRow.price == null || !Number.isFinite(safeRow.price)
                    ? "-"
                    : `$${safeRow.price.toLocaleString("en-US", { maximumFractionDigits: safeRow.price < 1 ? 4 : 2 })}`}
                </span>
                <ChangeValue value={safeRow.changePercent1D} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-4">
        {loading ? (
          <SparklineSkeleton className="h-28 w-full" />
        ) : safeRow ? (
          safeRow.sparkline5d.length ? (
            <BigSparkline points={safeRow.sparkline5d} positive={positive} />
          ) : (
            <div className="h-28" />
          )
        ) : (
          <div className="h-28" />
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
          <div className="text-[13px] text-[#71717A] font-medium">1D %</div>
          <div className="mt-1">
            {loading ? <SkeletonBox className="h-6 w-20 rounded-md" /> : <ChangeValue value={safeRow?.changePercent1D ?? null} />}
          </div>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
          <div className="text-[13px] text-[#71717A] font-medium">1M %</div>
          <div className="mt-1">
            {loading ? <SkeletonBox className="h-6 w-20 rounded-md" /> : <ChangeValue value={safeRow?.changePercent1M ?? null} />}
          </div>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
          <div className="text-[13px] text-[#71717A] font-medium">YTD %</div>
          <div className="mt-1">
            {loading ? <SkeletonBox className="h-6 w-20 rounded-md" /> : <ChangeValue value={safeRow?.changePercentYTD ?? null} />}
          </div>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
          <div className="text-[13px] text-[#71717A] font-medium">Market cap</div>
          <div className="mt-1">
            {loading ? (
              <SkeletonBox className="h-6 w-32 rounded-md" />
            ) : (
              <div className="text-[14px] font-semibold tabular-nums text-[#09090B]">{safeRow?.marketCap ?? "-"}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

