"use client";

import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import { shouldHideMobileYAxisLabels } from "@/lib/chart/mobile-plot-horizontal-gutter";
import { usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import type { StockChartRange, StockChartPoint } from "@/lib/market/stock-chart-types";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Custom x-axis row below plot (overview charts — matches portfolio overview). */
export const CHART_AXIS_ROW_PX = 44;

/** Mobile: ~40% shorter gap between plot and period labels. */
export const CHART_AXIS_ROW_MOBILE_PX = 26;

export function overviewChartAxisRowPx(containerWidthPx: number): number {
  return shouldHideMobileYAxisLabels(containerWidthPx) ? CHART_AXIS_ROW_MOBILE_PX : CHART_AXIS_ROW_PX;
}

/** Plot-area backdrop — dot grid strongest in center; fades toward all edges. */
export const CHART_PLOT_DOTS_PATTERN_CLASS =
  "absolute inset-0 [background-image:radial-gradient(circle,rgba(228,228,231,0.42)_1px,transparent_1px)] [background-size:8px_8px] [mask-image:radial-gradient(ellipse_52%_72%_at_50%_50%,#000_0%,#000_38%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_52%_72%_at_50%_50%,#000_0%,#000_38%,transparent_100%)]";

export type OverviewAxisLabel = { key: string; leftPx: number; label: string };

export function overviewAxisLabelsEqual(a: readonly OverviewAxisLabel[], b: readonly OverviewAxisLabel[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.key !== y.key || x.leftPx !== y.leftPx || x.label !== y.label) return false;
  }
  return true;
}

export type OverviewBottomAxisMode =
  | "hour"
  | "weekday"
  | "weekly"
  | "monthly"
  | "triMonthly"
  | "yearly"
  | "allYears"
  | "calendar";

const ALL_AXIS_YEAR_LABEL_GAP = 8;

function chartPointsHaveSubHourBars(points: readonly StockChartPoint[]): boolean {
  const sorted = points.filter((p) => isFiniteNumber(p.time)).sort((a, b) => a.time - b.time);
  if (sorted.length < 3) return false;
  let subHourGaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.time - sorted[i - 1]!.time <= 3600) subHourGaps++;
  }
  return subHourGaps >= 2;
}

export function isTwoSlotDayOverviewRange(range: StockChartRange): boolean {
  return range === "6M" || range === "YTD" || range === "1Y";
}

export function resolveOverviewBottomAxisMode(
  range: StockChartRange,
  points: readonly StockChartPoint[],
): OverviewBottomAxisMode {
  if (range === "1D" && chartPointsHaveSubHourBars(points)) return "hour";
  if (range === "5D" && points.length > 0) return "weekday";
  if (range === "1M") return "weekly";
  if (range === "6M" || range === "YTD") return "monthly";
  if (range === "1Y") return "triMonthly";
  if (range === "5Y") return "yearly";
  if (range === "ALL") return "allYears";
  return "calendar";
}

function overviewAxisUsesRawPointTime(mode: OverviewBottomAxisMode): boolean {
  return (
    mode === "hour" ||
    mode === "weekday" ||
    mode === "weekly" ||
    mode === "monthly" ||
    mode === "triMonthly" ||
    mode === "yearly" ||
    mode === "allYears"
  );
}

export function overviewCrosshairShowsDateTime(range: StockChartRange): boolean {
  return (
    range === "1D" ||
    range === "5D" ||
    range === "1M" ||
    range === "5Y" ||
    range === "ALL" ||
    isTwoSlotDayOverviewRange(range)
  );
}

function sessionDayKeyForPoint(p: StockChartPoint, timeZone: string): string {
  const sd = p.sessionDate?.trim();
  if (sd) return sd;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(p.time * 1000));
}

