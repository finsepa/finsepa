import { fiscalQuarterLabelFromPeriodEndYmd } from "@/lib/market/fiscal-quarter-label";
import type {
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
  StockEarningsTabPayload,
} from "@/lib/market/stock-earnings-types";
import type { EarningsReleaseSnapshotRow } from "@/lib/notifications/earnings-notify-types";

function formatEps(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSurprisePct(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** `YYYY-MM-DD` → `Mar 12, 2026` (UTC) — keep free of server-only modules for unit tests. */
function formatReportDateYmd(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const ms = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function surpriseFromSnap(snap: EarningsReleaseSnapshotRow, epsEst: number | null, epsAct: number | null): number | null {
  if (snap.surprise_pct != null && Number.isFinite(snap.surprise_pct)) return snap.surprise_pct;
  if (epsEst == null || epsAct == null || epsEst === 0) return null;
  return ((epsAct - epsEst) / Math.abs(epsEst)) * 100;
}

function rowNeedsReleasePatch(row: StockEarningsHistoryRow, snap: EarningsReleaseSnapshotRow): boolean {
  if (snap.eps_actual == null || !Number.isFinite(snap.eps_actual)) return false;
  if (!row.reported) return true;
  if (row.epsActualRaw == null) return true;
  if (!row.reportDateYmd && snap.report_date) return true;
  if (!row.reportDateDisplay && snap.report_date) return true;
  return false;
}

function patchHistoryRowFromSnapshot(
  row: StockEarningsHistoryRow,
  snap: EarningsReleaseSnapshotRow,
): StockEarningsHistoryRow {
  const epsAct = snap.eps_actual;
  const epsEst =
    snap.eps_estimate != null && Number.isFinite(snap.eps_estimate)
      ? snap.eps_estimate
      : row.epsEstimateRaw;
  const surprise = surpriseFromSnap(snap, epsEst, epsAct);
  const reportYmd = snap.report_date ?? row.reportDateYmd;
  return {
    ...row,
    reported: true,
    fiscalPeriodEndYmd: row.fiscalPeriodEndYmd ?? snap.fiscal_period_end,
    fiscalPeriodLabel:
      row.fiscalPeriodLabel ?? fiscalQuarterLabelFromPeriodEndYmd(snap.fiscal_period_end) ?? snap.fiscal_period_end,
    reportDateYmd: reportYmd,
    reportDateDisplay: formatReportDateYmd(reportYmd) ?? row.reportDateDisplay,
    epsActualRaw: epsAct ?? row.epsActualRaw,
    epsActualDisplay: epsAct != null ? formatEps(epsAct) : row.epsActualDisplay,
    epsEstimateRaw: epsEst,
    epsEstimateDisplay: epsEst != null ? formatEps(epsEst) : row.epsEstimateDisplay,
    surprisePct: surprise,
    surpriseDisplay: formatSurprisePct(surprise),
  };
}

function historyRowFromSnapshot(snap: EarningsReleaseSnapshotRow): StockEarningsHistoryRow {
  const empty: StockEarningsHistoryRow = {
    fiscalPeriodEndYmd: snap.fiscal_period_end,
    fiscalPeriodLabel: fiscalQuarterLabelFromPeriodEndYmd(snap.fiscal_period_end) ?? snap.fiscal_period_end,
    reportDateDisplay: null,
    reportDateYmd: null,
    epsEstimateDisplay: null,
    epsActualDisplay: null,
    surprisePct: null,
    surpriseDisplay: null,
    revenueEstimateDisplay: null,
    revenueActualDisplay: null,
    reported: false,
    revenueEstimateUsd: null,
    revenueActualUsd: null,
    epsEstimateRaw: null,
    epsActualRaw: null,
    secSlidesUrl: null,
    secFilingsUrl: null,
    eightKUrl: null,
    form10Url: null,
    form10Kind: null,
    postReport1dPct: null,
  };
  return patchHistoryRowFromSnapshot(empty, snap);
}

function patchChartPointFromHistory(
  point: StockEarningsEstimatesPoint,
  hist: StockEarningsHistoryRow,
): StockEarningsEstimatesPoint {
  if (!hist.reported) return point;
  let next = point;
  if (hist.epsActualRaw != null && Number.isFinite(hist.epsActualRaw)) {
    next = { ...next, epsActual: hist.epsActualRaw, reported: true };
  }
  if (hist.epsEstimateRaw != null && Number.isFinite(hist.epsEstimateRaw) && next.epsEstimate == null) {
    next = { ...next, epsEstimate: hist.epsEstimateRaw };
  }
  return next;
}

/**
 * Pure merge: calendar release snapshots (push cron truth) onto sticky tab payload.
 * No EODHD — fills report date / EPS / surprise when fundamentals History still lags.
 */
export function applyEarningsReleaseSnapshotsToPayload(
  payload: StockEarningsTabPayload,
  snapshots: readonly EarningsReleaseSnapshotRow[],
): StockEarningsTabPayload {
  if (snapshots.length === 0) return payload;

  const byFiscal = new Map<string, EarningsReleaseSnapshotRow>();
  for (const snap of snapshots) {
    if (!snap.fiscal_period_end || snap.eps_actual == null) continue;
    byFiscal.set(snap.fiscal_period_end, snap);
  }
  if (byFiscal.size === 0) return payload;

  const history = [...payload.history];
  const seen = new Set<string>();

  for (let i = 0; i < history.length; i++) {
    const row = history[i]!;
    const fiscal = row.fiscalPeriodEndYmd;
    if (!fiscal) continue;
    const snap = byFiscal.get(fiscal);
    if (!snap) continue;
    seen.add(fiscal);
    if (rowNeedsReleasePatch(row, snap)) {
      history[i] = patchHistoryRowFromSnapshot(row, snap);
    }
  }

  for (const [fiscal, snap] of byFiscal) {
    if (seen.has(fiscal)) continue;
    history.unshift(historyRowFromSnapshot(snap));
  }

  history.sort((a, b) => {
    const ay = a.fiscalPeriodEndYmd ?? "";
    const by = b.fiscalPeriodEndYmd ?? "";
    return by.localeCompare(ay);
  });

  let estimatesChart = payload.estimatesChart;
  if (estimatesChart) {
    const histByYmd = new Map(
      history.filter((r) => r.fiscalPeriodEndYmd).map((r) => [r.fiscalPeriodEndYmd!, r] as const),
    );
    const quarterly = estimatesChart.quarterly.map((p) => {
      const hist = histByYmd.get(p.sortKey);
      return hist ? patchChartPointFromHistory(p, hist) : p;
    });
    for (const [fiscal, hist] of histByYmd) {
      if (!hist.reported || hist.epsActualRaw == null) continue;
      if (quarterly.some((p) => p.sortKey === fiscal)) continue;
      quarterly.push({
        sortKey: fiscal,
        label: hist.fiscalPeriodLabel ?? fiscal,
        revenueEstimateUsd: hist.revenueEstimateUsd,
        revenueActualUsd: hist.revenueActualUsd,
        epsEstimate: hist.epsEstimateRaw,
        epsActual: hist.epsActualRaw,
        reported: true,
      });
    }
    quarterly.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    estimatesChart = { ...estimatesChart, quarterly };
  }

  let upcoming = payload.upcoming;
  if (upcoming?.reportDateYmd || upcoming?.fiscalPeriodLabel) {
    const matched = history.find((row) => {
      if (!row.reported) return false;
      if (upcoming?.reportDateYmd && row.reportDateYmd === upcoming.reportDateYmd) return true;
      if (
        upcoming?.fiscalPeriodLabel &&
        row.fiscalPeriodLabel &&
        row.fiscalPeriodLabel === upcoming.fiscalPeriodLabel
      ) {
        return true;
      }
      return false;
    });
    if (matched) upcoming = null;
  }

  return { ...payload, history, estimatesChart, upcoming };
}
