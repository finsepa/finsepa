"use client";

import {
  hierarchy,
  treemap,
  treemapSlice,
  treemapSquarify,
  type HierarchyNode,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";
import { heatmapCellBackground, heatmapCellTextClass } from "@/lib/heatmap/heatmap-colors";
import { heatmapLeavesForTreemapLayout } from "@/lib/heatmap/heatmap-treemap-weight";
import { HeatmapHoverTooltip } from "@/components/heatmap/heatmap-hover-tooltip";
import { cn } from "@/lib/utils";

/** Outer heatmap shell — 4px inset, zinc-100 fill, 16px radius. */
const HEATMAP_SHELL_CLASS = "rounded-2xl bg-[#F4F4F5] p-1";

/** Gap between sector cards (treemap padding + visible gutter). */
const SECTOR_GAP = 4;
/** Corner radius for each sector card. */
const SECTOR_RADIUS = 16;
/** Figma sector title bar height */
const HEADER_H = 24;
/** Industry / sub-sector strip inside a sector (stocks only) */
const INDUSTRY_HEADER_H = 18;
const INDUSTRY_HEADER_RADIUS = 2;
const INDUSTRY_LABEL_H_PAD = 5;
/** ~px per glyph at 9px semibold uppercase (Inter). */
const INDUSTRY_LABEL_CHAR_PX = 5.5;
/** Inner padding inside each sector card (all sides). */
const PAD = 4;
/** Corner radius for every company tile. */
const TILE_CORNER_RADIUS = 8;
const SECTOR_BORDER = "#E4E4E7";
const SECTOR_SHADOW_FILTER_ID = "heatmap-sector-shadow";

function leafIndustryGroupKey(L: HeatmapLeaf): string {
  const v = L.industry;
  if (typeof v !== "string") return "Unclassified";
  const t = v.trim();
  return t.length > 0 ? t : "Unclassified";
}

type Tile = {
  leaf: HeatmapLeaf;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

function tileCornerRadius(w: number, h: number): number {
  return Math.min(TILE_CORNER_RADIUS, w / 2, h / 2);
}

function truncateIndustryHeaderLabel(name: string, barWidthPx: number): string {
  const innerW = barWidthPx - INDUSTRY_LABEL_H_PAD * 2;
  if (innerW < INDUSTRY_LABEL_CHAR_PX * 3) return "";
  const upper = name.trim().toUpperCase();
  const maxChars = Math.floor(innerW / INDUSTRY_LABEL_CHAR_PX);
  if (upper.length <= maxChars) return upper;
  const keep = Math.max(1, maxChars - 1);
  return `${upper.slice(0, keep)}…`;
}

type IndustryLayout = {
  name: string;
  headerFill: string;
  featuredLeaf: HeatmapLeaf;
  outerX0: number;
  outerY0: number;
  outerX1: number;
  outerY1: number;
  tiles: Tile[];
};

type SectorLayout = {
  name: string;
  outerX0: number;
  outerY0: number;
  outerX1: number;
  outerY1: number;
  nestIndustries: boolean;
  industries: IndustryLayout[];
  /** Used when `nestIndustries` is false (e.g. crypto). */
  tiles: Tile[];
};

type SectorInput = { name: string; cap: number; stocks: HeatmapLeaf[] };

function layoutStocksInRect(
  stocks: HeatmapLeaf[],
  originX: number,
  originY: number,
  innerW: number,
  innerH: number,
): Tile[] {
  if (innerW < 4 || innerH < 4 || stocks.length === 0) return [];

  type StockDatum = { name: string; value: number; leaf: HeatmapLeaf };
  const stockRoot = hierarchy<{ name: string; children?: StockDatum[] }>({
    name: "root",
    children: stocks.map((l) => ({
      name: l.ticker,
      value: l.marketCapUsd,
      leaf: l,
    })),
  })
    .sum((d) => ("value" in d && typeof d.value === "number" ? d.value : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap().tile(treemapSquarify).size([innerW, innerH]).paddingInner(1).round(true)(
    stockRoot as HierarchyNode<unknown>,
  );

  const tiles: Tile[] = [];
  for (const leafUntyped of stockRoot.leaves()) {
    const leaf = leafUntyped as unknown as HierarchyRectangularNode<StockDatum>;
    const L = leaf.data.leaf;
    tiles.push({
      leaf: L,
      x0: originX + leaf.x0,
      y0: originY + leaf.y0,
      x1: originX + leaf.x1,
      y1: originY + leaf.y1,
    });
  }
  return tiles;
}

function buildSectorLayout(
  item: SectorInput,
  rect: { x0: number; y0: number; x1: number; y1: number },
  nestIndustries: boolean,
): SectorLayout | null {
  const ox0 = rect.x0;
  const oy0 = rect.y0;
  const ox1 = rect.x1;
  const oy1 = rect.y1;
  const ow = ox1 - ox0;
  const oh = oy1 - oy0;
  if (ow < 20 || oh < HEADER_H + PAD * 2 + 6) return null;

  const innerW = Math.max(1, ow - PAD * 2);
  const innerH = Math.max(1, oh - HEADER_H - PAD * 2);
  const innerOriginX = ox0 + PAD;
  const innerOriginY = oy0 + PAD + HEADER_H;

  if (!nestIndustries) {
    const tiles = layoutStocksInRect(item.stocks, innerOriginX, innerOriginY, innerW, innerH);
    return {
      name: item.name,
      outerX0: ox0,
      outerY0: oy0,
      outerX1: ox1,
      outerY1: oy1,
      nestIndustries: false,
      industries: [],
      tiles,
    };
  }

  const byIndustry = new Map<string, HeatmapLeaf[]>();
  for (const L of item.stocks) {
    const g = leafIndustryGroupKey(L);
    const list = byIndustry.get(g) ?? [];
    list.push(L);
    byIndustry.set(g, list);
  }

  const industryInputs = [...byIndustry.entries()]
    .map(([name, stocks]) => ({
      name,
      cap: stocks.reduce((a, l) => a + l.marketCapUsd, 0),
      stocks,
    }))
    .filter((s) => s.cap > 0 && s.stocks.length > 0)
    .sort((a, b) => b.cap - a.cap);

  if (industryInputs.length === 0) {
    return {
      name: item.name,
      outerX0: ox0,
      outerY0: oy0,
      outerX1: ox1,
      outerY1: oy1,
      nestIndustries: true,
      industries: [],
      tiles: [],
    };
  }

  type IndDatum = { name: string; value: number };
  const indRoot = hierarchy<{ name: string; children?: IndDatum[] }>({
    name: item.name,
    children: industryInputs.map((i) => ({ name: i.name, value: i.cap })),
  })
    .sum((d) => ("value" in d && typeof d.value === "number" ? d.value : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap().tile(treemapSquarify).size([innerW, innerH]).paddingInner(1).round(true)(
    indRoot as HierarchyNode<unknown>,
  );

  const industries: IndustryLayout[] = [];

  for (const indNodeUntyped of indRoot.children ?? []) {
    const indNode = indNodeUntyped as unknown as HierarchyRectangularNode<{ name: string; value?: number }>;
    const indItem = industryInputs.find((x) => x.name === indNode.data.name);
    if (!indItem) continue;

    const ix0 = innerOriginX + indNode.x0;
    const iy0 = innerOriginY + indNode.y0;
    const ix1 = innerOriginX + indNode.x1;
    const iy1 = innerOriginY + indNode.y1;
    const iw = ix1 - ix0;
    const ih = iy1 - iy0;

    const indNums = indItem.stocks
      .map((s) => s.changePct)
      .filter((x): x is number => x != null && Number.isFinite(x));
    const indAvg = indNums.length ? indNums.reduce((a, b) => a + b, 0) / indNums.length : null;
    const indHeaderFill = heatmapCellBackground(indAvg);

    const featuredLeaf = indItem.stocks[0] ?? item.stocks[0];
    if (!featuredLeaf) continue;

    const stockAreaH = Math.max(1, ih - INDUSTRY_HEADER_H - 1);
    const stockAreaW = Math.max(1, iw - 2);
    const stockOriginX = ix0 + 1;
    const stockOriginY = iy0 + INDUSTRY_HEADER_H + 1;

    const tiles =
      stockAreaW >= 8 && stockAreaH >= 8
        ? layoutStocksInRect(indItem.stocks, stockOriginX, stockOriginY, stockAreaW, stockAreaH)
        : [];

    industries.push({
      name: indItem.name,
      headerFill: indHeaderFill,
      featuredLeaf,
      outerX0: ix0,
      outerY0: iy0,
      outerX1: ix1,
      outerY1: iy1,
      tiles,
    });
  }

  return {
    name: item.name,
    outerX0: ox0,
    outerY0: oy0,
    outerX1: ox1,
    outerY1: oy1,
    nestIndustries: true,
    industries,
    tiles: [],
  };
}

function layoutNestedTreemap(
  leaves: HeatmapLeaf[],
  width: number,
  height: number,
  nestIndustries: boolean,
): SectorLayout[] {
  if (width <= 16 || height <= 16 || leaves.length === 0) return [];

  const stackSectorsVertically = width < 520;

  const bySector = new Map<string, HeatmapLeaf[]>();
  for (const L of leaves) {
    const list = bySector.get(L.sector) ?? [];
    list.push(L);
    bySector.set(L.sector, list);
  }

  const sectorInputs = [...bySector.entries()]
    .map(([name, stocks]) => ({
      name,
      cap: stocks.reduce((a, l) => a + l.marketCapUsd, 0),
      stocks,
    }))
    .filter((s) => s.cap > 0 && s.stocks.length > 0)
    .sort((a, b) => b.cap - a.cap);

  if (sectorInputs.length === 0) return [];

  // Mobile: make each sector row the same height to keep visibility consistent across sectors.
  // (treemapSlice still allocates height by cap, which makes small sectors too thin.)
  if (stackSectorsVertically) {
    const out: SectorLayout[] = [];
    const n = sectorInputs.length;
    const gap = SECTOR_GAP;
    const topPad = 0;
    const bottomPad = 0;
    const availableH = Math.max(1, height - topPad - bottomPad - gap * Math.max(0, n - 1));
    const rowH = Math.max(HEADER_H + PAD * 2 + 40, Math.floor(availableH / n));
    let y = topPad;
    const ox0 = 0;
    const ox1 = width;

    for (const item of sectorInputs) {
      const oy0 = y;
      const oy1 = Math.min(height - bottomPad, y + rowH);
      y = oy1 + gap;

      const sec = buildSectorLayout(item, { x0: ox0, y0: oy0, x1: ox1, y1: oy1 }, nestIndustries);
      if (sec) out.push(sec);
    }

    return out;
  }

  type OuterDatum = { name: string; value: number };
  const outerRoot = hierarchy<{ name: string; children?: OuterDatum[] }>({
    name: "root",
    children: sectorInputs.map((s) => ({ name: s.name, value: s.cap })),
  })
    .sum((d) => ("value" in d && typeof d.value === "number" ? d.value : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingOuter(0)
    .paddingInner(SECTOR_GAP)
    .round(true)(outerRoot as HierarchyNode<unknown>);

  const out: SectorLayout[] = [];

  for (const sectorNodeUntyped of outerRoot.children ?? []) {
    const sectorNode = sectorNodeUntyped as unknown as HierarchyRectangularNode<{ name: string; value?: number }>;
    const item = sectorInputs.find((x) => x.name === sectorNode.data.name);
    if (!item) continue;

    const ox0 = sectorNode.x0;
    const oy0 = sectorNode.y0;
    const ox1 = sectorNode.x1;
    const oy1 = sectorNode.y1;
    const ow = ox1 - ox0;
    const oh = oy1 - oy0;
    if (ow < 20 || oh < HEADER_H + PAD * 2 + 6) continue;

    const innerW = Math.max(1, ow - PAD * 2);
    const innerH = Math.max(1, oh - HEADER_H - PAD * 2);
    const innerOriginX = ox0 + PAD;
    const innerOriginY = oy0 + PAD + HEADER_H;

    if (!nestIndustries) {
      const tiles = layoutStocksInRect(item.stocks, innerOriginX, innerOriginY, innerW, innerH);
      out.push({
        name: item.name,
        outerX0: ox0,
        outerY0: oy0,
        outerX1: ox1,
        outerY1: oy1,
        nestIndustries: false,
        industries: [],
        tiles,
      });
      continue;
    }

    const byIndustry = new Map<string, HeatmapLeaf[]>();
    for (const L of item.stocks) {
      const g = leafIndustryGroupKey(L);
      const list = byIndustry.get(g) ?? [];
      list.push(L);
      byIndustry.set(g, list);
    }

    const industryInputs = [...byIndustry.entries()]
      .map(([name, stocks]) => ({
        name,
        cap: stocks.reduce((a, l) => a + l.marketCapUsd, 0),
        stocks,
      }))
      .filter((s) => s.cap > 0 && s.stocks.length > 0)
      .sort((a, b) => b.cap - a.cap);

    if (industryInputs.length === 0) {
      out.push({
        name: item.name,
        outerX0: ox0,
        outerY0: oy0,
        outerX1: ox1,
        outerY1: oy1,
        nestIndustries: true,
        industries: [],
        tiles: [],
      });
      continue;
    }

    type IndDatum = { name: string; value: number };
    const indRoot = hierarchy<{ name: string; children?: IndDatum[] }>({
      name: item.name,
      children: industryInputs.map((i) => ({ name: i.name, value: i.cap })),
    })
      .sum((d) => ("value" in d && typeof d.value === "number" ? d.value : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap().tile(treemapSquarify).size([innerW, innerH]).paddingInner(1).round(true)(
      indRoot as HierarchyNode<unknown>,
    );

    const industries: IndustryLayout[] = [];

    for (const indNodeUntyped of indRoot.children ?? []) {
      const indNode = indNodeUntyped as unknown as HierarchyRectangularNode<{ name: string; value?: number }>;
      const indItem = industryInputs.find((x) => x.name === indNode.data.name);
      if (!indItem) continue;

      const ix0 = innerOriginX + indNode.x0;
      const iy0 = innerOriginY + indNode.y0;
      const ix1 = innerOriginX + indNode.x1;
      const iy1 = innerOriginY + indNode.y1;
      const iw = ix1 - ix0;
      const ih = iy1 - iy0;

      const indNums = indItem.stocks
        .map((s) => s.changePct)
        .filter((x): x is number => x != null && Number.isFinite(x));
      const indAvg = indNums.length ? indNums.reduce((a, b) => a + b, 0) / indNums.length : null;
      const indHeaderFill = heatmapCellBackground(indAvg);

      const featuredLeaf = indItem.stocks[0] ?? item.stocks[0];
      if (!featuredLeaf) continue;

      const stockAreaH = Math.max(1, ih - INDUSTRY_HEADER_H - 1);
      const stockAreaW = Math.max(1, iw - 2);
      const stockOriginX = ix0 + 1;
      const stockOriginY = iy0 + INDUSTRY_HEADER_H + 1;

      const tiles =
        stockAreaW >= 8 && stockAreaH >= 8
          ? layoutStocksInRect(indItem.stocks, stockOriginX, stockOriginY, stockAreaW, stockAreaH)
          : [];

      industries.push({
        name: indItem.name,
        headerFill: indHeaderFill,
        featuredLeaf,
        outerX0: ix0,
        outerY0: iy0,
        outerX1: ix1,
        outerY1: iy1,
        tiles,
      });
    }

    out.push({
      name: item.name,
      outerX0: ox0,
      outerY0: oy0,
      outerX1: ox1,
      outerY1: oy1,
      nestIndustries: true,
      industries,
      tiles: [],
    });
  }

  return out;
}

function highlightRectForHover(
  sec: SectorLayout,
  hover: { sector: string; featured: HeatmapLeaf },
): { x: number; y: number; width: number; height: number } | null {
  if (hover.sector !== sec.name) return null;
  if (!sec.nestIndustries) {
    return {
      x: sec.outerX0 + PAD,
      y: sec.outerY0 + PAD + HEADER_H,
      width: sec.outerX1 - sec.outerX0 - 2 * PAD,
      height: sec.outerY1 - sec.outerY0 - HEADER_H - 2 * PAD,
    };
  }
  const ind = sec.industries.find((i) => i.name === leafIndustryGroupKey(hover.featured));
  if (!ind) return null;
  return {
    x: ind.outerX0,
    y: ind.outerY0,
    width: ind.outerX1 - ind.outerX0,
    height: ind.outerY1 - ind.outerY0,
  };
}

function pctLabel(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toFixed(2);
  return n >= 0 ? `+${s}%` : `-${s}%`;
}

function assetHref(market: HeatmapMarket, ticker: string): string {
  return market === "crypto" ? `/crypto/${encodeURIComponent(ticker)}` : `/stock/${encodeURIComponent(ticker)}`;
}

function HeatmapSectorShadowFilter() {
  return (
    <filter id={SECTOR_SHADOW_FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#0A0A0A" floodOpacity="0.06" />
    </filter>
  );
}

function sectorCardRadius(sec: SectorLayout): number {
  const w = sec.outerX1 - sec.outerX0;
  const h = sec.outerY1 - sec.outerY0;
  return Math.min(SECTOR_RADIUS, w / 2, h / 2);
}

function renderSectorGroup(
  sec: SectorLayout,
  clipId: string,
  market: HeatmapMarket,
  hover: { sector: string; featured: HeatmapLeaf } | null,
  onTileEnter: (leaf: HeatmapLeaf, e: { clientX: number; clientY: number }) => void,
  scheduleClearHover: () => void,
) {
  const sw = sec.outerX1 - sec.outerX0;
  const sh = sec.outerY1 - sec.outerY0;
  const r = sectorCardRadius(sec);
  const hoverRect = hover ? highlightRectForHover(sec, hover) : null;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={sec.outerX0} y={sec.outerY0} width={sw} height={sh} rx={r} ry={r} />
        </clipPath>
        {sec.nestIndustries
          ? sec.industries.map((ind, indIndex) => {
              const barWidth = ind.outerX1 - ind.outerX0;
              return (
                <clipPath key={`${ind.name}-${indIndex}`} id={`${clipId}-ind-${indIndex}`}>
                  <rect
                    x={ind.outerX0 + INDUSTRY_LABEL_H_PAD}
                    y={ind.outerY0}
                    width={Math.max(0, barWidth - INDUSTRY_LABEL_H_PAD * 2)}
                    height={INDUSTRY_HEADER_H}
                  />
                </clipPath>
              );
            })
          : null}
      </defs>
      <rect
        x={sec.outerX0}
        y={sec.outerY0}
        width={sw}
        height={sh}
        rx={r}
        ry={r}
        fill="#FFFFFF"
        stroke={SECTOR_BORDER}
        strokeWidth={1}
        filter={`url(#${SECTOR_SHADOW_FILTER_ID})`}
      />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={sec.outerX0 + PAD}
          y={sec.outerY0 + PAD}
          width={sw - PAD * 2}
          height={HEADER_H}
          fill="#FFFFFF"
        />
        <text
          x={sec.outerX0 + PAD + (sw - PAD * 2) / 2}
          y={sec.outerY0 + PAD + 16}
          textAnchor="middle"
          fontSize={12}
          fontWeight={500}
          style={{ fontFamily: "inherit", fill: "#0F0F0F" }}
          className="uppercase"
        >
          {sec.name}
        </text>
        {sec.nestIndustries
          ? sec.industries.map((ind, indIndex) => {
              const barWidth = ind.outerX1 - ind.outerX0;
              const label = truncateIndustryHeaderLabel(ind.name, barWidth);
              return (
              <g key={`${sec.name}-${ind.name}`}>
                <rect
                  x={ind.outerX0}
                  y={ind.outerY0}
                  width={barWidth}
                  height={INDUSTRY_HEADER_H}
                  rx={INDUSTRY_HEADER_RADIUS}
                  ry={INDUSTRY_HEADER_RADIUS}
                  fill={ind.headerFill}
                  className="cursor-pointer"
                  onMouseEnter={(e) => onTileEnter(ind.featuredLeaf, e)}
                  onMouseLeave={scheduleClearHover}
                />
                {label ? (
                  <text
                    x={(ind.outerX0 + ind.outerX1) / 2}
                    y={ind.outerY0 + 13}
                    textAnchor="middle"
                    fill="white"
                    fontSize={9}
                    fontWeight={600}
                    style={{ fontFamily: "inherit" }}
                    className="uppercase"
                    clipPath={`url(#${clipId}-ind-${indIndex})`}
                    onMouseEnter={(e) => onTileEnter(ind.featuredLeaf, e)}
                    onMouseLeave={scheduleClearHover}
                  >
                    <title>{ind.name}</title>
                    {label}
                  </text>
                ) : null}
                {ind.tiles.map((t) => renderTile(t, market, onTileEnter, scheduleClearHover))}
              </g>
            );
            })
          : sec.tiles.map((t) => renderTile(t, market, onTileEnter, scheduleClearHover))}
        {hoverRect ? (
          <rect
            x={hoverRect.x}
            y={hoverRect.y}
            width={hoverRect.width}
            height={hoverRect.height}
            fill="none"
            stroke="#FACC15"
            strokeWidth={2}
            pointerEvents="none"
          />
        ) : null}
      </g>
    </g>
  );
}

function renderTile(
  t: Tile,
  market: HeatmapMarket,
  onTileEnter: (leaf: HeatmapLeaf, e: { clientX: number; clientY: number }) => void,
  scheduleClearHover: () => void,
) {
  const w = t.x1 - t.x0;
  const h = t.y1 - t.y0;
  const showTickerAndPct = w >= 40 && h >= 32;
  const showTickerOnly = !showTickerAndPct && w >= 20 && h >= 14;
  const bg = heatmapCellBackground(t.leaf.changePct);
  const href = assetHref(market, t.leaf.ticker);
  const cx = t.x0 + w / 2;
  const cy = t.y0 + h / 2;
  const large = w >= 72 && h >= 56;
  const tickerFontSize = large ? 24 : 12;
  const pctFontSize = large ? 16 : 12;
  const tileLabelGapPx = 8;
  const labelPairHeight = tickerFontSize + tileLabelGapPx + pctFontSize;
  const labelPairTop = t.y0 + (h - labelPairHeight) / 2;
  const tickerOnlyFont = Math.min(
    11,
    Math.floor(h * 0.55),
    Math.max(7, Math.floor((w - 4) / Math.max(1, t.leaf.ticker.length) / 0.62)),
  );
  return (
    <a
      key={t.leaf.id}
      href={href}
      className="cursor-pointer focus:outline-none"
      onMouseEnter={(e) => onTileEnter(t.leaf, e)}
      onMouseLeave={scheduleClearHover}
    >
      <rect
        x={t.x0}
        y={t.y0}
        width={w}
        height={h}
        rx={tileCornerRadius(w, h)}
        ry={tileCornerRadius(w, h)}
        fill={bg}
        stroke="white"
        strokeWidth={1}
      />
      {showTickerAndPct ? (
        <>
          <text
            x={cx}
            y={labelPairTop}
            textAnchor="middle"
            dominantBaseline="hanging"
            fill="white"
            fontSize={tickerFontSize}
            fontWeight={600}
            className={cn("pointer-events-none", heatmapCellTextClass(t.leaf.changePct))}
            style={{ fontFamily: "inherit" }}
          >
            {t.leaf.ticker}
          </text>
          <text
            x={cx}
            y={labelPairTop + tickerFontSize + tileLabelGapPx}
            textAnchor="middle"
            dominantBaseline="hanging"
            fill="white"
            fontSize={pctFontSize}
            fontWeight={400}
            className="pointer-events-none tabular-nums"
            style={{ fontFamily: "inherit" }}
          >
            {pctLabel(t.leaf.changePct)}
          </text>
        </>
      ) : showTickerOnly ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={tickerOnlyFont}
          fontWeight={600}
          className={cn("pointer-events-none", heatmapCellTextClass(t.leaf.changePct))}
          style={{ fontFamily: "inherit" }}
        >
          {t.leaf.ticker}
        </text>
      ) : null}
    </a>
  );
}

export function MarketHeatmap({ leaves, market }: { leaves: HeatmapLeaf[]; market: HeatmapMarket }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const nestIndustries = market === "stocks";
  const [tooltipPinned, setTooltipPinned] = useState(false);
  const [hover, setHover] = useState<{
    sector: string;
    featured: HeatmapLeaf;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const scheduleClearHover = useCallback(() => {
    if (tooltipPinned) return;
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setHover(null), 160);
  }, [clearLeaveTimer, tooltipPinned]);

  const onTileEnter = useCallback(
    (leaf: HeatmapLeaf, e: { clientX: number; clientY: number }) => {
      if (tooltipPinned) return;
      clearLeaveTimer();
      setHover({
        sector: leaf.sector,
        featured: leaf,
        anchorX: e.clientX,
        anchorY: e.clientY,
      });
    },
    [clearLeaveTimer, tooltipPinned],
  );

  const lastMeasuredRef = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let roRaf: number | null = null;

    const measure = () => {
      roRaf = null;
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const isMobile = w < 520;
      // Mobile: we stack sectors vertically (slice), so we need extra height to avoid squashing each sector row
      // and to keep more individual companies/tiles readable.
      const viewportH =
        typeof window !== "undefined" ? Math.max(1, Math.floor(window.innerHeight - r.top - 12)) : 800;
      const h = isMobile
        ? Math.max(680, Math.min(1600, viewportH))
        : Math.max(360, Math.floor(Math.min(820, (w * 764) / 1120)));
      const { w: lw, h: lh } = lastMeasuredRef.current;
      if (Math.abs(w - lw) < 2 && Math.abs(h - lh) < 2) return;
      lastMeasuredRef.current = { w, h };
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    const ro = new ResizeObserver(() => {
      if (roRaf != null) return;
      roRaf = requestAnimationFrame(measure);
    });

    measure();
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (roRaf != null) cancelAnimationFrame(roRaf);
    };
  }, []);

  const layoutLeaves = useMemo(() => heatmapLeavesForTreemapLayout(leaves, market), [leaves, market]);

  const sectors = useMemo(
    () => layoutNestedTreemap(layoutLeaves, size.w, size.h, nestIndustries),
    [layoutLeaves, size.w, size.h, nestIndustries],
  );

  const mobileSectors = useMemo(() => {
    if (size.w >= 520) return [] as SectorLayout[];
    const bySector = new Map<string, HeatmapLeaf[]>();
    for (const L of layoutLeaves) {
      const list = bySector.get(L.sector) ?? [];
      list.push(L);
      bySector.set(L.sector, list);
    }
    const sectorInputs: SectorInput[] = [...bySector.entries()]
      .map(([name, stocks]) => ({
        name,
        cap: stocks.reduce((a, l) => a + l.marketCapUsd, 0),
        stocks,
      }))
      .filter((s) => s.cap > 0 && s.stocks.length > 0)
      .sort((a, b) => b.cap - a.cap);
    return sectorInputs
      .map((s) => buildSectorLayout(s, { x0: 0, y0: 0, x1: size.w, y1: size.h }, nestIndustries))
      .filter((x): x is SectorLayout => x != null);
  }, [layoutLeaves, nestIndustries, size.h, size.w]);

  const [activeSectorIdx, setActiveSectorIdx] = useState(0);

  useEffect(() => {
    // Reset index when market/sector list changes.
    setActiveSectorIdx(0);
  }, [market, size.w]);

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <HeatmapHoverTooltip
        market={market}
        allLeaves={leaves}
        hover={hover}
        onTooltipEnter={clearLeaveTimer}
        onTooltipLeave={() => {
          if (tooltipPinned) return;
          setHover(null);
        }}
        onTooltipClick={() => setTooltipPinned((p) => !p)}
        pinned={tooltipPinned}
      />
      {size.w < 520 ? (
        <div className="w-full">
          <div className={cn(HEATMAP_SHELL_CLASS, "overflow-hidden")}>
            <div
              ref={sliderRef}
              className="flex w-full snap-x snap-mandatory overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ height: size.h }}
            onScroll={() => {
              const el = sliderRef.current;
              if (!el) return;
              const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
              setActiveSectorIdx(Math.max(0, Math.min(mobileSectors.length - 1, idx)));
            }}
          >
            {mobileSectors.map((sec, idx) => (
              <div key={sec.name} className="w-full flex-none snap-start">
                <svg
                  width={size.w}
                  height={size.h}
                  className="max-w-full"
                  role="img"
                  aria-label={`Market cap treemap: ${sec.name}`}
                >
                  <rect width={size.w} height={size.h} fill="#F4F4F5" />
                  <defs>
                    <HeatmapSectorShadowFilter />
                  </defs>
                  {renderSectorGroup(
                    sec,
                    `heatmap-sector-mobile-${idx}`,
                    market,
                    hover,
                    onTileEnter,
                    scheduleClearHover,
                  )}
                </svg>
              </div>
            ))}
            </div>
          </div>
          {mobileSectors.length > 1 ? (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {mobileSectors.map((s, idx) => (
                <button
                  key={s.name}
                  type="button"
                  aria-label={`Show ${s.name}`}
                  onClick={() => {
                    const el = sliderRef.current;
                    if (!el) return;
                    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
                    setActiveSectorIdx(idx);
                  }}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    idx === activeSectorIdx ? "bg-[#0F0F0F]" : "bg-[#D4D4D8]",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cn(HEATMAP_SHELL_CLASS, "overflow-hidden")}>
          <svg
            width={size.w}
            height={size.h}
            className="max-w-full"
            role="img"
            aria-label="Market cap treemap colored by performance"
          >
            <rect width={size.w} height={size.h} fill="#F4F4F5" />
            <defs>
              <HeatmapSectorShadowFilter />
            </defs>
            {sectors.map((sec, idx) => (
              <g key={sec.name}>
                {renderSectorGroup(
                  sec,
                  `heatmap-sector-${idx}`,
                  market,
                  hover,
                  onTileEnter,
                  scheduleClearHover,
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
