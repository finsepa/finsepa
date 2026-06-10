"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuRichItemClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { CompanyLogo } from "@/components/screener/company-logo";
import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";
import { HEATMAP_LABEL_NEGATIVE_HEX, HEATMAP_LABEL_POSITIVE_HEX } from "@/lib/heatmap/heatmap-colors";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
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
        dropdownMenuSurfaceClassName("fixed z-[200] w-[min(100vw-24px,300px)] overflow-hidden"),
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
      <div className={dropdownMenuSearchHeaderClassName}>
        <p className="truncate px-2 text-[11px] font-semibold tracking-wide text-[#A1A1AA] uppercase">
          {title}
        </p>
      </div>

      <DropdownScrollArea
        className={cn(
          dropdownMenuPanelBodyClassName,
          "max-h-[360px] overflow-y-auto overscroll-y-contain",
        )}
      >
        <ul className="flex flex-col gap-1">
          {rowsToShow.map((row) => {
            const logoUrl =
              market === "crypto"
                ? getCryptoLogoUrl(row.ticker)
                : resolveEquityLogoUrlFromTicker(row.ticker);
            const changeColor =
              row.changePct == null || !Number.isFinite(row.changePct)
                ? "#71717A"
                : row.changePct > 0
                  ? HEATMAP_LABEL_POSITIVE_HEX
                  : row.changePct < 0
                    ? HEATMAP_LABEL_NEGATIVE_HEX
                    : "#71717A";
            return (
              <li key={row.id}>
                <Link
                  href={assetHref(market, row.ticker)}
                  className={cn(dropdownMenuRichItemClassName(), "items-center no-underline")}
                >
                  <CompanyLogo name={row.name} logoUrl={logoUrl} symbol={row.ticker} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="truncate text-[12px] text-[#71717A]">{row.ticker}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-right tabular-nums">
                    <span className="text-[14px] font-medium leading-5 text-[#09090B]">
                      {formatPrice(row.price, market)}
                    </span>
                    <span className="text-[12px] font-normal leading-4" style={{ color: changeColor }}>
                      {pctLabel(row.changePct)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </DropdownScrollArea>
    </div>,
    document.body,
  );
}
