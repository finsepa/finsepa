"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CompanyLogo } from "./company-logo";
import { CryptoTableSkeleton } from "@/components/markets/markets-skeletons";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChangeCell({ value }: { value: number | null }) {
  const isMissing = value == null || !Number.isFinite(value);
  const positive = !isMissing && value! >= 0;
  return (
    <span
      className={`block text-center tabular-nums text-[14px] leading-5 font-medium ${
        isMissing ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercent(value)}
    </span>
  );
}

function Spark({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 80;
  const h = 32;
  const series = points.length >= 2 ? points : points.length === 1 ? [points[0]!, points[0]!] : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const fillPath = `M${pts[0]} L${pts.slice(1).join(" L")} L${w},${h} L0,${h} Z`;
  const stroke = positive ? "#16A34A" : "#DC2626";
  const fill = positive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)";
  const lastPt = pts[pts.length - 1]?.split(",") ?? ["0", "0"];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={fillPath} fill={fill} />
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2" fill={stroke} />
    </svg>
  );
}

export function CryptoTable() {
  const [rows, setRows] = useState<CryptoTop10Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/screener/crypto-top10", { cache: "no-store" });
        if (!res.ok) {
          if (!mounted) return;
          setRows([]);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { rows?: CryptoTop10Row[] };
        if (!mounted) return;
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setRows([]);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const safeRows = useMemo(() => rows, [rows]);
  if (loading || safeRows.length === 0) return <CryptoTableSkeleton rows={10} />;

  return (
    <div className="overflow-hidden">
      <div
        className="grid grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A] [&>div]:text-center"
      >
        <div>#</div>
        <div className="!text-left">Coin</div>
        <div>Price</div>
        <div>1D %</div>
        <div>1M %</div>
        <div>YTD %</div>
        <div>M Cap</div>
        <div>Last 5 Days</div>
      </div>

      {safeRows.map((r, i) => {
        const positive = r.changePercent1D != null ? r.changePercent1D >= 0 : (r.sparkline5d.at(-1) ?? 0) >= (r.sparkline5d[0] ?? 0);
        return (
          <Link
            key={r.symbol}
            href={`/crypto/${encodeURIComponent(r.symbol)}`}
            className="contents"
            aria-label={`Open ${r.name} (${r.symbol})`}
          >
            <div
              className="group grid h-[60px] max-h-[60px] grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] items-center border-b border-[#E4E4E7] px-1 last:border-b-0 transition-colors duration-75 hover:bg-neutral-50"
            >
              <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">
                {i + 1}
              </div>

              <div className="flex min-w-0 items-center gap-3 pr-4">
                <CompanyLogo name={r.symbol} logoUrl={r.logoUrl} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{r.name}</div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">{r.symbol}</div>
                </div>
              </div>

              <div
                className={`text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums ${
                  r.price == null || !Number.isFinite(r.price) ? "text-[#71717A]" : "text-[#09090B]"
                }`}
              >
                {r.price == null || !Number.isFinite(r.price)
                  ? "-"
                  : `$${r.price.toLocaleString("en-US", { maximumFractionDigits: r.price < 1 ? 4 : 2 })}`}
              </div>

              <div className="text-center">
                <ChangeCell value={r.changePercent1D} />
              </div>

              <div className="text-center">
                <ChangeCell value={r.changePercent1M} />
              </div>

              <div className="text-center">
                <ChangeCell value={r.changePercentYTD} />
              </div>

              <div className="text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
                {r.marketCap}
              </div>

              <div className="flex items-center justify-center">
                {r.sparkline5d.length ? (
                  <Spark points={r.sparkline5d} positive={positive} />
                ) : (
                  <span className="inline-flex h-8 w-20 items-center justify-center">
                    {/* Keep dimensions stable even if sparkline is missing. */}
                    <span className="h-8 w-20 rounded-md bg-[#E4E4E7]" />
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