function formatOverviewAxisWeekdayLabel(p: StockChartPoint, timeZone: string): string {
  const sd = p.sessionDate?.trim();
  const d =
    sd && /^\d{4}-\d{2}-\d{2}$/.test(sd) ?
      new Date(Date.parse(`${sd}T12:00:00.000Z`))
    : new Date(p.time * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(d);
}

function overviewAxisShows5DWeekdayLabel(
  index: number,
  total: number,
  data: readonly StockChartPoint[],
  timeZone: string,
): boolean {
  if (total <= 1) return true;
  if (index === 0 || index === total - 1) return true;
  return sessionDayKeyForPoint(data[index]!, timeZone) !== sessionDayKeyForPoint(data[index - 1]!, timeZone);
}

const MOBILE_5D_WEEKDAY_LABEL_MAX = 5;

/** Mobile 5D: up to five weekday names in range order (e.g. Fri Mon Tue Wed Thu). */
function collectMobile5DWeekdayLabels(data: readonly StockChartPoint[], timeZone: string): string[] {
  const labels: string[] = [];
  const seenWeekdays = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    if (i > 0 && sessionDayKeyForPoint(data[i]!, timeZone) === sessionDayKeyForPoint(data[i - 1]!, timeZone)) {
      continue;
    }
    const label = formatOverviewAxisWeekdayLabel(data[i]!, timeZone);
    if (!label || seenWeekdays.has(label)) continue;
    seenWeekdays.add(label);
    labels.push(label);
    if (labels.length >= MOBILE_5D_WEEKDAY_LABEL_MAX) break;
  }
  return labels;
}

/** Mobile 5D: spread weekday labels evenly across the plot (same as mobile 1D hour row). */
function buildMobile5DWeekdayAxisLabels(
  chart: IChartApi,
  data: readonly StockChartPoint[],
  timeZone: string,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  const weekdayLabels = collectMobile5DWeekdayLabels(data, timeZone);
  if (!weekdayLabels.length) return [];
  const plotW = plotWidthPx > 0 ? plotWidthPx : chart.paneSize(0).width;
  if (plotW <= 0) return [];
  const inner = Math.max(plotW - 2 * MOBILE_ONE_D_AXIS_EDGE_PAD_PX, 1);
  const n = weekdayLabels.length;
  const out: OverviewAxisLabel[] = [];
  for (let i = 0; i < n; i++) {
    const leftPx =
      n <= 1 ? plotW / 2 : MOBILE_ONE_D_AXIS_EDGE_PAD_PX + (inner * i) / (n - 1);
    out.push({
      key: `mobile-5d-${weekdayLabels[i]}-${i}`,
      leftPx,
      label: weekdayLabels[i]!,
    });
  }
  return out;
}

/** Mobile 6M / YTD: at most six month ticks (e.g. Dec–May), evenly spaced — no Nov/Dec overlap. */
const MOBILE_MONTHLY_LABEL_MAX = 6;

/** Mobile 1Y: five ticks (e.g. Jun Sep Nov Feb Apr), evenly spaced. */
const MOBILE_1Y_AXIS_LABEL_MAX = 5;

function collectUniqueMonthLabelsInOrder(data: readonly StockChartPoint[], timeZone: string): string[] {
  const labels: string[] = [];
  const seenMonths = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const key = sessionMonthBucketKey(data[i]!.time, timeZone);
    if (seenMonths.has(key)) continue;
    seenMonths.add(key);
    const label = formatOverviewAxisMonthlyLabel(data[i]!.time, timeZone);
    if (label) labels.push(label);
  }
  return labels;
}

function pickEvenlySpacedMonthLabels(months: readonly string[], count: number): string[] {
  const n = months.length;
  if (n <= count) return [...months];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (n - 1)) / (count - 1));
    const label = months[idx]!;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

function collectMobileMonthlyLabels(data: readonly StockChartPoint[], timeZone: string): string[] {
  const labels = collectUniqueMonthLabelsInOrder(data, timeZone);
  if (labels.length <= MOBILE_MONTHLY_LABEL_MAX) return labels;
  return labels.slice(-MOBILE_MONTHLY_LABEL_MAX);
}

