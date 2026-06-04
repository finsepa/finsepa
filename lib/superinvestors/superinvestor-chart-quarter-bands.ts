import type { HoldingsQuarterTradeBand } from "@/components/chart/PriceChart";
import type { SuperinvestorQuarterlyTransaction } from "@/lib/superinvestors/types";
import { usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import {
  superinvestorTransactionActivityHeadline,
  superinvestorTxTradeMarkerSide,
} from "@/lib/superinvestors/superinvestor-transaction-utils";

const sharePctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Parse `Q1 2026` → calendar quarter bounds (Jan 1 – Mar 31). */
export function calendarQuarterBoundsFromLabel(
  quarterLabel: string,
): { startYmd: string; endYmd: string } | null {
  const m = quarterLabel.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  const q = Number(m[1]);
  const year = Number(m[2]);
  if (!Number.isFinite(q) || !Number.isFinite(year) || q < 1 || q > 4) return null;
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const startYmd = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const endYmd = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startYmd, endYmd };
}

function formatBandPct(sharesChangePct: number | null, kind: SuperinvestorQuarterlyTransaction["kind"]): string | null {
  if (kind === "exit") return "-100%";
  if (sharesChangePct == null || !Number.isFinite(sharesChangePct)) return null;
  if (sharesChangePct > 0) return `+${sharePctFmt.format(sharesChangePct)}%`;
  if (sharesChangePct < 0) return `-${sharePctFmt.format(Math.abs(sharesChangePct))}%`;
  return `${sharePctFmt.format(0)}%`;
}

/** Match Activity table line 1: `Add` + `+204.0%` on separate lines in the chart bar. */
function bandLabelsFromTransaction(tx: SuperinvestorQuarterlyTransaction): {
  actionLabel: string;
  pctLabel: string | null;
} {
  const headline = superinvestorTransactionActivityHeadline(
    tx.kind,
    tx.sharesChangePct,
    tx.sharesDelta,
  );
  const pctLabel = formatBandPct(tx.sharesChangePct, tx.kind);
  if (!pctLabel) return { actionLabel: headline, pctLabel: null };

  const actionLabel = headline.slice(0, headline.length - pctLabel.length).trim();
  return { actionLabel: actionLabel || headline, pctLabel };
}

/** First/last trading bar in loaded series that falls inside [startYmd, endYmd]. */
export function quarterSpanBarTimes(
  data: readonly { time: number }[],
  startYmd: string,
  endYmd: string,
): { tStart: number; tEnd: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return null;

  let tStart: number | null = null;
  let tEnd: number | null = null;
  for (const p of data) {
    if (!Number.isFinite(p.time)) continue;
    const sessionYmd = usSessionYmdFromUnixSeconds(p.time);
    if (sessionYmd < startYmd || sessionYmd > endYmd) continue;
    if (tStart == null || p.time < tStart) tStart = p.time;
    if (tEnd == null || p.time > tEnd) tEnd = p.time;
  }
  if (tStart == null || tEnd == null) return null;
  return { tStart, tEnd };
}

/** One activity row → one chart column aligned to its Period quarter (e.g. Q1 2026 = Jan–Mar). */
export function superinvestorQuarterBandsFromTransactions(
  txs: readonly SuperinvestorQuarterlyTransaction[],
): HoldingsQuarterTradeBand[] {
  const out: HoldingsQuarterTradeBand[] = [];

  for (const tx of txs) {
    const bounds = calendarQuarterBoundsFromLabel(tx.quarterLabel);
    if (!bounds) continue;
    const reportDate = tx.reportDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) continue;

    const { actionLabel, pctLabel } = bandLabelsFromTransaction(tx);
    out.push({
      id: `${tx.quarterLabel}|${reportDate}|${tx.kind}|${tx.cusip ?? tx.companyName}`,
      quarterLabel: tx.quarterLabel,
      quarterStartYmd: bounds.startYmd,
      quarterEndYmd: bounds.endYmd,
      reportDate,
      side: superinvestorTxTradeMarkerSide(tx.kind),
      actionLabel,
      pctLabel,
    });
  }

  return out.sort((a, b) => a.quarterStartYmd.localeCompare(b.quarterStartYmd));
}

