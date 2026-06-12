import { isAnnualForecastPoint } from "@/lib/market/earnings-annual-display";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type {
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
  StockEarningsUpcoming,
} from "@/lib/market/stock-earnings-types";

function formatEps(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowMatchesUpcoming(row: StockEarningsHistoryRow, upcoming: StockEarningsUpcoming): boolean {
  if (upcoming.reportDateYmd && row.reportDateYmd === upcoming.reportDateYmd) return true;
  if (upcoming.fiscalPeriodLabel && row.fiscalPeriodLabel === upcoming.fiscalPeriodLabel) return true;
  return false;
}

/**
 * Fill missing EPS / revenue estimates on unreleased history rows from the quarterly estimates
 * chart (and optional upcoming card), which already merges Earnings.Trend forward consensus.
 */
export function enrichUnreportedHistoryEstimates(
  history: StockEarningsHistoryRow[],
  quarterly: StockEarningsEstimatesPoint[],
  upcoming: StockEarningsUpcoming | null = null,
): StockEarningsHistoryRow[] {
  const bySortKey = new Map<string, StockEarningsEstimatesPoint>();
  const byLabel = new Map<string, StockEarningsEstimatesPoint>();
  for (const p of quarterly) {
    if (p.sortKey) bySortKey.set(p.sortKey, p);
    if (p.label) byLabel.set(p.label, p);
  }

  return history.map((row) => {
    if (row.reported) return row;

    let revenueEstimateUsd = row.revenueEstimateUsd;
    let epsEstimateRaw = row.epsEstimateRaw;

    const pt =
      (row.fiscalPeriodEndYmd && bySortKey.get(row.fiscalPeriodEndYmd)) ||
      (row.fiscalPeriodLabel && byLabel.get(row.fiscalPeriodLabel)) ||
      null;

    if (pt) {
      if (revenueEstimateUsd == null && pt.revenueEstimateUsd != null) {
        revenueEstimateUsd = pt.revenueEstimateUsd;
      }
      if (epsEstimateRaw == null && pt.epsEstimate != null) {
        epsEstimateRaw = pt.epsEstimate;
      }
    }

    if (upcoming && rowMatchesUpcoming(row, upcoming)) {
      if (revenueEstimateUsd == null && upcoming.revenueEstimateDisplay) {
        revenueEstimateUsd = parseUsdDisplayToNumber(upcoming.revenueEstimateDisplay);
      }
      if (epsEstimateRaw == null && upcoming.epsEstimateDisplay) {
        epsEstimateRaw = parseEpsDisplayToNumber(upcoming.epsEstimateDisplay);
      }
    }

    if (
      revenueEstimateUsd === row.revenueEstimateUsd &&
      epsEstimateRaw === row.epsEstimateRaw
    ) {
      return row;
    }

    return {
      ...row,
      revenueEstimateUsd,
      revenueEstimateDisplay:
        revenueEstimateUsd != null ? formatUsdCompact(revenueEstimateUsd) : row.revenueEstimateDisplay,
      epsEstimateRaw,
      epsEstimateDisplay: epsEstimateRaw != null ? formatEps(epsEstimateRaw) : row.epsEstimateDisplay,
    };
  });
}

function parseUsdDisplayToNumber(display: string): number | null {
  const s = display.trim().replace(/[$,]/g, "");
  if (!s || s === "-") return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)([KMB])?$/i);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = (m[2] ?? "").toUpperCase();
  if (suffix === "B") return base * 1e9;
  if (suffix === "M") return base * 1e6;
  if (suffix === "K") return base * 1e3;
  return base;
}