function collectMobile1YAxisLabels(data: readonly StockChartPoint[], timeZone: string): string[] {
  const months = collectUniqueMonthLabelsInOrder(data, timeZone);
  if (!months.length) return [];
  let span = months;
  if (span.length > MOBILE_1Y_AXIS_LABEL_MAX + 1) {
    span = span.slice(1, -1);
  } else if (span.length > MOBILE_1Y_AXIS_LABEL_MAX) {
    span = span.slice(1);
  }
  return pickEvenlySpacedMonthLabels(span, MOBILE_1Y_AXIS_LABEL_MAX);
}

function buildMobileMonthlyAxisLabels(
  chart: IChartApi,
  data: readonly StockChartPoint[],
  timeZone: string,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  const monthLabels = collectMobileMonthlyLabels(data, timeZone);
  if (!monthLabels.length) return [];
  const plotW = plotWidthPx > 0 ? plotWidthPx : chart.paneSize(0).width;
  if (plotW <= 0) return [];
  const inner = Math.max(plotW - 2 * MOBILE_ONE_D_AXIS_EDGE_PAD_PX, 1);
  const n = monthLabels.length;
  const out: OverviewAxisLabel[] = [];
  for (let i = 0; i < n; i++) {
    const leftPx =
      n <= 1 ? plotW / 2 : MOBILE_ONE_D_AXIS_EDGE_PAD_PX + (inner * i) / (n - 1);
    out.push({
      key: `mobile-mon-${monthLabels[i]}-${i}`,
      leftPx,
      label: monthLabels[i]!,
    });
  }
  return out;
}

function buildMobile1YAxisLabels(
  chart: IChartApi,
  data: readonly StockChartPoint[],
  timeZone: string,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  const monthLabels = collectMobile1YAxisLabels(data, timeZone);
  if (!monthLabels.length) return [];
  const plotW = plotWidthPx > 0 ? plotWidthPx : chart.paneSize(0).width;
  if (plotW <= 0) return [];
  const inner = Math.max(plotW - 2 * MOBILE_ONE_D_AXIS_EDGE_PAD_PX, 1);
  const n = monthLabels.length;
  const out: OverviewAxisLabel[] = [];
  for (let i = 0; i < n; i++) {
    const leftPx =
      n <= 1 ? plotW / 2 : MOBILE_ONE_D_AXIS_EDGE_PAD_PX + (inner * i) / (n - 1);
    out.push({
      key: `mobile-1y-${monthLabels[i]}-${i}`,
      leftPx,
      label: monthLabels[i]!,
    });
  }
  return out;
}

/** Monday session-date key in the display timezone (1M idle axis — one label per week). */
function sessionWeekBucketKey(unix: number, timeZone: string): string {
  const ymd = sessionDayKeyForPoint({ time: unix, value: 0 }, timeZone);
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const anchorMs = Date.UTC(y, m - 1, d, 12, 0, 0);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(anchorMs));
  const dow =
    wd.startsWith("Mon") ? 1
    : wd.startsWith("Tue") ? 2
    : wd.startsWith("Wed") ? 3
    : wd.startsWith("Thu") ? 4
    : wd.startsWith("Fri") ? 5
    : wd.startsWith("Sat") ? 6
    : 0;
  const mondayMs = anchorMs - ((dow + 6) % 7) * 86400_000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(mondayMs));
}

function overviewAxisShows1MWeeklyLabel(
  index: number,
  total: number,
  data: readonly StockChartPoint[],
  timeZone: string,
): boolean {
  if (total <= 1) return true;
  if (index === 0 || index === total - 1) return true;
  const cur = data[index]!;
  const prev = data[index - 1]!;
  return sessionWeekBucketKey(cur.time, timeZone) !== sessionWeekBucketKey(prev.time, timeZone);
}

