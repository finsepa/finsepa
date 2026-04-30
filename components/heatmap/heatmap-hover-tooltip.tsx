"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { HeatmapSparkline } from "@/components/heatmap/heatmap-sparkline";
import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";
import {
  HEATMAP_LABEL_NEGATIVE_HEX,
  HEATMAP_LABEL_POSITIVE_HEX,
  heatmapCellBackground,
  heatmapLegendHex,
} from "@/lib/heatmap/heatmap-colors";
import { cn } from "@/lib/utils";

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(n: number | null, market: HeatmapMarket): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (market === "crypto" && n > 0 && n < 0.01) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(n);
  }
  return usd2.format(n);
}

function pctLabel(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toFixed(2);
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function normalizeIndustryLabel(v: string | null | undefined): string {
  if (typeof v !== "string") return "Unclassified";
  const t = v.trim();
  return t.length > 0 ? t : "Unclassified";
}

function heatmapBreadcrumb(sector: string, industry: string | null | undefined, market: HeatmapMarket): string {
  const s = (sector ?? "").trim().split(/\s+/).filter(Boolean).join(" — ");
  const i = normalizeIndustryLabel(industry)
    .split(/\s+/)
    .filter(Boolean)
    .join(" — ");
  if (market === "crypto" || !i || i === s) {
    return s.toUpperCase();
  }
  return `${s} — ${i}`.toUpperCase();
}

function assetHref(market: HeatmapMarket, ticker: string): string {
  return market === "crypto" ? `/crypto/${encodeURIComponent(ticker)}` : `/stock/${encodeURIComponent(ticker)}`;
}

const TOOLTIP_W = 300;
const TOOLTIP_H = 420;
const VIEW_PAD = 12;
const CURSOR_OFF = 14;

function clampTooltipPos(clientX: number, clientY: number) {
  return {
    left: Math.max(VIEW_PAD, Math.min(clientX + CURSOR_OFF, window.innerWidth - TOOLTIP_W - VIEW_PAD)),
    top: Math.max(VIEW_PAD, Math.min(clientY + CURSOR_OFF, window.innerHeight - TOOLTIP_H - VIEW_PAD)),
  };
}

export function HeatmapHoverTooltip({
  market,
  allLeaves,
  hover,
  onTooltipEnter,
  onTooltipLeave,
}: {
  market: HeatmapMarket;
  allLeaves: HeatmapLeaf[];
  hover: { sector: string; featured: HeatmapLeaf; anchorX: number; anchorY: number } | null;
  onTooltipEnter: () => void;
  onTooltipLeave: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const peerSector = hover?.featured.sector ?? null;
  const peerIndustryNorm = hover ? normalizeIndustryLabel(hover.featured.industry) : null;
  const peersSorted = useMemo(() => {
    if (!peerSector || peerIndustryNorm == null) return [] as HeatmapLeaf[];
    return allLeaves
      .filter((l) => l.sector === peerSector && normalizeIndustryLabel(l.industry) === peerIndustryNorm)
      .sort((a, b) => b.marketCapUsd - a.marketCapUsd);
  }, [peerSector, peerIndustryNorm, allLeaves]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!hover) return;
    const el = wrapRef.current;

    const apply = (cx: number, cy: number) => {
      const p = clampTooltipPos(cx, cy);
      if (el) {
        el.style.left = `${p.left}px`;
        el.style.top = `${p.top}px`;
      }
    };

    apply(hover.anchorX, hover.anchorY);
    pendingRef.current = { x: hover.anchorX, y: hover.anchorY };

    const onMove = (e: PointerEvent) => {
      pendingRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const { x, y } = pendingRef.current;
        apply(x, y);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [hover]);

  if (!mounted || !hover) return null;

  const f = hover.featured;
  const heroBg = heatmapCellBackground(f.changePct);
  const heroOnLight = heroBg === heatmapLegendHex(0);
  const heroPctColor =
    f.changePct == null || !Number.isFinite(f.changePct)
      ? "#71717A"
      : f.changePct >= 0
        ? HEATMAP_LABEL_POSITIVE_HEX
        : HEATMAP_LABEL_NEGATIVE_HEX;
  const p0 = clampTooltipPos(hover.anchorX, hover.anchorY);

  return createPortal(
    <div
      ref={wrapRef}
      className={cn(
        dropdownMenuSurfaceClassName(),
        "fixed z-[200] w-[min(100vw-24px,300px)] overflow-hidden",
      )}
      style={{ left: p0.left, top: p0.top }}
      onMouseEnter={onTooltipEnter}
      onMouseLeave={onTooltipLeave}
      role="dialog"
      aria-label={`${f.ticker} details`}
    >
      <p className="border-b border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[10px] font-medium uppercase leading-4 tracking-wide text-[#71717A]">
        {heatmapBreadcrumb(hover.sector, hover.featured.industry ?? null, market)}
      </p>

      <Link
        href={assetHref(market, f.ticker)}
        className={cn(
          "block px-3 py-3 no-underline outline-none transition-opacity hover:opacity-95 focus-visible:ring-2",
          heroOnLight
            ? "text-[#09090B] focus-visible:ring-[#09090B]/15"
            : "text-white focus-visible:ring-white/40",
        )}
        style={{ backgroundColor: heroBg }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold leading-8 tracking-tight">{f.ticker}</p>
            <p
              className={cn(
                "mt-0.5 truncate text-sm font-normal leading-5",
                heroOnLight ? "text-[#71717A]" : "text-white/90",
              )}
            >
              {f.name}
            </p>
          </div>
          <HeatmapSparkline
            values={f.sparkline5d}
            stroke={heroOnLight ? "#A1A1AA" : "rgba(255,255,255,0.95)"}
            width={64}
            height={28}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="text-xl font-semibold tabular-nums leading-7">{formatPrice(f.price, market)}</span>
          <span
            className="text-base font-medium tabular-nums"
            style={{ color: heroOnLight ? heroPctColor : "#FFFFFF" }}
          >
            {pctLabel(f.changePct)}
          </span>
        </div>
      </Link>

      <div className="max-h-[280px] overflow-y-auto border-t border-[#E4E4E7]">
        {peersSorted.map((row) => {
          const pos = row.changePct != null && Number.isFinite(row.changePct) && row.changePct >= 0;
          return (
            <Link
              key={row.id}
              href={assetHref(market, row.ticker)}
              className="grid grid-cols-[minmax(0,4.5rem)_52px_1fr_auto] items-center gap-2 border-b border-[#F4F4F5] px-3 py-2 text-sm text-[#09090B] transition-colors last:border-b-0 hover:bg-[#F4F4F5]"
            >
              <span className="truncate font-semibold text-[#09090B]">{row.ticker}</span>
              <HeatmapSparkline values={row.sparkline5d} stroke="#A1A1AA" width={52} height={20} />
              <span className="min-w-0 truncate text-right tabular-nums text-[#09090B]">
                {formatPrice(row.price, market)}
              </span>
              <span
                className="shrink-0 text-right text-xs font-medium tabular-nums"
                style={{
                  color:
                    row.changePct == null || !Number.isFinite(row.changePct)
                      ? "#71717A"
                      : pos
                        ? HEATMAP_LABEL_POSITIVE_HEX
                        : HEATMAP_LABEL_NEGATIVE_HEX,
                }}
              >
                {pctLabel(row.changePct)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
