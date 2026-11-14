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
import { ChangePctParen } from "@/components/screener/change-pct";
import { CompanyLogo } from "@/components/screener/company-logo";
import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";
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
const GROUP_GAP = 6;

/** Viewport rect of the hovered industry / sector group (the yellow outline). */
export type HeatmapHoverAnchorRect = { left: number; top: number; right: number; bottom: number };

/** Beside the group (right, else left, else inside its right edge), top-aligned — fixed per group. */
function placeBesideGroup(r: HeatmapHoverAnchorRect, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = r.right + GROUP_GAP;
  if (left + w > vw - VIEW_PAD) {
    const leftSide = r.left - GROUP_GAP - w;
    left = leftSide >= VIEW_PAD ? leftSide : r.right - GROUP_GAP - w;
  }
  return {
    left: Math.max(VIEW_PAD, Math.min(left, vw - w - VIEW_PAD)),
    top: Math.max(VIEW_PAD, Math.min(r.top, vh - h - VIEW_PAD)),
  };
}

export function HeatmapHoverTooltip({
  market,
  allLeaves,
  hover,
  onTooltipEnter,
  onTooltipLeave,
  onTooltipClick,
}: {
  market: HeatmapMarket;
  allLeaves: HeatmapLeaf[];
  hover: { sector: string; featured: HeatmapLeaf; anchorRect: HeatmapHoverAnchorRect } | null;
  onTooltipEnter: () => void;
  onTooltipLeave: () => void;
  onTooltipClick?: () => void;
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
  const anchor = hover?.anchorRect ?? null;

  // Re-place with the card's real size (rows vary) — still anchored to the group, not the cursor.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || !anchor) return;
    const p = placeBesideGroup(anchor, el.offsetWidth, el.offsetHeight);
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
  }, [anchor, mounted]);

  if (!mounted || !hover) return null;

  const f = hover.featured;
  const p0 = placeBesideGroup(hover.anchorRect, TOOLTIP_W, TOOLTIP_H);
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
      onMouseEnter={onTooltipEnter}
      onMouseLeave={onTooltipLeave}
      onClick={(e) => {
        e.stopPropagation();
        onTooltipClick?.();
      }}
      role="dialog"
      aria-label={`${f.ticker} details`}
    >
      <div className={dropdownMenuSearchHeaderClassName}>
        <p className="truncate px-2 text-[11px] font-semibold tracking-wide text-fg uppercase">
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
            return (
              <li key={row.id}>
                <Link
                  href={assetHref(market, row.ticker)}
                  className={cn(dropdownMenuRichItemClassName(), "items-center no-underline")}
                >
                  <CompanyLogo name={row.name} logoUrl={logoUrl} symbol={row.ticker} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.ticker}</div>
                    <div className="truncate text-[12px] text-fg-muted">{row.name}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right tabular-nums">
                    <span className="text-[14px] font-medium leading-5 text-fg">
                      {formatPrice(row.price, market)}
                    </span>
                    {row.changePct == null || !Number.isFinite(row.changePct) ? (
                      <span className="text-[12px] font-normal leading-4 text-fg-muted">—</span>
                    ) : (
                      <ChangePctParen
                        value={row.changePct}
                        caretSize={12}
                        className={cn(
                          "text-[12px] font-normal leading-4",
                          row.changePct > 0 ? "text-up" : row.changePct < 0 ? "text-down" : "text-fg-muted",
                        )}
                      />
                    )}
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
