"use client";

import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyNode,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";
import { heatmapCellBackground, heatmapCellTextClass } from "@/lib/heatmap/heatmap-colors";
import { HeatmapHoverTooltip } from "@/components/heatmap/heatmap-hover-tooltip";
import { cn } from "@/lib/utils";

/** Figma sector title bar height */
const HEADER_H = 24;
/** Industry / sub-sector strip inside a sector (stocks only) */
const INDUSTRY_HEADER_H = 18;
const PAD = 2;

function leafIndustryGroupKey(L: HeatmapLeaf): string {
  const v = L.industry;
  if (typeof v !== "string") return "Unclassified";
  const t = v.trim();
  return t.length > 0 ? t : "Unclassified";
}

type Tile = { leaf: HeatmapLeaf; x0: number; y0: number; x1: number; y1: number };

type IndustryLayout = {
  name: string;
  headerFill: string;
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

function layoutNestedTreemap(
  leaves: HeatmapLeaf[],
  width: number,
  height: number,
  nestIndustries: boolean,
): SectorLayout[] {
  if (width <= 16 || height <= 16 || leaves.length === 0) return [];

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

  type OuterDatum = { name: string; value: number };
  const outerRoot = hierarchy<{ name: string; children?: OuterDatum[] }>({
    name: "root",
    children: sectorInputs.map((s) => ({ name: s.name, value: s.cap })),
  })
    .sum((d) => ("value" in d && typeof d.value === "number" ? d.value : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap().tile(treemapSquarify).size([width, height]).paddingOuter(PAD).paddingInner(PAD).round(true)(
    outerRoot as HierarchyNode<unknown>,
  );

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
    if (ow < 20 || oh < HEADER_H + 6) continue;

    const innerW = Math.max(1, ow - PAD * 2);
    const innerH = Math.max(1, oh - HEADER_H - PAD);
    const innerOriginX = ox0 + PAD;
    const innerOriginY = oy0 + HEADER_H + PAD;

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
      y: sec.outerY0 + HEADER_H + PAD,
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

function renderTile(
  t: Tile,
  market: HeatmapMarket,
  onTileEnter: (leaf: HeatmapLeaf, e: React.MouseEvent<HTMLAnchorElement>) => void,
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
      <rect x={t.x0} y={t.y0} width={w} height={h} fill={bg} stroke="white" strokeWidth={1} />
      {showTickerAndPct ? (
        <>
          <text
            x={cx}
            y={t.y0 + (large ? h * 0.38 : h * 0.36)}
            textAnchor="middle"
            fill="white"
            fontSize={large ? 24 : 12}
            fontWeight={600}
            className={cn("pointer-events-none", heatmapCellTextClass(t.leaf.changePct))}
            style={{ fontFamily: "inherit" }}
          >
            {t.leaf.ticker}
          </text>
          <text
            x={cx}
            y={t.y0 + (large ? h * 0.62 : h * 0.64)}
            textAnchor="middle"
            fill="white"
            fontSize={large ? 16 : 12}
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
    (leaf: HeatmapLeaf, e: React.MouseEvent<HTMLAnchorElement>) => {
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
      const h = Math.max(360, Math.floor(Math.min(820, (w * 764) / 1120)));
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

  const sectors = useMemo(
    () => layoutNestedTreemap(leaves, size.w, size.h, nestIndustries),
    [leaves, size.w, size.h, nestIndustries],
  );

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
      <svg
        width={size.w}
        height={size.h}
        className="max-w-full rounded-[4px] border border-[#E4E4E7] bg-white"
        role="img"
        aria-label="Market cap treemap colored by performance"
      >
        {sectors.map((sec) => {
          const hoverRect = hover ? highlightRectForHover(sec, hover) : null;
          return (
            <g key={sec.name}>
              <rect
                x={sec.outerX0}
                y={sec.outerY0}
                width={sec.outerX1 - sec.outerX0}
                height={HEADER_H}
                fill="#FFFFFF"
                stroke="#E4E4E7"
                strokeWidth={1}
              />
              <text
                x={sec.outerX0 + 8}
                y={sec.outerY0 + 16}
                fontSize={12}
                fontWeight={500}
                style={{ fontFamily: "inherit", fill: "#09090B" }}
                className="uppercase"
              >
                {sec.name}
              </text>
              {sec.nestIndustries
                ? sec.industries.map((ind) => (
                    <g key={`${sec.name}-${ind.name}`}>
                      <rect
                        x={ind.outerX0}
                        y={ind.outerY0}
                        width={ind.outerX1 - ind.outerX0}
                        height={INDUSTRY_HEADER_H}
                        fill={ind.headerFill}
                      />
                      {ind.outerX1 - ind.outerX0 >= 48 ? (
                        <text
                          x={ind.outerX0 + 4}
                          y={ind.outerY0 + 13}
                          fill="white"
                          fontSize={9}
                          fontWeight={600}
                          style={{ fontFamily: "inherit" }}
                          className="uppercase"
                        >
                          {(ind.name.length > 28 ? `${ind.name.slice(0, 26)}…` : ind.name).toUpperCase()}
                        </text>
                      ) : null}
                      {ind.tiles.map((t) => renderTile(t, market, onTileEnter, scheduleClearHover))}
                    </g>
                  ))
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
          );
        })}
      </svg>
    </div>
  );
}
