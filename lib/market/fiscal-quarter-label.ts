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

/** Calendar fiscal quarter (Jan–Mar = Q1, etc.) when no issuer FY pattern is known. */
function calendarFiscalQuarter(ymd: string): { fq: number; fy: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return { fq: Math.ceil(m / 3), fy: y };
}

/**
 * Issuer fiscal quarter from period-end + FY-end month-day (e.g. `11-30`, `05-31`).
 * Q4 ends on the FY-end month; Q3/Q2/Q1 are 3/6/9 months earlier.
 */
function issuerFiscalQuarterFromPeriodEnd(
  ymd: string,
  fyEndMonthDay: string,
): { fq: number; fy: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}-\d{2}$/.test(fyEndMonthDay)) return null;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  const fyEndMonth = Number(fyEndMonthDay.slice(0, 2));
  const fyEndDay = Number(fyEndMonthDay.slice(3, 5));
  if (![y, m, d, fyEndMonth, fyEndDay].every(Number.isFinite)) return null;
  if (fyEndMonth < 1 || fyEndMonth > 12 || fyEndDay < 1 || fyEndDay > 31) return null;

  const periodOrd = m * 31 + d;
  const fyEndOrd = fyEndMonth * 31 + fyEndDay;
  // Period on/before FY-end date in calendar year Y → FY Y; after → FY Y+1.
  const fy = periodOrd <= fyEndOrd ? y : y + 1;

  type QuarterEnd = { fq: number; year: number; month: number };
  const ends: QuarterEnd[] = [];
  for (let fq = 1; fq <= 4; fq++) {
    const monthsBeforeEnd = (4 - fq) * 3;
    let em = fyEndMonth - monthsBeforeEnd;
    let ey = fy;
    while (em <= 0) {
      em += 12;
      ey -= 1;
    }
    ends.push({ fq, year: ey, month: em });
  }

  const exact = ends.find((e) => e.month === m && Math.abs(e.year - y) <= 1 && e.year === y);
  if (exact) return { fq: exact.fq, fy };

  // Prefer same calendar month within ±1 year of the expected quarter end.
  const sameMonth = ends
    .filter((e) => e.month === m)
    .sort((a, b) => Math.abs(a.year - y) - Math.abs(b.year - y))[0];
  if (sameMonth && Math.abs(sameMonth.year - y) <= 1) {
    return { fq: sameMonth.fq, fy };
  }

  // Closest quarter-end by (year, month) distance.
  let best: QuarterEnd | null = null;
  let bestDist = Infinity;
  for (const e of ends) {
    const dist = Math.abs((e.year - y) * 12 + (e.month - m));
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  if (!best || bestDist > 2) return null;
  return { fq: best.fq, fy };
}

export function fiscalQuarterFromPeriodEndYmd(
  ymd: string | null | undefined,
  fyEndMonthDay: string | null = null,
): { fq: number; fy: number } | null {
  if (!ymd) return null;
  if (fyEndMonthDay) {
    return issuerFiscalQuarterFromPeriodEnd(ymd, fyEndMonthDay) ?? calendarFiscalQuarter(ymd);
  }
  return calendarFiscalQuarter(ymd);
}

/**
 * Distinct fiscal keys to probe for IR CDN paths — issuer FY (when known) + calendar + label.
 * Closes Adobe-style gaps where IR uses fiscal dirs but rows were labeled calendar-only.
 */
export function fiscalQuarterProbeKeysForRow(args: {
  fiscalPeriodEndYmd: string | null | undefined;
  fiscalPeriodLabel: string | null | undefined;
  fyEndMonthDay: string | null | undefined;
}): { fq: number; fy: number }[] {
  const out: { fq: number; fy: number }[] = [];
  const seen = new Set<string>();
  const add = (p: { fq: number; fy: number } | null) => {
    if (!p || p.fq < 1 || p.fq > 4) return;
    if (!Number.isFinite(p.fy) || p.fy < 2000 || p.fy > 2100) return;
    const key = `${p.fy}-q${p.fq}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  const fyEnd = args.fyEndMonthDay ?? null;
  add(fiscalQuarterFromPeriodEndYmd(args.fiscalPeriodEndYmd, fyEnd));
  // Always also probe calendar when an issuer FY end is known and differs.
  if (fyEnd) {
    add(fiscalQuarterFromPeriodEndYmd(args.fiscalPeriodEndYmd, null));
  }
  add(fiscalQuarterFromLabel(args.fiscalPeriodLabel));
  return out;
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
  const m =
    label.trim().match(/^Q([1-4])\s*(?:[·•.]|\s)\s*(\d{4})$/i) ??
    label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const fy = Number(m[2]);
  if (!Number.isFinite(fq) || fq < 1 || fq > 4) return null;
  if (!Number.isFinite(fy) || fy < 2000 || fy > 2100) return null;
  return { fq, fy };
}