export type QuarterBandPixelLayout = {
  key: string;
  left: number;
  width: number;
  /** Distance from plot top; clears the quarter's intra-span price peak. */
  topPx: number;
  /** Compact column height (sits above local peak, not full-pane). */
  heightPx: number;
  band: HoldingsQuarterTradeBand;
};

export type QuarterBandLayoutOptions = {
  priceToY: (price: number) => number | null;
  plotHeightPx: number;
  /** Column height as fraction of plot (compact pill above peak; default ~17%). */
  bandHeightRatio?: number;
  /** Gap between quarter peak price and column bottom, as fraction of plot height (0.2–0.3). */
  gapAbovePeakRatio?: number;
  /** Min vertical gap between adjacent columns when peak prices differ (fraction of plot height). */
  minSeparationRatio?: number;
};

/** Closing price in the quarter (last session in range). */
export function quarterRepresentativePrice(
  chartPoints: readonly { time: number; value: number }[],
  startYmd: string,
  endYmd: string,
): number | null {
  const span = quarterSpanBarTimes(chartPoints, startYmd, endYmd);
  if (!span) return null;

  let price: number | null = null;
  let bestTime = -Infinity;
  for (const p of chartPoints) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue;
    if (p.time < span.tStart || p.time > span.tEnd) continue;
    if (p.time >= bestTime) {
      bestTime = p.time;
      price = p.value;
    }
  }
  return price;
}

/** Highest price in the quarter span (local peak under the column). */
export function quarterPeakPrice(
  chartPoints: readonly { time: number; value: number }[],
  startYmd: string,
  endYmd: string,
): number | null {
  const span = quarterSpanBarTimes(chartPoints, startYmd, endYmd);
  if (!span) return null;

  let peak: number | null = null;
  for (const p of chartPoints) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue;
    if (p.time < span.tStart || p.time > span.tEnd) continue;
    if (peak == null || p.value > peak) peak = p.value;
  }
  return peak;
}

export type QuarterBandPeakLayout = {
  topPx: number;
  heightPx: number;
  peakYPx: number;
};

/**
 * Label + top border anchor: sit just above the quarter's intra-span high.
 * (Column fill extends to plot bottom separately in PriceChart.)
 */
export function quarterBandLayoutFromPeak(
  peakPrice: number,
  priceToY: (price: number) => number | null,
  plotHeightPx: number,
  bandHeightRatio = 0.14,
  gapAbovePeakRatio = 0.1,
): QuarterBandPeakLayout {
  const labelBlockPx = Math.max(32, Math.round(plotHeightPx * Math.min(0.14, Math.max(0.1, bandHeightRatio))));
  const yPeak = priceToY(peakPrice);
  if (yPeak == null || !Number.isFinite(yPeak) || plotHeightPx <= 0) {
    return { topPx: 0, heightPx: labelBlockPx, peakYPx: 0 };
  }

  const clearancePx = Math.max(
    10,
    Math.round(plotHeightPx * Math.min(0.14, Math.max(0.06, gapAbovePeakRatio))),
  );
  let topPx = Math.round(yPeak - clearancePx - labelBlockPx);

  // High-price / upper-chart quarters (e.g. MCO 2025–26): lift labels so they clear the line.
  if (yPeak < plotHeightPx * 0.45) {
    topPx -= Math.round(plotHeightPx * 0.05);
  }

  topPx = Math.max(0, topPx);

  return { topPx, heightPx: labelBlockPx, peakYPx: yPeak };
}