function formatOverviewAxisWeeklyLabel(unix: number, timeZone: string): string {
  const d = new Date(unix * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(d);
}

/** `YYYY-MM` in the chart display timezone (6M / YTD idle axis — one label per month). */
function sessionMonthBucketKey(unix: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(unix * 1000));
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function overviewAxisShowsMonthlySlotLabel(
  index: number,
  total: number,
  data: readonly StockChartPoint[],
  timeZone: string,
): boolean {
  if (total <= 1) return true;
  if (index === 0 || index === total - 1) return true;
  const cur = data[index]!;
  const prev = data[index - 1]!;
  return sessionMonthBucketKey(cur.time, timeZone) !== sessionMonthBucketKey(prev.time, timeZone);
}

function formatOverviewAxisMonthlyLabel(unix: number, timeZone: string): string {
  const d = new Date(unix * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
}

function sessionYearBucketKey(unix: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(unix * 1000));
  return parts.find((p) => p.type === "year")?.value ?? "";
}

function overviewAxisShowsYearlyLabel(
  index: number,
  total: number,
  data: readonly StockChartPoint[],
  timeZone: string,
): boolean {
  if (total <= 1) return true;
  if (index === 0 || index === total - 1) return true;
  const cur = data[index]!;
  const prev = data[index - 1]!;
  return sessionYearBucketKey(cur.time, timeZone) !== sessionYearBucketKey(prev.time, timeZone);
}

function formatOverviewAxisYearLabel(unix: number, timeZone: string): string {
  const y = sessionYearBucketKey(unix, timeZone);
  return y || "";
}

function collectUniqueYearLabelsInOrder(data: readonly StockChartPoint[], timeZone: string): string[] {
  const labels: string[] = [];
  const seenYears = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const key = sessionYearBucketKey(data[i]!.time, timeZone);
    if (seenYears.has(key)) continue;
    seenYears.add(key);
    const label = formatOverviewAxisYearLabel(data[i]!.time, timeZone);
    if (label) labels.push(label);
  }
  return labels;
}

/** Mobile 5Y: one label per calendar year, evenly spaced (no duplicate end year). */
function buildMobileYearlyAxisLabels(
  chart: IChartApi,
  data: readonly StockChartPoint[],
  timeZone: string,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  const yearLabels = collectUniqueYearLabelsInOrder(data, timeZone);
  if (!yearLabels.length) return [];
  const plotW = plotWidthPx > 0 ? plotWidthPx : chart.paneSize(0).width;
  if (plotW <= 0) return [];
  const inner = Math.max(plotW - 2 * MOBILE_ONE_D_AXIS_EDGE_PAD_PX, 1);
  const n = yearLabels.length;
  const out: OverviewAxisLabel[] = [];
  for (let i = 0; i < n; i++) {
    const leftPx =
      n <= 1 ? plotW / 2 : MOBILE_ONE_D_AXIS_EDGE_PAD_PX + (inner * i) / (n - 1);
    out.push({
      key: `mobile-5y-${yearLabels[i]}-${i}`,
      leftPx,
      label: yearLabels[i]!,
    });
  }
  return out;
}

/** 5Y / ALL: session date at 12:00 AM for crosshair copy. */
export function formatSessionDateMidnightCrosshairLabelForPoint(
  point: StockChartPoint,
  timeZone: string,
): string {
  const ymd = point.sessionDate?.trim() || sessionDayKeyForPoint(point, timeZone);
  const displayUnix = usSessionWallClockUnix(ymd, 0, 0, timeZone);
  return formatOverviewCrosshairBottomDateAtTime(displayUnix, timeZone);
}

export function usesSessionDateMidnightCrosshairLabel(
  range: StockChartRange,
  axisMode: OverviewBottomAxisMode,
): boolean {
  return range === "5Y" || range === "ALL" || axisMode === "yearly" || axisMode === "allYears";
}

