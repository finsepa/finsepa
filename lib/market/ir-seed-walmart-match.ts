//
//  ir-seed-walmart-match.ts
//
//  Pure Walmart IR document matching — scored filters, no I/O.
//  PDFs on stock.walmart.com are named by Walmart FY (ends Jan 31), while EODHD
//  history rows often use calendar-ish labels ("Q2 2026" for FY27 Q2).
//

import { fiscalQuarterFromPeriodEndYmd, fiscalQuarterFromLabel } from "@/lib/market/fiscal-quarter-label";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/** Walmart fiscal year ends January 31. */
export const WMT_FY_END = "01-31";

/** Minimum score to attach a PDF bucket to a history row. */
export const WMT_MATCH_SCORE_THRESHOLD = 70;

export type WmtDocKey = { fy: number; fq: 1 | 2 | 3 | 4 };

export type WmtMatchScore = {
  key: WmtDocKey;
  score: number;
  /** Which filters contributed (debug / tests). */
  filters: string[];
};

/** Parse FY/Q from Walmart asset filenames. */
export function parseWmtDocKeyFromUrl(url: string): WmtDocKey | null {
  const file = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "").replace(/\+/g, " ");
  const m =
    file.match(/FY\s*(\d{2,4})\s*Q\s*([1-4])/i) ??
    file.match(/FY(\d{2,4})[-_\s]?Q([1-4])/i) ??
    file.match(/\((?:FY)?(\d{2,4})\s*Q([1-4])\)/i) ??
    // Older: Earnings-Presentation-2025-Q3.pdf (calendar-ish, treat as FY)
    file.match(/(?:^|[^0-9])(20\d{2})[-_\s]?Q([1-4])/i);
  if (!m) return null;
  let fy = Number(m[1]);
  const fq = Number(m[2]) as 1 | 2 | 3 | 4;
  if (!Number.isFinite(fy) || fq < 1 || fq > 4) return null;
  if (fy < 100) fy += 2000;
  return { fy, fq };
}

export function wmtKeyId(key: WmtDocKey): string {
  return `${key.fy}-q${key.fq}`;
}

/** Nominal calendar month-end for each Walmart fiscal quarter. */
export function wmtNominalPeriodEndYmd(fy: number, fq: 1 | 2 | 3 | 4): string {
  if (fq === 1) return `${fy - 1}-04-30`;
  if (fq === 2) return `${fy - 1}-07-31`;
  if (fq === 3) return `${fy - 1}-10-31`;
  return `${fy}-01-31`;
}

/**
 * Typical earnings-release window for a Walmart FY/Q (inclusive).
 * Empirically: Q1 mid-May, Q2 mid/late-Aug, Q3 mid-Nov–early Dec, Q4 mid-Feb–mid-Mar.
 */
export function wmtExpectedReportWindow(
  fy: number,
  fq: 1 | 2 | 3 | 4,
): { start: string; end: string } {
  if (fq === 1) return { start: `${fy - 1}-05-05`, end: `${fy - 1}-05-31` };
  if (fq === 2) return { start: `${fy - 1}-08-05`, end: `${fy - 1}-09-10` };
  if (fq === 3) return { start: `${fy - 1}-11-05`, end: `${fy - 1}-12-20` };
  return { start: `${fy}-02-05`, end: `${fy}-03-25` };
}

function ymdToUtcDay(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  return Number.isFinite(t) ? t / 86_400_000 : null;
}

function withinDays(a: string, b: string, slack: number): boolean {
  const da = ymdToUtcDay(a);
  const db = ymdToUtcDay(b);
  if (da == null || db == null) return false;
  return Math.abs(da - db) <= slack;
}

function asWmtKey(p: { fq: number; fy: number } | null): WmtDocKey | null {
  if (!p) return null;
  if (p.fq < 1 || p.fq > 4 || !Number.isFinite(p.fy) || p.fy < 2000 || p.fy > 2100) return null;
  return { fy: p.fy, fq: p.fq as 1 | 2 | 3 | 4 };
}

/**
 * Filter: report-date seasonality → Walmart FY/Q.
 * Strong signal when period-end is missing or calendar-labeled wrong.
 */