/** @deprecated Use {@link quarterBandLayoutFromPeak}. */
export function quarterBandTopPx(
  peakPrice: number,
  priceToY: (price: number) => number | null,
  plotHeightPx: number,
  bandHeightRatio = 0.17,
  gapAbovePeakRatio = 0.1,
): number {
  return quarterBandLayoutFromPeak(
    peakPrice,
    priceToY,
    plotHeightPx,
    bandHeightRatio,
    gapAbovePeakRatio,
  ).topPx;
}

export type QuarterColumnTopInput = {
  baseTopPx: number;
  heightPx: number;
  peakYPx: number;
};

/**
 * Bar tops follow peak height left→right (larger peak Y → lower on chart → larger topPx).
 * Nudge only when local peaks are nearly aligned.
 */
export function resolveMonotonicQuarterBarTops(
  columns: readonly QuarterColumnTopInput[],
  plotHeightPx: number,
  minSeparationRatio = 0.05,
): number[] {
  const n = columns.length;
  if (n === 0) return [];

  const minSep = Math.max(8, Math.round(plotHeightPx * Math.min(0.08, Math.max(0.03, minSeparationRatio))));
  const ySimilarPx = Math.max(6, Math.round(plotHeightPx * 0.03));

  const clampFor = (i: number, v: number) => {
    const maxTop = Math.max(0, plotHeightPx - columns[i]!.heightPx - 8);
    return Math.min(maxTop, Math.max(0, Math.round(v)));
  };

  const tops = columns.map((c, i) => clampFor(i, c.baseTopPx));

  for (let i = 1; i < n; i++) {
    const prevY = columns[i - 1]!.peakYPx;
    const curY = columns[i]!.peakYPx;
    if (curY < prevY - ySimilarPx) {
      tops[i] = clampFor(i, Math.min(tops[i]!, tops[i - 1]! - minSep));
    } else if (curY > prevY + ySimilarPx) {
      tops[i] = clampFor(i, Math.max(tops[i]!, tops[i - 1]! + minSep));
    }
  }

  for (let i = n - 2; i >= 0; i--) {
    const nextY = columns[i + 1]!.peakYPx;
    const curY = columns[i]!.peakYPx;
    if (nextY < curY - ySimilarPx) {
      tops[i] = clampFor(i, Math.max(tops[i]!, tops[i + 1]! + minSep));
    } else if (nextY > curY + ySimilarPx) {
      tops[i] = clampFor(i, Math.min(tops[i]!, tops[i + 1]! - minSep));
    }
  }

  return tops;
}

function quarterSpanPixels(
  timeToX: (time: number) => number | null,
  data: readonly { time: number }[],
  startYmd: string,
  endYmd: string,
): { left: number; width: number } | null {
  const span = quarterSpanBarTimes(data, startYmd, endYmd);
  if (!span) return null;

  const x0 = timeToX(span.tStart);
  const x1 = timeToX(span.tEnd);
  if (x0 == null || x1 == null) return null;

  let rightX = x1;
  const endIdx = data.findIndex((p) => p.time === span.tEnd);
  if (endIdx >= 0 && endIdx < data.length - 1) {
    const xAfter = timeToX(data[endIdx + 1]!.time);
    if (xAfter != null) rightX = xAfter;
  }

  const left = Math.min(x0, rightX);
  const width = Math.max(10, Math.abs(rightX - x0));
  return { left, width };
}