/** First bar index for ALL idle axis — year labels every ~8 years. */
function buildAllAxisYearLabelIndices(data: readonly StockChartPoint[], timeZone: string): Set<number> {
  const out = new Set<number>();
  const n = data.length;
  if (!n) return out;
  out.add(0);
  if (n > 1) out.add(n - 1);

  let lastLabeledYear: number | null = null;
  for (let i = 0; i < n; i++) {
    const y = Number(sessionYearBucketKey(data[i]!.time, timeZone));
    if (!Number.isFinite(y)) continue;
    if (i > 0 && y === Number(sessionYearBucketKey(data[i - 1]!.time, timeZone))) continue;
    if (lastLabeledYear == null) {
      out.add(i);
      lastLabeledYear = y;
      continue;
    }
    if (y - lastLabeledYear >= ALL_AXIS_YEAR_LABEL_GAP) {
      out.add(i);
      lastLabeledYear = y;
    }
  }
  return out;
}

/** First bar index per month bucket for 1Y tri-month axis thinning. */
function buildTriMonthlyAxisLabelIndices(
  data: readonly StockChartPoint[],
  timeZone: string,
): Set<number> {
  const out = new Set<number>();
  const n = data.length;
  if (!n) return out;
  out.add(0);
  if (n > 1) out.add(n - 1);

  let lastLabeledOrdinal: number | null = null;
  for (let i = 0; i < n; i++) {
    const key = sessionMonthBucketKey(data[i]!.time, timeZone);
    if (i > 0 && key === sessionMonthBucketKey(data[i - 1]!.time, timeZone)) continue;
    const [y, m] = key.split("-").map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    const ord = y * 12 + m;
    if (lastLabeledOrdinal == null) {
      out.add(i);
      lastLabeledOrdinal = ord;
      continue;
    }
    if (ord - lastLabeledOrdinal >= 3) {
      out.add(i);
      lastLabeledOrdinal = ord;
    }
  }
  return out;
}

