import Link from "next/link";
import { Star } from "lucide-react";
import { logoColors, screenerData } from "./data";

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChangeCell({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`block text-center tabular-nums text-[14px] leading-5 font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercent(value)}
    </span>
  );
}

function LogoMark({ name }: { name: string }) {
  const colors = logoColors[name] ?? { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-200" };
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TrendSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 80;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
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

const colLayout = "grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr_80px_96px] gap-x-2";

export function ScreenerTable() {
  return (
    <div className="overflow-hidden">

      {/* Column headers */}
      <div className={`grid ${colLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A] [&>div]:text-center`}>
        <div />
        <div>#</div>
        <div className="!text-left">Company</div>
        <div>Price</div>
        <div>1D %</div>
        <div>1M %</div>
        <div>YTD %</div>
        <div>M Cap</div>
        <div>PE</div>
        <div>Last 5 Days</div>
      </div>

      {/* Rows */}
      {screenerData.map((item, index) => {
        const trendPositive = item.trend[item.trend.length - 1] >= item.trend[0];
        return (
          <Link
            key={item.id}
            href={`/stock/${item.ticker}`}
            className={`group grid ${colLayout} h-[60px] max-h-[60px] items-center border-b border-[#E4E4E7] px-1 last:border-b-0 transition-colors duration-75 hover:bg-neutral-50`}
          >
            {/* Star */}
            <div className="flex w-10 shrink-0 items-center justify-center px-3">
              <Star
                className={`h-4 w-4 transition-colors ${
                  item.starred
                    ? "fill-orange-400 text-orange-400"
                    : "fill-none text-neutral-300 group-hover:text-neutral-400"
                }`}
              />
            </div>

            {/* Rank */}
            <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">{index + 1}</div>

            {/* Company (logo + text) */}
            <div className="flex min-w-0 items-center gap-3 pr-4">
              <LogoMark name={item.name} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{item.name}</div>
                <div className="text-[12px] font-normal leading-4 text-[#71717A]">{item.ticker}</div>
              </div>
            </div>

            {/* Price */}
            <div className="text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
              ${item.price.toFixed(2)}
            </div>

            <ChangeCell value={item.change1D} />
            <ChangeCell value={item.change1M} />
            <ChangeCell value={item.changeYTD} />

            {/* M Cap */}
            <div className="text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">{item.marketCap}</div>

            {/* PE */}
            <div className="text-center font-['Inter'] text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">{item.pe}</div>

            {/* Sparkline */}
            <div className="flex items-center">
              <TrendSparkline points={item.trend} positive={trendPositive} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
