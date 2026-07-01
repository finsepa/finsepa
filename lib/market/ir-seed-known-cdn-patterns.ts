import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export type KnownCdnSlidePlan = {
  candidates: string[];
};

type KnownCdnSlideResolver = (
  row: StockEarningsHistoryRow,
  ctx: { fyEndMonthDay: string | null },
) => KnownCdnSlidePlan | null;

/**
 * Microsoft fiscal year ends in June.
 * Period ending Jul–Sep → FY(Y+1) Q1; Oct–Dec → Q2; Jan–Mar → Q3; Apr–Jun → Q4.
 */
function microsoftFiscalFromPeriodEndYmd(ymd: string | null): { fy: number; fq: 1 | 2 | 3 | 4 } | null {
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

const MSFT_SLIDES_CDN = "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp";

function microsoftSlideDeckCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const yy = String(fy % 100).padStart(2, "0");
  const upper = `${MSFT_SLIDES_CDN}/SlidesFY${yy}Q${fq}`;
  const lower = `${MSFT_SLIDES_CDN}/SlidesFY${yy}q${fq}`;
  return fq === 4 ? [lower, upper] : [upper, lower];
}

const RESOLVERS_BY_TICKER: Record<string, KnownCdnSlideResolver> = {
  MSFT: (row) => {
    const p = microsoftFiscalFromPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return null;
    return { candidates: microsoftSlideDeckCandidates(p.fy, p.fq) };
  },
  PLTR: (row) => {
    const m = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) return null;
    const fq = m[1]!;
    const fy = m[2]!;
    return {
      candidates: [
        `https://investors.palantir.com/files/Palantir%20-%20Q${fq}%20${fy}%20Business%20Update.pdf`,
      ],
    };
  },
};

export function knownCdnSlidePlanForRow(
  listingTicker: string,
  row: StockEarningsHistoryRow,
  ctx: { fyEndMonthDay: string | null },
): KnownCdnSlidePlan | null {
  const t = listingTicker.trim().toUpperCase();
  const resolver = RESOLVERS_BY_TICKER[t];
  if (!resolver) return null;
  return resolver(row, ctx);
}

export function tickersWithKnownCdnSlidePatterns(): string[] {
  return Object.keys(RESOLVERS_BY_TICKER);
}
