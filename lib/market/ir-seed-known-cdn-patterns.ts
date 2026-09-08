import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export type KnownCdnDocPlan = {
  slideCandidates: string[];
  filingCandidates: string[];
};

type KnownCdnDocResolver = (
  row: StockEarningsHistoryRow,
  ctx: { fyEndMonthDay: string | null },
) => KnownCdnDocPlan | null;

/**
 * Microsoft fiscal year ends in June.
 * Period ending Jul–Sep → FY(Y+1) Q1; Oct–Dec → Q2; Jan–Mar → Q3; Apr–Jun → Q4.
 */
export function microsoftFiscalFromPeriodEndYmd(
  ymd: string | null,
): { fy: number; fq: 1 | 2 | 3 | 4 } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ys, ms] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

  const fy = m >= 7 ? y + 1 : y;
  let fq: 1 | 2 | 3 | 4;
  if (m >= 7 && m <= 9) fq = 1;
  else if (m >= 10) fq = 2;
  else if (m <= 3) fq = 3;
  else fq = 4;
  return { fy, fq };
}

const MSFT_CDN = "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp";

function microsoftSlideDeckCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const yy = String(fy % 100).padStart(2, "0");
  const upper = `${MSFT_CDN}/SlidesFY${yy}Q${fq}`;
  const lower = `${MSFT_CDN}/SlidesFY${yy}q${fq}`;
  return fq === 4 ? [lower, upper] : [upper, lower];
}

function microsoftPressReleaseCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const yy = String(fy % 100).padStart(2, "0");
  const upper = `${MSFT_CDN}/PressReleaseFY${yy}Q${fq}`;
  const lower = `${MSFT_CDN}/PressReleaseFY${yy}q${fq}`;
  // Older quarters (e.g. FY22 Q3) use an underscore: PressReleaseFY22_Q3.
  const underscore = `${MSFT_CDN}/PressReleaseFY${yy}_Q${fq}`;
  // Q4 often uses lowercase q on CDN (same quirk as slides).
  return fq === 4 ? [lower, upper, underscore] : [upper, lower, underscore];
}

const RESOLVERS_BY_TICKER: Record<string, KnownCdnDocResolver> = {
  MSFT: (row) => {
    const p = microsoftFiscalFromPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return null;
    return {
      slideCandidates: microsoftSlideDeckCandidates(p.fy, p.fq),
      filingCandidates: microsoftPressReleaseCandidates(p.fy, p.fq),
    };
  },
  PLTR: (row) => {
    const m = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) return null;
    const fq = m[1]!;
    const fy = m[2]!;
    return {
      slideCandidates: [
        `https://investors.palantir.com/files/Palantir%20-%20Q${fq}%20${fy}%20Business%20Update.pdf`,
      ],
      filingCandidates: [],
    };
  },
};

/** @deprecated Prefer {@link knownCdnDocPlanForRow}. */
export type KnownCdnSlidePlan = {
  candidates: string[];
};

/** @deprecated Prefer {@link knownCdnDocPlanForRow}. */
export function knownCdnSlidePlanForRow(
  listingTicker: string,
  row: StockEarningsHistoryRow,
  ctx: { fyEndMonthDay: string | null },
): KnownCdnSlidePlan | null {
  const plan = knownCdnDocPlanForRow(listingTicker, row, ctx);
  if (!plan?.slideCandidates.length) return null;
  return { candidates: plan.slideCandidates };
}

export function knownCdnDocPlanForRow(
  listingTicker: string,
  row: StockEarningsHistoryRow,
  ctx: { fyEndMonthDay: string | null },
): KnownCdnDocPlan | null {
  const t = listingTicker.trim().toUpperCase();
  const resolver = RESOLVERS_BY_TICKER[t];
  if (!resolver) return null;
  return resolver(row, ctx);
}

export function tickersWithKnownCdnSlidePatterns(): string[] {
  return Object.keys(RESOLVERS_BY_TICKER);
}