function parseEpsDisplayToNumber(display: string): number | null {
  const n = Number(display.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Map `Q3 2026` → consensus revenue from trend period-end keys. */
export function quarterlyEstimateMapsByQuarterLabel(
  quarterlyTrend: Map<string, number>,
  quarterLabelFromPeriodEndYmd: (ymd: string | null) => string | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [ymd, est] of quarterlyTrend) {
    const label = quarterLabelFromPeriodEndYmd(ymd);
    if (label) out.set(label, est);
  }
  return out;
}

function upcomingHasEstimates(upcoming: StockEarningsUpcoming): boolean {
  return Boolean(
    (upcoming.epsEstimateDisplay && upcoming.epsEstimateDisplay.trim()) ||
      (upcoming.revenueEstimateDisplay && upcoming.revenueEstimateDisplay.trim()),
  );
}

function reportedPeriodKeys(history: readonly StockEarningsHistoryRow[]): {
  labels: Set<string>;
  periodEnds: Set<string>;
} {
  const labels = new Set<string>();
  const periodEnds = new Set<string>();
  for (const row of history) {
    if (!row.reported) continue;
    if (row.fiscalPeriodLabel) labels.add(row.fiscalPeriodLabel);
    if (row.fiscalPeriodEndYmd) periodEnds.add(row.fiscalPeriodEndYmd);
  }
  return { labels, periodEnds };
}

function periodEndYmdForQuarterLabel(
  label: string | null | undefined,
  quarterly: readonly StockEarningsEstimatesPoint[],
): string | null {
  if (!label) return null;
  for (const p of quarterly) {
    if (p.label === label) return p.sortKey;
  }
  return null;
}

/**
 * When `Earnings.History` has no future report row, derive the next quarter from forward
 * consensus on the estimates chart (Earnings.Trend).
 */
export function resolveUpcomingFromEstimates(
  upcoming: StockEarningsUpcoming | null,
  history: readonly StockEarningsHistoryRow[],
  quarterly: readonly StockEarningsEstimatesPoint[],
): StockEarningsUpcoming | null {
  const { labels: reportedLabels, periodEnds: reportedEnds } = reportedPeriodKeys(history);

  let base = upcoming;
  if (base?.fiscalPeriodLabel && reportedLabels.has(base.fiscalPeriodLabel)) {
    base = null;
  } else if (base?.fiscalPeriodLabel) {
    const end = periodEndYmdForQuarterLabel(base.fiscalPeriodLabel, quarterly);
    if (end && reportedEnds.has(end)) base = null;
  }

  const forward = [...quarterly]
    .filter((p) => isAnnualForecastPoint(p))
    .filter((p) => !reportedLabels.has(p.label) && !reportedEnds.has(p.sortKey))
    .filter((p) => p.revenueEstimateUsd != null || p.epsEstimate != null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const next = forward[0] ?? null;

  if (!base && !next) return null;

  if (!base && next) {
    return {
      reportDateDisplay: null,
      reportDateYmd: null,
      timing: "unknown",
      timingShortLabel: "",
      timingPhrase: "",
      fiscalPeriodLabel: next.label,
      epsEstimateDisplay: next.epsEstimate != null ? formatEps(next.epsEstimate) : null,
      revenueEstimateDisplay:
        next.revenueEstimateUsd != null ? formatUsdCompact(next.revenueEstimateUsd) : null,
    };
  }

  if (!base) return null;

  if (upcomingHasEstimates(base) && base.fiscalPeriodLabel) return base;

  if (!next) return upcomingHasEstimates(base) ? base : null;

  return {
    ...base,
    fiscalPeriodLabel: base.fiscalPeriodLabel ?? next.label,
    epsEstimateDisplay:
      base.epsEstimateDisplay ?? (next.epsEstimate != null ? formatEps(next.epsEstimate) : null),
    revenueEstimateDisplay:
      base.revenueEstimateDisplay ??
      (next.revenueEstimateUsd != null ? formatUsdCompact(next.revenueEstimateUsd) : null),
  };
}

function historyRowFromUpcoming(
  upcoming: StockEarningsUpcoming,
  quarterly: readonly StockEarningsEstimatesPoint[],
): StockEarningsHistoryRow {
  const periodEndYmd = periodEndYmdForQuarterLabel(upcoming.fiscalPeriodLabel, quarterly);
  return {
    fiscalPeriodEndYmd: periodEndYmd,
    fiscalPeriodLabel: upcoming.fiscalPeriodLabel,
    reportDateDisplay: upcoming.reportDateDisplay,
    reportDateYmd: upcoming.reportDateYmd,
    epsEstimateDisplay: upcoming.epsEstimateDisplay,
    epsActualDisplay: null,
    surprisePct: null,
    surpriseDisplay: null,
    revenueEstimateDisplay: upcoming.revenueEstimateDisplay,
    revenueActualDisplay: null,
    reported: false,
    revenueEstimateUsd:
      upcoming.revenueEstimateDisplay != null
        ? parseUsdDisplayToNumber(upcoming.revenueEstimateDisplay)
        : null,
    revenueActualUsd: null,
    epsEstimateRaw:
      upcoming.epsEstimateDisplay != null ? parseEpsDisplayToNumber(upcoming.epsEstimateDisplay) : null,
    epsActualRaw: null,
    secSlidesUrl: null,
    secFilingsUrl: null,
  };
}

function mergeUpcomingIntoRow(
  row: StockEarningsHistoryRow,
  upcoming: StockEarningsUpcoming,
): StockEarningsHistoryRow {
  return {
    ...row,
    fiscalPeriodLabel: row.fiscalPeriodLabel ?? upcoming.fiscalPeriodLabel,
    reportDateDisplay: row.reportDateDisplay ?? upcoming.reportDateDisplay,
    reportDateYmd: row.reportDateYmd ?? upcoming.reportDateYmd,
    epsEstimateDisplay: row.epsEstimateDisplay ?? upcoming.epsEstimateDisplay,
    revenueEstimateDisplay: row.revenueEstimateDisplay ?? upcoming.revenueEstimateDisplay,
    revenueEstimateUsd:
      row.revenueEstimateUsd ??
      (upcoming.revenueEstimateDisplay
        ? parseUsdDisplayToNumber(upcoming.revenueEstimateDisplay)
        : null),
    epsEstimateRaw:
      row.epsEstimateRaw ??
      (upcoming.epsEstimateDisplay ? parseEpsDisplayToNumber(upcoming.epsEstimateDisplay) : null),
  };
}

/** Prepend (or promote) the next upcoming report so the Reports table always leads with estimates. */
export function prependUpcomingReportRow(
  rows: StockEarningsHistoryRow[],
  upcoming: StockEarningsUpcoming | null,
  quarterly: readonly StockEarningsEstimatesPoint[] = [],
): StockEarningsHistoryRow[] {
  if (!upcoming || !upcomingHasEstimates(upcoming)) return rows;

  const periodEndYmd = periodEndYmdForQuarterLabel(upcoming.fiscalPeriodLabel, quarterly);

  const matchesUpcoming = (row: StockEarningsHistoryRow): boolean => {
    if (row.reported) return false;
    if (upcoming.fiscalPeriodLabel && row.fiscalPeriodLabel === upcoming.fiscalPeriodLabel) return true;
    if (upcoming.reportDateYmd && row.reportDateYmd === upcoming.reportDateYmd) return true;
    if (periodEndYmd && row.fiscalPeriodEndYmd === periodEndYmd) return true;
    return false;
  };

  const existingIdx = rows.findIndex(matchesUpcoming);
  if (existingIdx >= 0) {
    const merged = mergeUpcomingIntoRow(rows[existingIdx]!, upcoming);
    if (existingIdx === 0) return [merged, ...rows.slice(1)];
    return [merged, ...rows.filter((_, i) => i !== existingIdx)];
  }

  if (
    upcoming.fiscalPeriodLabel &&
    rows.some((r) => r.reported && r.fiscalPeriodLabel === upcoming.fiscalPeriodLabel)
  ) {
    return rows;
  }

  return [historyRowFromUpcoming(upcoming, quarterly), ...rows];
}

/** Copy reported revenue actuals from the quarterly estimates chart when history rows lag. */
export function enrichReportedHistoryRevenueFromEstimatesChart(
  history: StockEarningsHistoryRow[],
  quarterly: readonly StockEarningsEstimatesPoint[],
): StockEarningsHistoryRow[] {
  const bySortKey = new Map<string, StockEarningsEstimatesPoint>();
  const byLabel = new Map<string, StockEarningsEstimatesPoint>();
  for (const p of quarterly) {
    if (p.sortKey) bySortKey.set(p.sortKey, p);
    if (p.label) byLabel.set(p.label, p);
  }

  return history.map((row) => {
    if (!row.reported || row.revenueActualUsd != null) return row;
    const pt =
      (row.fiscalPeriodEndYmd && bySortKey.get(row.fiscalPeriodEndYmd)) ||
      (row.fiscalPeriodLabel && byLabel.get(row.fiscalPeriodLabel)) ||
      null;
    if (pt?.revenueActualUsd == null) return row;
    return {
      ...row,
      revenueActualUsd: pt.revenueActualUsd,
      revenueActualDisplay: formatUsdCompact(pt.revenueActualUsd),
    };
  });
}

/** Enrich unreleased rows, resolve upcoming from trend if needed, and pin it to the top of Reports. */
export function buildReportsTableRows(
  history: StockEarningsHistoryRow[],
  quarterly: StockEarningsEstimatesPoint[],
  upcoming: StockEarningsUpcoming | null,
): StockEarningsHistoryRow[] {
  const resolved = resolveUpcomingFromEstimates(upcoming, history, quarterly);
  const enriched = enrichUnreportedHistoryEstimates(history, quarterly, resolved);
  return prependUpcomingReportRow(enriched, resolved, quarterly);
}
