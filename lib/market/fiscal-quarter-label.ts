/** Dominant fiscal year-end month-day from yearly income period ends (e.g. Nike → `05-31`). */
export function inferDominantFiscalYearEndMonthDay(periodEnds: Iterable<string>): string | null {
  const counts = new Map<string, number>();
  for (const ymd of periodEnds) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const md = ymd.slice(5);
    counts.set(md, (counts.get(md) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [md, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = md;
    }
  }
  return bestN >= 2 ? best : null;
}

/** Nike-style FY: Q1 Aug 31, Q2 Nov 30, Q3 Feb, Q4 May 31 (FY label = May year). */
function mayYearEndFiscalQuarter(ymd: string): { fq: number; fy: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const md = ymd.slice(5);
  if (md === "05-31") return { fq: 4, fy: y };
  if (md === "08-31") return { fq: 1, fy: y + 1 };
  if (md === "11-30") return { fq: 2, fy: y + 1 };
  if (md === "02-28" || md === "02-29") return { fq: 3, fy: y };
  return null;
}

/** Calendar fiscal quarter (Jan–Mar = Q1, etc.) when no issuer FY pattern is known. */
function calendarFiscalQuarter(ymd: string): { fq: number; fy: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return { fq: Math.ceil(m / 3), fy: y };
}

export function fiscalQuarterFromPeriodEndYmd(
  ymd: string | null | undefined,
  fyEndMonthDay: string | null = null,
): { fq: number; fy: number } | null {
  if (!ymd) return null;
  if (fyEndMonthDay === "05-31") {
    return mayYearEndFiscalQuarter(ymd) ?? calendarFiscalQuarter(ymd);
  }
  return calendarFiscalQuarter(ymd);
}

export function fiscalQuarterLabelFromPeriodEndYmd(
  ymd: string | null | undefined,
  fyEndMonthDay: string | null = null,
): string | null {
  if (!ymd) return null;
  const q = fiscalQuarterFromPeriodEndYmd(ymd, fyEndMonthDay);
  if (!q) return null;
  return `Q${q.fq} ${q.fy}`;
}

/** Parse table label `Q2 2026` when period-end YMD is unavailable. */
export function fiscalQuarterFromLabel(label: string | null | undefined): { fq: number; fy: number } | null {
  if (!label) return null;
  const m = label.trim().match(/^Q([1-4])\s*(?:[·•.]|\s)\s*(\d{4})$/i) ?? label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const fy = Number(m[2]);
  if (!Number.isFinite(fq) || fq < 1 || fq > 4) return null;
  if (!Number.isFinite(fy) || fy < 2000 || fy > 2100) return null;
  return { fq, fy };
}