export function wmtKeyFromReportSeason(reportDateYmd: string | null | undefined): WmtDocKey | null {
  if (!reportDateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(reportDateYmd)) return null;
  const y = Number(reportDateYmd.slice(0, 4));
  const m = Number(reportDateYmd.slice(5, 7));
  const d = Number(reportDateYmd.slice(8, 10));
  if (![y, m, d].every(Number.isFinite)) return null;

  // Q1 — May (occasionally late Apr / early Jun)
  if (m === 5 || (m === 4 && d >= 25) || (m === 6 && d <= 15)) {
    return { fy: y + 1, fq: 1 };
  }
  // Q2 — August (occasionally late Jul / early Sep)
  if (m === 8 || (m === 7 && d >= 25) || (m === 9 && d <= 15)) {
    return { fy: y + 1, fq: 2 };
  }
  // Q3 — November / early December
  if (m === 11 || (m === 12 && d <= 20)) {
    return { fy: y + 1, fq: 3 };
  }
  // Q4 — February / March (year of FY end)
  if (m === 2 || (m === 3 && d <= 25)) {
    return { fy: y, fq: 4 };
  }
  return null;
}

/**
 * Score how well a scraped PDF key fits this history row.
 *
 * Filters (additive):
 * 1. Issuer FY from fiscal period end (+100)
 * 2. Period end within ±14d of nominal Walmart quarter end (+80)
 * 3. Report-date seasonality (+90)
 * 4. Report date inside expected release window for that FY/Q (+85)
 * 5. Calendar label Qn with year+1 (Walmart FY offset, Q1–Q3) (+55)
 * 6. Exact label year match (+25, weak — often calendar ≠ Walmart FY)
 * 7. Report date −45d ≈ period end issuer FY (+60)
 */
export function scoreWmtDocKeyForRow(row: StockEarningsHistoryRow, key: WmtDocKey): WmtMatchScore {
  const filters: string[] = [];
  let score = 0;

  const fromEnd = asWmtKey(fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, WMT_FY_END));
  if (fromEnd && fromEnd.fy === key.fy && fromEnd.fq === key.fq) {
    score += 100;
    filters.push("period_end_issuer");
  }

  if (
    row.fiscalPeriodEndYmd &&
    withinDays(row.fiscalPeriodEndYmd, wmtNominalPeriodEndYmd(key.fy, key.fq), 14)
  ) {
    score += 80;
    filters.push("period_end_slack");
  }

  const season = wmtKeyFromReportSeason(row.reportDateYmd);
  if (season && season.fy === key.fy && season.fq === key.fq) {
    score += 90;
    filters.push("report_season");
  }

  if (row.reportDateYmd) {
    const win = wmtExpectedReportWindow(key.fy, key.fq);
    if (row.reportDateYmd >= win.start && row.reportDateYmd <= win.end) {
      score += 85;
      filters.push("report_window");
    }
  }

  const fromLabel = fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (fromLabel && fromLabel.fq === key.fq) {
    if (fromLabel.fq <= 3 && fromLabel.fy + 1 === key.fy) {
      score += 55;
      filters.push("label_fy_offset");
    } else if (fromLabel.fy === key.fy) {
      score += 25;
      filters.push("label_exact");
    }
  }

  if (row.reportDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(row.reportDateYmd)) {
    const day = ymdToUtcDay(row.reportDateYmd);
    if (day != null) {
      for (const lag of [35, 45, 55]) {
        const approx = new Date((day - lag) * 86_400_000);
        const ymd = `${approx.getUTCFullYear()}-${String(approx.getUTCMonth() + 1).padStart(2, "0")}-${String(approx.getUTCDate()).padStart(2, "0")}`;
        const approxKey = asWmtKey(fiscalQuarterFromPeriodEndYmd(ymd, WMT_FY_END));
        if (approxKey && approxKey.fy === key.fy && approxKey.fq === key.fq) {
          score += 60;
          filters.push(`report_lag_${lag}`);
          break;
        }
      }
    }
  }

  return { key, score, filters };
}

/** Best PDF key for a row among scraped keys, or null below threshold. */
export function pickBestWmtDocKeyForRow(
  row: StockEarningsHistoryRow,
  availableKeys: Iterable<WmtDocKey>,
  threshold = WMT_MATCH_SCORE_THRESHOLD,
): WmtMatchScore | null {
  let best: WmtMatchScore | null = null;
  for (const key of availableKeys) {
    const scored = scoreWmtDocKeyForRow(row, key);
    if (scored.score < threshold) continue;
    if (!best || scored.score > best.score) best = scored;
  }
  return best;
}

export function isWmtPresentationUrl(url: string): boolean {
  const n = decodeURIComponent(url).toLowerCase();
  return /presentation|slides|deck/i.test(n) && !/transcript|terminology|comparable|unit.?count/i.test(n);
}

export function isWmtEarningsReleaseUrl(url: string): boolean {
  const n = decodeURIComponent(url).toLowerCase();
  return /earnings[_\-+ ]?release|press[_\-+ ]?release/i.test(n);
}
