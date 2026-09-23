/**
 * MMM IR seed — 12-31.
 * 3M Company calendar FY. Slides=Earnings Presentation/Slides; Filings=Press/Earnings Release PDF on CloudFront under investors.3m.com quarterly-earnings. Q1 2022–Q2 2023 filings empty — IR only hosted Financial Statement Information (not press PDF). Reject transcripts / 10-Q/10-K / supplemental financial schedules as filings. Never SEC HTML. Scope: Ng=12 / Ny=6 / Nr=0. Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MmmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MMM_IR_PAGES = [
  "https://investors.3m.com/financials/quarterly-earnings",
] as const;

export const MMM_KNOWN_QUARTER_DOCS: Readonly<Record<string, MmmQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/29838/presentation/Slides.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/29839/presentation/2Q-2022-Earnings-Slides.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/29840/presentation/3Q-2022-Earnings-Slides.pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30067/presentation/4Q-2022-Earnings-Presentation-vFINAL.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30189/presentation/1Q+2023+Earnings+Presentation_UPDATED.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30683/presentation/Q2+2023+Earnings+Presentation.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30752/presentation/Q3+2023+Earnings+Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30752/earnings_release/Q3+2023+Press+Release.pdf",
  },
  "Q4 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30800/presentation/Q4+2023+Earnings+Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30800/earnings_release/Q4+2023+Press+Release.pdf",
  },
  "Q1 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30862/presentation/Q1+2024+Earnings+Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30862/earnings_release/Q1+2024+Press+Release.pdf",
  },
  "Q2 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30879/presentation/Q2+2024+Earnings+Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30879/earnings_release/Q2+2024+Earnings+Press+Release.pdf",
  },
  "Q3 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30893/presentation/Q3+2024+-+Earnings+Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30893/earnings_release/Q3+2024+-+Earnings+Press+Release.pdf",
  },
  "Q4 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30903/presentation/Q4+2024+Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30903/earnings_release/Q4+2024+Press+Release+vF.pdf",
  },
  "Q1 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30942/presentation/Q1+2025+Earnings+Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30942/earnings_release/Q1+2025+Press+Release+VF.pdf",
  },
  "Q2 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30962/presentation/2Q+2025+Earnings+Presentation+-+vF.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30962/earnings_release/Q2+2025+-+8K+ER+EX-99.1+-+Final.pdf",
  },
  "Q3 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30969/presentation/3Q+2025+Earnings+Presentation+-+vFINAL.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30969/earnings_release/Q3+2025+-+Final+PR.pdf",
  },
  "Q4 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30980/presentation/4Q+2025+Earnings+Presentation+-+vF.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30980/earnings_release/Q4+2025+-+Final+PR.pdf",
  },
  "Q1 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30995/presentation/1Q+2026+Earnings+Presentation+-+vFinal.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/30995/earnings_release/Q1+2026+-+Earnings+Release+-+Final.pdf",
  },
  "Q2 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/31004/presentation/2Q+2026+Earnings+Presentation+-+vFinal.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_0fc3428cc515f470c7cdf5f7b048e08f/3m/db/3222/31004/earnings_release/Q2+2026+-+Earnings+Release+-+Final.pdf",
  },
};

export function isMmmRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isMmmIrPdf(href: string | null | undefined): boolean {
  if (!href || isMmmRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (host !== "d1io3yog0oux5.cloudfront.net") return false;
    if (!u.pathname.includes("/3m/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeMmmKnownQuarterDocs(): Map<string, MmmQuarterDocs> {
  return new Map(Object.entries(MMM_KNOWN_QUARTER_DOCS));
}
