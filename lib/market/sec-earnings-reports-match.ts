/** HIGH-only 8-K (Item 2.02) and 10-Q/10-K matching. Pure — no I/O. */

export type EarningsForm10Kind = "10-Q" | "10-K";

export type SecSubmissionsFiling = {
  form: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  items: string;
};

export type SecReportsMatchPick = {
  form: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  items: string;
};

export type SecReportsMatchResult =
  | { grade: "HIGH"; pick: SecReportsMatchPick; reason: string }
  | { grade: "AMBIGUOUS" | "MISSING"; pick: null; reason: string };

function ymdToUtcDayNumber(ymd: string): number {
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : NaN;
}

export function absDeltaDays(a: string, b: string): number {
  const da = ymdToUtcDayNumber(a);
  const db = ymdToUtcDayNumber(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db);
}

export function itemsHas202(items: string | null | undefined): boolean {
  const s = String(items ?? "").trim();
  if (!s) return false;
  return /(?:^|[,;]\s*)2\.02(?:$|[,;])/.test(s) || s.split(",").map((x) => x.trim()).includes("2.02");
}

function isOriginalForm(form: string, base: string): boolean {
  return form === base;
}

function addDaysUtcYmd(ymd: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * EODHD calendar/History `report_date` is often the 10-Q/10-K *filing* date for
 * WMT/COST, or a duplicated next-quarter date — not the earnings announcement.
 */
export function isTrustedEarningsAnnouncementYmd(args: {
  announcementYmd: string | null | undefined;
  fiscalPeriodEndYmd: string | null | undefined;
  form10FilingYmd?: string | null | undefined;
  calendarByPeriodEnd?: ReadonlyMap<string, string>;
}): args is { announcementYmd: string; fiscalPeriodEndYmd: string } {
  const { announcementYmd, fiscalPeriodEndYmd, form10FilingYmd, calendarByPeriodEnd } = args;
  if (!fiscalPeriodEndYmd || !announcementYmd) return false;
  if (!isPlausibleEarningsAnnouncementYmd(fiscalPeriodEndYmd, announcementYmd)) return false;
  if (form10FilingYmd && absDeltaDays(announcementYmd, form10FilingYmd) <= 1) return false;
  if (calendarByPeriodEnd) {
    for (const [period, announced] of calendarByPeriodEnd) {
      if (announced !== announcementYmd || period === fiscalPeriodEndYmd) continue;
      if (absDeltaDays(period, announcementYmd) < absDeltaDays(fiscalPeriodEndYmd, announcementYmd)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Unique original Item 2.02 8-K filed after period end and on/before the matched
 * 10-Q/10-K filing. Used only when EODHD announcement dates are untrusted.
 * Does not widen the 3-day rule for trusted announcements.
 */
export function matchEarningsEightKHighBeforeForm10(
  filings: readonly SecSubmissionsFiling[],
  periodEndYmd: string | null | undefined,
  form10FilingYmd: string | null | undefined,
): SecReportsMatchResult {
  if (!periodEndYmd || !form10FilingYmd) {
    return { grade: "MISSING", pick: null, reason: "no period end or form-10 filing date bound" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEndYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(form10FilingYmd)) {
    return { grade: "MISSING", pick: null, reason: "invalid period end or form-10 filing date" };
  }
  const start = addDaysUtcYmd(periodEndYmd, -2) ?? periodEndYmd;
  if (form10FilingYmd < start) {
    return { grade: "MISSING", pick: null, reason: "form-10 filing is before the earnings window" };
  }

  const inWindow = filings.filter(
    (f) =>
      (f.form === "8-K" || f.form === "8-K/A") &&
      itemsHas202(f.items) &&
      f.filingDate >= start &&
      f.filingDate <= form10FilingYmd,
  );
  const originals = inWindow.filter((f) => isOriginalForm(f.form, "8-K"));
  if (originals.length === 1) {
    return {
      grade: "HIGH",
      pick: toPick(originals[0]!),
      reason: "unique Item 2.02 8-K between period end and form-10 filing",
    };
  }
  if (originals.length > 1) {
    return {
      grade: "AMBIGUOUS",
      pick: null,
      reason: `${originals.length} Item 2.02 8-Ks between period end and form-10 filing`,
    };
  }
  if (inWindow.length === 1 && inWindow[0]!.form === "8-K/A") {
    return {
      grade: "HIGH",
      pick: toPick(inWindow[0]!),
      reason: "unique Item 2.02 8-K/A between period end and form-10 filing",
    };
  }
  if (inWindow.length > 1) {
    return { grade: "AMBIGUOUS", pick: null, reason: "multiple Item 2.02 8-K/A between period end and form-10 filing" };
  }
  return { grade: "MISSING", pick: null, reason: "no Item 2.02 8-K between period end and form-10 filing" };
}

/** Trusted 3-day announcement match; otherwise unique 2.02 bounded by the form-10 filing. */
export function resolveEarningsEightKMatch(
  filings: readonly SecSubmissionsFiling[],
  args: {
    announcementYmd: string | null | undefined;
    fiscalPeriodEndYmd: string | null | undefined;
    form10FilingYmd?: string | null | undefined;
    calendarByPeriodEnd?: ReadonlyMap<string, string>;
  },
): SecReportsMatchResult {
  if (
    isTrustedEarningsAnnouncementYmd({
      announcementYmd: args.announcementYmd,
      fiscalPeriodEndYmd: args.fiscalPeriodEndYmd,
      form10FilingYmd: args.form10FilingYmd,
      calendarByPeriodEnd: args.calendarByPeriodEnd,
    })
  ) {
    return matchEarningsEightKHigh(filings, args.announcementYmd);
  }
  return matchEarningsEightKHighBeforeForm10(filings, args.fiscalPeriodEndYmd, args.form10FilingYmd);
}

function pickClosest(
  arr: readonly SecSubmissionsFiling[],
  ymd: string,
  field: "filingDate" | "reportDate",
): SecSubmissionsFiling {
  return [...arr].sort(
    (a, b) => absDeltaDays(a[field], ymd) - absDeltaDays(b[field], ymd) || a.form.localeCompare(b.form),
  )[0]!;
}

function toPick(f: SecSubmissionsFiling): SecReportsMatchPick {
  return {
    form: f.form,
    filingDate: f.filingDate,
    reportDate: f.reportDate,
    accessionNumber: f.accessionNumber,
    primaryDocument: f.primaryDocument,
    items: f.items,
  };
}

/**
 * Unique original Item 2.02 8-K within 3 calendar days of the earnings announcement.
 * 8-K/A is ignored when an original exists. Date-only / non-2.02 8-Ks are never HIGH.
 */
export function matchEarningsEightKHigh(
  filings: readonly SecSubmissionsFiling[],
  announcementYmd: string | null | undefined,
): SecReportsMatchResult {
  if (!announcementYmd || !/^\d{4}-\d{2}-\d{2}$/.test(announcementYmd)) {
    return { grade: "MISSING", pick: null, reason: "no earnings announcement date" };
  }

  const eights = filings.filter((f) => f.form === "8-K" || f.form === "8-K/A");
  const with202 = eights.filter(
    (f) => itemsHas202(f.items) && absDeltaDays(f.filingDate, announcementYmd) <= 3,
  );
  const originals = with202.filter((f) => isOriginalForm(f.form, "8-K"));

  if (originals.length === 1) {
    return {
      grade: "HIGH",
      pick: toPick(originals[0]!),
      reason: "unique Item 2.02 8-K within 3 days of announcement",
    };
  }
  if (originals.length > 1) {
    return {
      grade: "AMBIGUOUS",
      pick: null,
      reason: `${originals.length} Item 2.02 8-Ks within 3 days of announcement`,
    };
  }
  if (with202.length === 1 && with202[0]!.form === "8-K/A") {
    return {
      grade: "HIGH",
      pick: toPick(with202[0]!),
      reason: "unique Item 2.02 8-K/A within 3 days (no original 8-K)",
    };
  }
  if (with202.length > 1) {
    return { grade: "AMBIGUOUS", pick: null, reason: "multiple Item 2.02 8-K/A within 3 days" };
  }

  const sameReportDate = eights.filter(
    (f) =>
      itemsHas202(f.items) &&
      f.reportDate === announcementYmd &&
      absDeltaDays(f.filingDate, announcementYmd) <= 4,
  );
  const sameOriginals = sameReportDate.filter((f) => isOriginalForm(f.form, "8-K"));
  if (sameOriginals.length === 1) {
    return {
      grade: "HIGH",
      pick: toPick(sameOriginals[0]!),
      reason: "unique Item 2.02 8-K whose reportDate equals announcement",
    };
  }

  return { grade: "MISSING", pick: null, reason: "no unique Item 2.02 8-K within 3 days of announcement" };
}

function originalsNear(
  filings: readonly SecSubmissionsFiling[],
  forms: readonly string[],
  periodEnd: string,
  days: number,
): SecSubmissionsFiling[] {
  return filings.filter(
    (f) => forms.includes(f.form) && f.reportDate && absDeltaDays(f.reportDate, periodEnd) <= days,
  );
}

/**
 * Unique original 10-Q or 10-K by SEC reportDate vs fiscal_period_end.
 * Form kind comes from the filing (10-K vs 10-Q), not the Finsepa quarter label.
 */
export function matchEarningsForm10High(
  filings: readonly SecSubmissionsFiling[],
  periodEndYmd: string | null | undefined,
): SecReportsMatchResult {
  if (!periodEndYmd || !/^\d{4}-\d{2}-\d{2}$/.test(periodEndYmd)) {
    return { grade: "MISSING", pick: null, reason: "no fiscal_period_end" };
  }

  const tryWindow = (days: number): SecReportsMatchResult | null => {
    const k = originalsNear(filings, ["10-K"], periodEndYmd, days);
    const q = originalsNear(filings, ["10-Q"], periodEndYmd, days);
    if (k.length === 1 && q.length === 0) {
      return {
        grade: "HIGH",
        pick: toPick(k[0]!),
        reason: `unique 10-K reportDate ${k[0]!.reportDate} vs period end ${periodEndYmd} (≤${days}d)`,
      };
    }
    if (q.length === 1 && k.length === 0) {
      return {
        grade: "HIGH",
        pick: toPick(q[0]!),
        reason: `unique 10-Q reportDate ${q[0]!.reportDate} vs period end ${periodEndYmd} (≤${days}d)`,
      };
    }
    if (k.length + q.length > 1) {
      return {
        grade: "AMBIGUOUS",
        pick: null,
        reason: `${k.length} 10-K + ${q.length} 10-Q within ${days}d of period end`,
      };
    }
    if (k.length === 0 && q.length === 0) {
      const ka = originalsNear(filings, ["10-K/A"], periodEndYmd, days);
      const qa = originalsNear(filings, ["10-Q/A"], periodEndYmd, days);
      if (ka.length === 1 && qa.length === 0) {
        return {
          grade: "HIGH",
          pick: toPick(ka[0]!),
          reason: `unique 10-K/A reportDate ${ka[0]!.reportDate} (no original, ≤${days}d)`,
        };
      }
      if (qa.length === 1 && ka.length === 0) {
        return {
          grade: "HIGH",
          pick: toPick(qa[0]!),
          reason: `unique 10-Q/A reportDate ${qa[0]!.reportDate} (no original, ≤${days}d)`,
        };
      }
      if (ka.length + qa.length > 1) {
        return { grade: "AMBIGUOUS", pick: null, reason: `multiple 10-Q/A or 10-K/A within ${days}d` };
      }
    }
    return null;
  };

  const tight = tryWindow(7);
  if (tight) return tight;
  const loose = tryWindow(28);
  if (loose) return loose;
  return {
    grade: "MISSING",
    pick: null,
    reason: `no unique 10-Q/10-K with reportDate near ${periodEndYmd}`,
  };
}

export function form10KindFromForm(form: string): EarningsForm10Kind | null {
  const f = form.toUpperCase();
  if (f === "10-K" || f === "10-K/A") return "10-K";
  if (f === "10-Q" || f === "10-Q/A") return "10-Q";
  return null;
}

/**
 * Earnings 8-Ks are filed shortly after period end. A date ~90 days later is the
 * next quarter (COST Q2 2026 vault/history used Q3's May 28 date).
 */
export function isPlausibleEarningsAnnouncementYmd(
  fiscalPeriodEndYmd: string | null | undefined,
  announcementYmd: string | null | undefined,
): announcementYmd is string {
  if (!fiscalPeriodEndYmd || !announcementYmd) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fiscalPeriodEndYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(announcementYmd)) {
    return false;
  }
  const period = ymdToUtcDayNumber(fiscalPeriodEndYmd);
  const announced = ymdToUtcDayNumber(announcementYmd);
  if (!Number.isFinite(period) || !Number.isFinite(announced)) return false;
  const delta = announced - period;
  return delta >= -3 && delta <= 60;
}

/**
 * Calendar `date` is fiscal period end. 52-week issuers (COST, PEP) may store
 * month-end in Finsepa vs mid-month in EODHD — accept a unique nearby key.
 */
export function lookupCalendarAnnouncementYmd(
  byPeriodEnd: ReadonlyMap<string, string>,
  fiscalPeriodEndYmd: string | null | undefined,
): string | null {
  if (!fiscalPeriodEndYmd || !/^\d{4}-\d{2}-\d{2}$/.test(fiscalPeriodEndYmd)) return null;

  const plausibleHits: string[] = [];
  const seen = new Set<string>();
  for (const [period, announced] of byPeriodEnd) {
    if (absDeltaDays(period, fiscalPeriodEndYmd) > 16) continue;
    if (!isPlausibleEarningsAnnouncementYmd(fiscalPeriodEndYmd, announced)) continue;
    if (seen.has(announced)) continue;
    seen.add(announced);
    plausibleHits.push(announced);
  }
  if (plausibleHits.length === 1) return plausibleHits[0]!;
  const exact = byPeriodEnd.get(fiscalPeriodEndYmd);
  if (exact && isPlausibleEarningsAnnouncementYmd(fiscalPeriodEndYmd, exact) && plausibleHits.includes(exact)) {
    return exact;
  }
  return null;
}

/**
 * Announcement date for 8-K matching.
 * Prefer EODHD calendar report_date keyed by fiscal period end; else History reportDate.
 * Do not use IR vault report_date (it is sometimes the 10-Q/10-K file date).
 * Reject dates too far after period end (next-quarter contamination).
 */
export function resolveEarningsAnnouncementYmd(args: {
  fiscalPeriodEndYmd: string | null | undefined;
  historyReportDateYmd: string | null | undefined;
  calendarReportDateYmd?: string | null | undefined;
  calendarByPeriodEnd?: ReadonlyMap<string, string>;
}): string | null {
  if (args.calendarByPeriodEnd) {
    const fromCal = lookupCalendarAnnouncementYmd(args.calendarByPeriodEnd, args.fiscalPeriodEndYmd);
    if (fromCal) return fromCal;
  }
  const cal = args.calendarReportDateYmd;
  if (isPlausibleEarningsAnnouncementYmd(args.fiscalPeriodEndYmd, cal)) return cal;
  const hist = args.historyReportDateYmd;
  if (hist && hist === args.fiscalPeriodEndYmd) return null;
  if (isPlausibleEarningsAnnouncementYmd(args.fiscalPeriodEndYmd, hist)) return hist;
  return null;
}
