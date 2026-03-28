"use client";

import { useEffect, useMemo, useState } from "react";
import { IndicesTableSkeleton } from "@/components/markets/markets-skeletons";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import { indexWatchlistKey } from "@/lib/watchlist/constants";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

type IndexRow = {
  name: string;
  symbol: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
  spark5d: number[];
};

function formatValue(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return <span className="block text-center text-[14px] leading-5 font-medium text-[#71717A]">-</span>;
  const positive = value >= 0;
  return (
    <span className={`block text-center tabular-nums text-[14px] leading-5 font-medium ${positive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
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
  const lastPt = pts[pts.length - 1].split(",");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={fillPath} fill={fill} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2" fill={stroke} />
    </svg>
  );
}

const colLayout = "grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_96px]";

export function IndicesTable() {
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { watched, loaded, toggleTicker } = useWatchlist();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/screener/indices-top10?ts=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as { rows?: IndexRow[] };
      if (!mounted) return;
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const safeRows = useMemo(() => rows, [rows]);

  if (loading || safeRows.length === 0) {
    return <IndicesTableSkeleton rows={10} />;
  }

  return (
    <div className="overflow-hidden">
      <div
        className={`grid ${colLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A] [&>div]:text-center`}
      >
        <div />
        <div className="!text-left">Index</div>
        <div>Value</div>
        <div>1D %</div>
        <div>1M %</div>
        <div>YTD %</div>
        <div>Last 5 Days</div>
      </div>

      {safeRows.map((r) => {
        const positive = r.spark5d.length >= 2 ? r.spark5d[r.spark5d.length - 1]! >= r.spark5d[0]! : r.change1D >= 0;
        const wlKey = indexWatchlistKey(r.symbol);
        return (
          <div
            key={r.symbol}
            className={`group grid h-[60px] max-h-[60px] ${colLayout} items-center border-b border-[#E4E4E7] px-1 last:border-b-0 transition-colors duration-75 hover:bg-neutral-50`}
          >
            <WatchlistStarToggle
              className="flex w-10 shrink-0 items-center justify-center px-3"
              storageKey={wlKey}
              label={r.name}
              watched={watched}
              loaded={loaded}
              toggleTicker={toggleTicker}
            />
            <div className="px-4 text-left text-[14px] font-semibold leading-5 text-[#09090B]">{r.name}</div>
            <div className="text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">{formatValue(r.value)}</div>
            <ChangeCell value={r.change1D} />
            <ChangeCell value={r.change1M} />
            <ChangeCell value={r.changeYTD} />
            <div className="flex items-center">
              <Spark points={r.spark5d} positive={positive} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
