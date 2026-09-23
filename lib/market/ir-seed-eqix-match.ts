/**
 * EQIX IR seed — 12-31.
 * Equinix calendar FY. Slides=Earnings Presentation; Filings=Press Release and Financials on IR CloudFront. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type EqixQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const EQIX_IR_PAGES = [
  "https://investor.equinix.com/",
] as const;

export const EQIX_KNOWN_QUARTER_DOCS: Readonly<Record<string, EqixQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2184/20286/file/Equinix_Q1_22_Earnings_Presentation_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/news/2022-04-27_EQUINIX_REPORTS_FIRST_QUARTER_2022_2.pdf",
  },
  "Q2 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2184/20678/file/Equinix+Q2+22+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/news/2022-07-27_Equinix_Reports_Second_Quarter_2022_968.pdf",
  },
  "Q3 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/20717/earnings_presentation/Equinix+Q3+2022+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/20717/earnings_release/Equinix+Q3+2022+Press+Release+and+Financials.pdf",
  },
  "Q4 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/20730/earnings_presentation/Equinix+Q4+22+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/20730/earnings_release/Equinix+Q4+2022+Press+Release+and+Financials.pdf",
  },
  "Q1 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/20746/earnings_presentation/Equinix+Q1+2023+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/20746/earnings_release/Equinix+Q1+2023+Press+Release+and+Financials.pdf",
  },
  "Q2 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23185/earnings_presentation/Equinix+Q2+23+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23185/earnings_release/Equinix+Q2+2023+Press+Release+and+Financials.pdf",
  },
  "Q3 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23366/earnings_presentation/Equinix+Q3+23+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23366/earnings_release/Equinix+Q3+2023+Press+Release+and+Financials.pdf",
  },
  "Q4 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23432/earnings_presentation/Equinix+Q4+23+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23432/earnings_release/Equinix+Q4+2023+Press+Release+and+Financials.pdf",
  },
  "Q1 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23489/earnings_presentation/Equinix+Q1+24+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23489/earnings_release/Equinix+Q1+2024+Press+Release+and+Financials.pdf",
  },
  "Q2 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23510/earnings_presentation/Equinix+Q2+24+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23510/earnings_release/Equinix+Q2+2024+Press+Release+and+Financials.pdf",
  },
  "Q3 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23540/earnings_presentation/Equinix+Q3+24+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23540/earnings_release/Equinix+Q3+2024+Press+Release+and+Financials.pdf",
  },
  "Q4 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23573/earnings_presentation/Equinix+Q4+24+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23573/earnings_release/Equinix+Q4+2024+Press+Release+and+Financials.pdf",
  },
  "Q1 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23603/earnings_presentation/Equinix+Q1+25+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23603/earnings_release/Equinix+Q1+2025+Press+Release+and+Financials.pdf",
  },
  "Q2 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23659/earnings_presentation/Equinix+Q2+25+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/23659/earnings_release/EQIX-06.30.25-Press+Release-v2.pdf",
  },
  "Q3 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/26994/earnings_presentation/Equinix+Q3+25+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/26994/earnings_release/Equinix+Q3+2025+Press+Release+and+Financials.pdf",
  },
  "Q4 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/27011/earnings_presentation/Equinix+Q4+25+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/27011/earnings_release/Equinix+Q4+2025+Press+Release+and+Financials+Final.pdf",
  },
  "Q1 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/27031/earnings_presentation/Equinix+Q1+26+Earnings+Presentation+Final+v2.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/27031/earnings_release/Equinix+Q1+2026+Press+Release+and+Financials.pdf",
  },
  "Q2 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/27054/earnings_presentation/Equinix+Q2+26+Earnings+Presentation+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_f9ad8b88d669de65a966b7e00da37b99/equinix/db/2183/27054/earnings_release/Equinix+Q2+2026+Earnings+Press+Release+and+Financials.pdf",
  },
};

export function isEqixRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|supplement|investor.?day|esg|datacenter.?tour/i.test(n);
}

export function isEqixIrPdf(href: string | null | undefined): boolean {
  if (!href || isEqixRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "d1io3yog0oux5.cloudfront.net" || host.endsWith(".cloudfront.net"))) return false;
    if (!(u.pathname.includes("/equinix/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeEqixKnownQuarterDocs(): Map<string, EqixQuarterDocs> {
  return new Map(Object.entries(EQIX_KNOWN_QUARTER_DOCS));
}
