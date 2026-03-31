"use client";

import { useMemo, useRef, useState } from "react";

import { formatMacroValue, type MacroValueKind } from "@/components/macro/macro-format";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function MacroSparkline({
  title,
  kind,
  points,
  height = 128,
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  height?: number;
}) {
  const w = 320;
  const h = height;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverPx, setHoverPx] = useState<number | null>(null);

  const cleaned = useMemo(() => {
    const out = points
      .filter((p) => typeof p.time === "string" && p.time.trim() && Number.isFinite(p.value))
      .map((p) => ({ time: p.time.slice(0, 10), value: p.value }));
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }, [points]);

  const series = cleaned.map((p) => p.value);

  const safe = series.length >= 2 ? series : series.length === 1 ? [series[0]!, series[0]!] : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  const padX = 2;
  const padY = 6;

  const pts = safe.map((v, i) => {
    const x = padX + (i / (safe.length - 1)) * (w - padX * 2);
    const y = h - padY - ((v - min) / range) * (h - padY * 2);
    return `${clamp(x, 0, w).toFixed(2)},${clamp(y, 0, h).toFixed(2)}`;
  });

  const polyline = pts.join(" ");
  const fillPath = `M${pts[0]} L${pts.slice(1).join(" L")} L${w},${h} L0,${h} Z`;
  const stroke = "#09090B";
  const fill = "rgba(9,9,11,0.06)";

  const years = useMemo(() => {
    const ys = new Set<string>();
    for (const p of cleaned) ys.add(p.time.slice(0, 4));
    // show up to 5 (last 5 years in the chart window)
    return Array.from(ys).sort().slice(-5);
  }, [cleaned]);

  const hover = useMemo(() => {
    if (hoverIdx == null) return null;
    const idx = clamp(hoverIdx, 0, safe.length - 1);
    const point = cleaned.length ? cleaned[Math.min(idx, cleaned.length - 1)] : null;
    const xy = pts[idx]?.split(",") ?? null;
    if (!point || !xy) return null;
    const x = Number(xy[0]);
    const y = Number(xy[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { idx, point, x, y };
  }, [cleaned, hoverIdx, pts, safe.length]);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const xPx = e.clientX - r.left;
    const x = (xPx / Math.max(1, r.width)) * w;
    const idx = Math.round(((x - padX) / Math.max(1, w - padX * 2)) * (safe.length - 1));
    setHoverIdx(clamp(idx, 0, safe.length - 1));
    setHoverPx(xPx);
  };

  const clearHover = () => {
    setHoverIdx(null);
    setHoverPx(null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full" onPointerMove={onPointerMove} onPointerLeave={clearHover}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" fill="none">
        <path d={fillPath} fill={fill} />
        <polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover ? (
          <>
            <line x1={hover.x} x2={hover.x} y1={0} y2={h} stroke="rgba(9,9,11,0.10)" strokeWidth="1" />
            <circle cx={hover.x} cy={hover.y} r="3" fill={stroke} />
            <circle cx={hover.x} cy={hover.y} r="6" fill="rgba(9,9,11,0.10)" />
          </>
        ) : null}
      </svg>

      {hover && hoverPx != null ? (
        <div
          className="pointer-events-none absolute top-2 z-10"
          style={{
            left: hoverPx,
            transform: "translateX(-50%)",
          }}
        >
          <div className="rounded-xl bg-[#09090B] px-3 py-2 text-white shadow-[0px_10px_30px_rgba(0,0,0,0.25)]">
            <div className="text-[12px] font-semibold leading-4 tabular-nums text-white/90">{hover.point.time.slice(0, 4)}</div>
            <div className="mt-1 max-w-[240px] text-[12px] leading-4 text-white/80">{title}</div>
            <div className="mt-1 text-[13px] font-semibold leading-4 tabular-nums text-white">
              {formatMacroValue(kind, hover.point.value)}
            </div>
          </div>
        </div>
      ) : null}

      {years.length ? (
        <div className="mt-1 flex justify-between text-[11px] leading-4 text-[#A1A1AA] tabular-nums">
          {years.map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