export function computeQuarterBandPixelLayouts(
  timeToX: (time: number) => number | null,
  chartPoints: readonly { time: number; value?: number }[],
  bands: readonly HoldingsQuarterTradeBand[],
  layoutOptions?: QuarterBandLayoutOptions,
): QuarterBandPixelLayout[] {
  if (chartPoints.length === 0 || bands.length === 0) return [];

  const timeData = chartPoints.map((p) => ({ time: p.time }));
  const priceData = chartPoints.filter(
    (p): p is { time: number; value: number } => Number.isFinite(p.time) && Number.isFinite(p.value),
  );

  const byQuarter = new Map<string, HoldingsQuarterTradeBand[]>();
  for (const band of bands) {
    const qKey = `${band.quarterStartYmd}|${band.quarterEndYmd}`;
    const list = byQuarter.get(qKey) ?? [];
    list.push(band);
    byQuarter.set(qKey, list);
  }

  type QuarterColumn = {
    quarterBands: HoldingsQuarterTradeBand[];
    left: number;
    span: { left: number; width: number };
    sliceWidth: number;
    gap: number;
    baseTopPx: number;
    heightPx: number;
    peakYPx: number;
  };

  const columns: QuarterColumn[] = [];
  for (const quarterBands of byQuarter.values()) {
    const first = quarterBands[0]!;
    const span = quarterSpanPixels(timeToX, timeData, first.quarterStartYmd, first.quarterEndYmd);
    if (!span) continue;

    const count = quarterBands.length;
    const gap = count > 1 ? 2 : 0;
    const sliceWidth = Math.max(8, (span.width - gap * (count - 1)) / count);

    const peak =
      layoutOptions && priceData.length > 0
        ? quarterPeakPrice(priceData, first.quarterStartYmd, first.quarterEndYmd)
        : null;
    const bandHeightRatio = layoutOptions?.bandHeightRatio ?? 0.17;
    const gapAbovePeakRatio = layoutOptions?.gapAbovePeakRatio ?? 0.1;
    const peakLayout =
      peak != null && layoutOptions
        ? quarterBandLayoutFromPeak(
            peak,
            layoutOptions.priceToY,
            layoutOptions.plotHeightPx,
            bandHeightRatio,
            gapAbovePeakRatio,
          )
        : { topPx: 0, heightPx: Math.max(40, Math.round((layoutOptions?.plotHeightPx ?? 320) * bandHeightRatio)), peakYPx: 0 };

    columns.push({
      quarterBands,
      left: span.left,
      span,
      sliceWidth,
      gap,
      baseTopPx: peakLayout.topPx,
      heightPx: peakLayout.heightPx,
      peakYPx: peakLayout.peakYPx,
    });
  }

  columns.sort((a, b) => a.left - b.left);

  const resolvedTops =
    layoutOptions != null
      ? resolveMonotonicQuarterBarTops(
          columns.map((c) => ({
            baseTopPx: c.baseTopPx,
            heightPx: c.heightPx,
            peakYPx: c.peakYPx,
          })),
          layoutOptions.plotHeightPx,
          layoutOptions.minSeparationRatio ?? 0.05,
        )
      : columns.map((c) => c.baseTopPx);

  const out: QuarterBandPixelLayout[] = [];
  columns.forEach((col, quarterIndex) => {
    const topPx = resolvedTops[quarterIndex] ?? col.baseTopPx;

    col.quarterBands.forEach((band, index) => {
      out.push({
        key: band.id,
        left: col.span.left + index * (col.sliceWidth + col.gap),
        width: col.sliceWidth,
        topPx,
        heightPx: col.heightPx,
        band,
      });
    });
  });

  return out;
}

/** Tooltip subtitle: `Q2 2025 · Reduce -6.7%` */
export function quarterBandActivityTooltipLine(band: HoldingsQuarterTradeBand): string {
  const activity = band.pctLabel ? `${band.actionLabel} ${band.pctLabel}` : band.actionLabel;
  return `${band.quarterLabel} · ${activity}`;
}

export function findQuarterBandLayoutAtX(
  layouts: readonly QuarterBandPixelLayout[],
  x: number,
): QuarterBandPixelLayout | null {
  for (const layout of layouts) {
    if (x >= layout.left && x < layout.left + layout.width) return layout;
  }
  return null;
}

export function quarterBandLayoutsEqual(
  a: readonly QuarterBandPixelLayout[],
  b: readonly QuarterBandPixelLayout[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.key !== right.key ||
      left.left !== right.left ||
      left.width !== right.width ||
      left.topPx !== right.topPx ||
      left.heightPx !== right.heightPx
    ) {
      return false;
    }
  }
  return true;
}
