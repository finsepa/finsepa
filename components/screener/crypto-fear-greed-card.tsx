"use client";

import { ChevronRight } from "@/lib/icons";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import type { CryptoFearGreedIndex } from "@/lib/market/alternative-fear-greed";
import { FEAR_GREED_BANDS } from "@/lib/screener/fear-greed-color";

function labelForClassification(raw: string): string {
  const v = raw.trim();
  return v || "—";
}

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

/** Map 0..100 onto the gauge’s −120..120° sweep. */
function valueToGaugeAngle(v: number): number {
  return -120 + (Math.max(0, Math.min(100, v)) / 100) * 240;
}

/** Visual gap between colored arcs (degrees). */
const GAUGE_SEGMENT_GAP_DEG = 8;

export function CryptoFearGreedCard({
  data,
  className,
  onOpenFullscreen,
}: {
  data: CryptoFearGreedIndex | null;
  className?: string;
  onOpenFullscreen?: () => void;
}) {
  const value = data?.value ?? null;
  const classification = labelForClassification(data?.classification ?? "");

  const gauge = useMemo(() => {
    const v = value == null ? 50 : Math.max(0, Math.min(100, value));
    const angle = valueToGaugeAngle(v);
    // Tune geometry so the arc fills the card height (matches Figma proportions)
    const cx = 160;
    const cy = 102;
    const r = 92;
    const dot = polarToCartesian(cx, cy, r, angle);

    const segments = FEAR_GREED_BANDS.map((band, i) => {
      const rawStart = valueToGaugeAngle(band.from);
      const rawEnd = valueToGaugeAngle(band.to);
      // Leave a gap after the previous band; keep this band’s high edge so e.g. 25
      // (Extreme Fear) still sits on the red arc tip rather than in the orange gap.
      const startDeg = i === 0 ? rawStart : rawStart + GAUGE_SEGMENT_GAP_DEG;
      const endDeg = rawEnd;
      return {
        color: band.color,
        startDeg,
        endDeg: Math.max(startDeg + 1, endDeg),
      };
    });

    return { angle, cx, cy, r, dot, segments };
  }, [value]);

  return (
    <div
      className={cn(
        "flex h-[188px] flex-col gap-[8px] px-[20px] pt-[8px] pb-[12px]",
        MOBILE_PANEL_CARD_CLASS,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenFullscreen}
          disabled={!onOpenFullscreen}
          className={cn(
            "group inline-flex min-w-0 items-center gap-1.5 truncate rounded-[10px] text-left text-[14px] font-semibold leading-5 text-[#71717A] outline-none transition-colors",
            onOpenFullscreen
              ? "hover:text-[#09090B] focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2"
              : "cursor-default",
          )}
          aria-label={onOpenFullscreen ? "Open Fear & Greed history" : undefined}
        >
          <span className="min-w-0 truncate">Fear &amp; Greed Index</span>
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-[#A1A1AA] transition-colors",
              onOpenFullscreen ? "group-hover:text-[#71717A]" : "",
            )}
            aria-hidden
          />
        </button>
      </div>

      <div className="relative h-[132px] w-full">
        <div className="absolute left-1/2 -top-1 w-[224px] -translate-x-1/2">
          <svg viewBox="0 0 320 170" className="h-[132px] w-full">
            {gauge.segments.map((seg) => (
              <path
                key={seg.color}
                d={arcPath(gauge.cx, gauge.cy, gauge.r, seg.startDeg, seg.endDeg)}
                stroke={seg.color}
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
              />
            ))}

            {/* knob */}
            <circle cx={gauge.dot.x} cy={gauge.dot.y} r="12" fill="#09090B" stroke="#FFFFFF" strokeWidth="4" />

            {/* value */}
            <text
              x={gauge.cx}
              y="94"
              textAnchor="middle"
              className="fill-[#09090B]"
              style={{ fontFamily: "Inter", fontSize: 30, fontWeight: 900, lineHeight: "32px" }}
            >
              {value == null ? "—" : String(value)}
            </text>
            <text
              x={gauge.cx}
              y="118"
              textAnchor="middle"
              className="fill-[#71717A]"
              style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeight: "22px" }}
            >
              {classification}
            </text>
          </svg>
        </div>
      </div>

      {value == null ? (
        <div className="-mt-2 text-center text-[12px] leading-5 text-[#71717A]">Unavailable</div>
      ) : null}
    </div>
  );
}