/** Hour bucket in the chart display timezone (1D idle axis — one label per hour). */
function sessionHourBucketKey(unix: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(unix * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}-${get("hour")}`;
}

/** ~`10AM` width for 1D idle axis thinning on narrow screens. */
const ONE_D_AXIS_LABEL_MIN_PX = 40;

function hourFromSessionBucketKey(key: string): number {
  const h = Number(key.split("-").pop());
  return Number.isFinite(h) ? h : 0;
}

function countDistinctSessionHours(data: readonly StockChartPoint[], timeZone: string): number {
  const keys = new Set<string>();
  for (const p of data) keys.add(sessionHourBucketKey(p.time, timeZone));
  return keys.size;
}

/** Mobile 1D idle axis: six labels (10AM–3PM) spaced across the full plot width. */
const MOBILE_ONE_D_AXIS_HOURS = [10, 11, 12, 13, 14, 15] as const;
const MOBILE_ONE_D_AXIS_EDGE_PAD_PX = 8;

function buildMobile1DHourAxisLabels(
  chart: IChartApi,
  data: readonly StockChartPoint[],
  timeZone: string,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  if (!data.length) return [];
  const sessionYmd = sessionDayKeyForPoint(data[data.length - 1]!, timeZone);
  const plotW = plotWidthPx > 0 ? plotWidthPx : chart.paneSize(0).width;
  if (plotW <= 0) return [];
  const inner = Math.max(plotW - 2 * MOBILE_ONE_D_AXIS_EDGE_PAD_PX, 1);
  const n = MOBILE_ONE_D_AXIS_HOURS.length;
  const out: OverviewAxisLabel[] = [];
  for (let i = 0; i < n; i++) {
    const hour = MOBILE_ONE_D_AXIS_HOURS[i]!;
    const unix = usSessionWallClockUnix(sessionYmd, hour, 0, timeZone);
    const leftPx =
      n <= 1 ? plotW / 2 : MOBILE_ONE_D_AXIS_EDGE_PAD_PX + (inner * i) / (n - 1);
    out.push({
      key: `mobile-1d-h${hour}`,
      leftPx,
      label: formatOverviewAxisHourTickLabel(unix, timeZone),
    });
  }
  return out;
}

/** 1h labels by default; 2h / 3h when the plot is too narrow (legend only). */
function oneDayAxisHourStep(plotWidthPx: number, distinctHours: number): 1 | 2 | 3 {
  if (plotWidthPx <= 0 || distinctHours <= 0) return 1;
  const maxComfortable = Math.max(3, Math.floor(plotWidthPx / ONE_D_AXIS_LABEL_MIN_PX));
  if (distinctHours <= maxComfortable) return 1;
  if (Math.ceil(distinctHours / 2) <= maxComfortable) return 2;
  return 3;
}

function overviewAxisShows1DHourLabel(
  index: number,
  total: number,
  data: readonly StockChartPoint[],
  timeZone: string,
  hourStep: 1 | 2 | 3,
): boolean {
  if (total <= 1) return true;
  if (index === 0 || index === total - 1) return true;
  const cur = data[index]!;
  const prev = data[index - 1]!;
  if (sessionHourBucketKey(cur.time, timeZone) === sessionHourBucketKey(prev.time, timeZone)) {
    return false;
  }
  if (hourStep === 1) return true;
  const hour = hourFromSessionBucketKey(sessionHourBucketKey(cur.time, timeZone));
  return hour % hourStep === 0;
}

/** Idle 1D axis: compact hour ticks like `10AM`, `12PM` (position = first bar in that hour). */
function formatOverviewAxisHourTickLabel(unix: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: true,
  }).formatToParts(new Date(unix * 1000));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  if (!hour) return "";
  return dayPeriod ? `${hour}${dayPeriod.toUpperCase()}` : hour;
}

function overviewAxisShowsLabel(index: number, total: number): boolean {
  if (total <= 12) return true;
  const last = total - 1;
  if (index === 0 || index === last) return true;
  if (total > 80) return index % 6 === 0;
  if (total > 40) return index % 4 === 0;
  if (total > 20) return index % 2 === 0;
  return true;
}

/** Use US session calendar day for daily EOD bars (midnight UTC would show the prior evening in ET). */
export function chartPointDisplayUnix(p: StockChartPoint, axisMode: OverviewBottomAxisMode): number {
  if (!overviewAxisUsesRawPointTime(axisMode)) {
    const sd = p.sessionDate?.trim();
    if (sd) {
      const ms = Date.parse(`${sd}T12:00:00.000Z`);
      if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    }
  }
  return p.time;
}

function formatOverviewAxisIdleLabel(
  unix: number,
  prevUnix: number | null,
  timeZone: string,
  axisMode: OverviewBottomAxisMode,
  point?: StockChartPoint,
): string {
  const d = new Date(unix * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  if (axisMode === "hour") {
    return formatOverviewAxisHourTickLabel(unix, timeZone);
  }
  if (axisMode === "weekday" && point) {
    return formatOverviewAxisWeekdayLabel(point, timeZone);
  }
  if (axisMode === "weekly") {
    return formatOverviewAxisWeeklyLabel(unix, timeZone);
  }
  if (axisMode === "monthly" || axisMode === "triMonthly") {
    return formatOverviewAxisMonthlyLabel(unix, timeZone);
  }
  if (axisMode === "yearly" || axisMode === "allYears") {
    return formatOverviewAxisYearLabel(unix, timeZone);
  }
  const prev = prevUnix != null ? new Date(prevUnix * 1000) : null;
  if (!prev || !Number.isFinite(prev.getTime()) || d.getFullYear() !== prev.getFullYear()) {
    return String(d.getFullYear());
  }
  if (d.getMonth() !== prev.getMonth() || d.getDate() === 1) {
    return new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
  }
  return String(d.getDate());
}

function formatOverviewCrosshairBottomDateAtTime(unix: number, timeZone: string): string {
  const d = new Date(unix * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(d);
  const timeStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(d);
  return `${dateStr} at ${timeStr}`;
}

export function formatOverviewCrosshairBottomDate(unix: number, timeZone: string, range: StockChartRange): string {
  if (overviewCrosshairShowsDateTime(range)) {
    return formatOverviewCrosshairBottomDateAtTime(unix, timeZone);
  }
  const d = new Date(unix * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function formatTwoSlotDayCrosshairLabelForPoint(
  point: StockChartPoint,
  points: readonly StockChartPoint[],
  timeZone: string,
  range: StockChartRange,
): string {
  const dayKey = sessionDayKeyForPoint(point, timeZone);
  const dayPts = points
    .filter((p) => isFiniteNumber(p.time) && sessionDayKeyForPoint(p, timeZone) === dayKey)
    .sort((a, b) => a.time - b.time);
  const ymd = point.sessionDate?.trim() || dayKey;
  const afternoon =
    dayPts.length >= 2 &&
    point.time === dayPts[dayPts.length - 1]!.time &&
    point.time !== dayPts[0]!.time;
  const displayUnix = afternoon
    ? usSessionWallClockUnix(ymd, 13, 30, timeZone)
    : usSessionWallClockUnix(ymd, 9, 30, timeZone);
  return formatOverviewCrosshairBottomDateAtTime(displayUnix, timeZone);
}

/** Precompute 6M / YTD / 1Y hover labels once per series (two slots per session day). */
export function buildTwoSlotDayCrosshairLabelByBarTime(
  points: readonly StockChartPoint[],
  timeZone: string,
  range: StockChartRange,
): Map<number, string> {
  const out = new Map<number, string>();
  for (const p of points) {
    if (!isFiniteNumber(p.time)) continue;
    out.set(p.time, formatTwoSlotDayCrosshairLabelForPoint(p, points, timeZone, range));
  }
  return out;
}

export function usesTwoSlotDayCrosshairLabel(range: StockChartRange, axisMode: OverviewBottomAxisMode): boolean {
  return isTwoSlotDayOverviewRange(range) || axisMode === "triMonthly";
}

export function syncOverviewPeriodAxisLabels(
  chart: IChartApi,
  points: readonly StockChartPoint[],
  timeZone: string,
  axisMode: OverviewBottomAxisMode,
  plotWidthPx = 0,
): OverviewAxisLabel[] {
  const data = points.filter((p) => isFiniteNumber(p.time));
  const n = data.length;
  if (!n) return [];
  const mobileOneDayAxis = axisMode === "hour" && shouldHideMobileYAxisLabels(plotWidthPx);
  if (mobileOneDayAxis) {
    return buildMobile1DHourAxisLabels(chart, data, timeZone, plotWidthPx);
  }
  const mobile5DWeekdayAxis = axisMode === "weekday" && shouldHideMobileYAxisLabels(plotWidthPx);
  if (mobile5DWeekdayAxis) {
    return buildMobile5DWeekdayAxisLabels(chart, data, timeZone, plotWidthPx);
  }
  const mobileMonthlyAxis = axisMode === "monthly" && shouldHideMobileYAxisLabels(plotWidthPx);
  if (mobileMonthlyAxis) {
    return buildMobileMonthlyAxisLabels(chart, data, timeZone, plotWidthPx);
  }
  const mobile1YAxis = axisMode === "triMonthly" && shouldHideMobileYAxisLabels(plotWidthPx);
  if (mobile1YAxis) {
    return buildMobile1YAxisLabels(chart, data, timeZone, plotWidthPx);
  }
  const mobileYearlyAxis = axisMode === "yearly" && shouldHideMobileYAxisLabels(plotWidthPx);
  if (mobileYearlyAxis) {
    return buildMobileYearlyAxisLabels(chart, data, timeZone, plotWidthPx);
  }
  const hourStep =
    axisMode === "hour" && !mobileOneDayAxis
      ? oneDayAxisHourStep(plotWidthPx, countDistinctSessionHours(data, timeZone))
      : 1;
  const triMonthlyLabelIndices =
    axisMode === "triMonthly" ? buildTriMonthlyAxisLabelIndices(data, timeZone) : null;
  const allYearLabelIndices =
    axisMode === "allYears" ? buildAllAxisYearLabelIndices(data, timeZone) : null;
  const out: OverviewAxisLabel[] = [];
  for (let i = 0; i < n; i++) {
    if (axisMode === "hour") {
      if (!overviewAxisShows1DHourLabel(i, n, data, timeZone, hourStep)) continue;
    } else if (axisMode === "weekday") {
      if (!overviewAxisShows5DWeekdayLabel(i, n, data, timeZone)) continue;
    } else if (axisMode === "weekly") {
      if (!overviewAxisShows1MWeeklyLabel(i, n, data, timeZone)) continue;
    } else if (axisMode === "monthly") {
      if (!overviewAxisShowsMonthlySlotLabel(i, n, data, timeZone)) continue;
    } else if (axisMode === "triMonthly") {
      if (!triMonthlyLabelIndices?.has(i)) continue;
    } else if (axisMode === "yearly") {
      if (!overviewAxisShowsYearlyLabel(i, n, data, timeZone)) continue;
    } else if (axisMode === "allYears") {
      if (!allYearLabelIndices?.has(i)) continue;
    } else if (!overviewAxisShowsLabel(i, n)) {
      continue;
    }
    const p = data[i]!;
    const x = chart.timeScale().timeToCoordinate(p.time as UTCTimestamp);
    if (x == null || !Number.isFinite(x)) continue;
    const displayUnix = chartPointDisplayUnix(p, axisMode);
    const prevDisplayUnix = i > 0 ? chartPointDisplayUnix(data[i - 1]!, axisMode) : null;
    out.push({
      key: `${p.time}-${i}`,
      leftPx: x,
      label: formatOverviewAxisIdleLabel(displayUnix, prevDisplayUnix, timeZone, axisMode, p),
    });
  }
  return out;
}

/** Precompute bottom-axis hover copy once per series (avoids Intl work on every crosshair move). */
export function buildOverviewCrosshairLabelByBarTime(
  points: readonly StockChartPoint[],
  timeZone: string,
  range: StockChartRange,
  axisMode: OverviewBottomAxisMode,
): Map<number, string> {
  if (usesTwoSlotDayCrosshairLabel(range, axisMode)) {
    return buildTwoSlotDayCrosshairLabelByBarTime(points, timeZone, range);
  }
  const out = new Map<number, string>();
  for (const p of points) {
    if (!isFiniteNumber(p.time)) continue;
    if (usesSessionDateMidnightCrosshairLabel(range, axisMode)) {
      out.set(p.time, formatSessionDateMidnightCrosshairLabelForPoint(p, timeZone));
      continue;
    }
    const labelUnix = overviewCrosshairShowsDateTime(range) ? p.time : chartPointDisplayUnix(p, axisMode);
    out.set(p.time, formatOverviewCrosshairBottomDate(labelUnix, timeZone, range));
  }
  return out;
}

export function formatOverviewCrosshairBottomLabel(
  range: StockChartRange,
  axisMode: OverviewBottomAxisMode,
  nearBar: StockChartPoint,
  allPoints: readonly StockChartPoint[],
  timeZone: string,
  twoSlotLabels: Map<number, string> | null,
  labelUnixFallback: number,
): string {
  if (usesTwoSlotDayCrosshairLabel(range, axisMode)) {
    if (twoSlotLabels) {
      const cached = twoSlotLabels.get(nearBar.time);
      if (cached) return cached;
    }
    return formatTwoSlotDayCrosshairLabelForPoint(nearBar, allPoints, timeZone, range);
  }
  if (usesSessionDateMidnightCrosshairLabel(range, axisMode)) {
    return formatSessionDateMidnightCrosshairLabelForPoint(nearBar, timeZone);
  }
  let labelUnix = labelUnixFallback;
  if (overviewCrosshairShowsDateTime(range) && isFiniteNumber(nearBar.time)) {
    labelUnix = nearBar.time;
  }
  return formatOverviewCrosshairBottomDate(labelUnix, timeZone, range);
}
