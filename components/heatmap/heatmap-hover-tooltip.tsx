"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { CompanyLogo } from "@/components/screener/company-logo";
import { HeatmapSparkline } from "@/components/heatmap/heatmap-sparkline";
import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";
import {
  HEATMAP_LABEL_NEGATIVE_HEX,
  HEATMAP_LABEL_POSITIVE_HEX,
  heatmapCellBackground,
  heatmapLegendHex,
} from "@/lib/heatmap/heatmap-colors";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
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
  onTooltipClick,
  pinned = false,
}: {
  market: HeatmapMarket;
  allLeaves: HeatmapLeaf[];
  hover: { sector: string; featured: HeatmapLeaf; anchorX: number; anchorY: number } | null;
  onTooltipEnter: () => void;
  onTooltipLeave: () => void;
  onTooltipClick?: () => void;
  pinned?: boolean;
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

  const sectorTopRows = useMemo(() => {
    if (!peerSector) return [] as HeatmapLeaf[];
    return allLeaves
      .filter((l) => l.sector === peerSector)
      .sort((a, b) => b.marketCapUsd - a.marketCapUsd)
      .slice(0, 15);
  }, [allLeaves, peerSector]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef({ x: 0, y: 0 });
  const followCursorRef = useRef(true);

  useLayoutEffect(() => {
    if (!hover) return;
    followCursorRef.current = !pinned;
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
      if (!followCursorRef.current) return;
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
  });

  if (!mounted || !hover) return null;

  const f = hover.featured;
  const p0 = clampTooltipPos(hover.anchorX, hover.anchorY);
  const title =
    market === "crypto"
      ? (peerSector ?? "").trim().toUpperCase()
      : normalizeIndustryLabel(f.industry).toUpperCase();
  const rowsToShow =
    market === "crypto"
      ? sectorTopRows
      : (peersSorted.length ? peersSorted.slice(0, 15) : sectorTopRows);

  return createPortal(
    <div
      ref={wrapRef}
      className={cn(
        dropdownMenuSurfaceClassName(),
        "fixed z-[200] w-[min(100vw-24px,300px)] overflow-hidden",
      )}
      style={{ left: p0.left, top: p0.top }}
      onMouseEnter={() => {
        followCursorRef.current = false;
        onTooltipEnter();
      }}
      onMouseLeave={() => {
        followCursorRef.current = true;
        onTooltipLeave();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTooltipClick?.();
      }}
      role="dialog"
      aria-label={`${f.ticker} details`}
    >
      <div className="border-b border-[#E4E4E7] bg-white px-4 py-3">
        <p className="truncate whitespace-nowrap text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">
          {title}
        </p>
      </div>

      <div className="max-h-[360px] overflow-y-auto bg-white">
        {rowsToShow.map((row) => {
          const pos = row.changePct != null && Number.isFinite(row.changePct) && row.changePct >= 0;
          const logoUrl =
            market === "crypto"
              ? getCryptoLogoUrl(row.ticker)
              : logoDevStockLogoUrl(row.ticker) || "";
          return (
            <Link
              key={row.id}
              href={assetHref(market, row.ticker)}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo name={row.name} logoUrl={logoUrl} symbol={row.ticker} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{row.name}</div>
                  <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">{row.ticker}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="tabular-nums text-[14px] font-medium leading-5 text-[#09090B]">
                  {formatPrice(row.price, market)}
                </span>
                <span
                  className="tabular-nums text-[14px] font-medium leading-5"
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
              </div>
            </Link>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
