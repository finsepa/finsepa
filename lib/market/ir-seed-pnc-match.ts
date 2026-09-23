/**
 * PNC IR seed — 12-31.
 * PNC calendar FY. Slides=Earnings Slides; Filings=Earnings Release on CloudFront /pnc/. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type PncQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PNC_IR_PAGES = [
  "https://investor.pnc.com/",
  "https://investor.pnc.com/financial-information/financial-results",
] as const;

export const PNC_KNOWN_QUARTER_DOCS: Readonly<Record<string, PncQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23720/presentation/PNC_1Q22_ER_Presentation_(1).pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23720/earnings_release/c6fb930c-86a0-484a-a26c-e6b90ae646ab.pdf",
  },
  "Q2 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23721/presentation/2Q22_Earnings_Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23721/earnings_release/ce34b1eb-2ebf-4328-b5d9-35094d2c7bbb.pdf",
  },
  "Q3 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23722/presentation/da0a55da-49e1-49d3-af72-a6910a461722.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23722/earnings_release/7222ab20-177f-4012-ac87-3afd4c2cd518.pdf",
  },
  "Q4 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23723/presentation/PNC_4Q22_ER_Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/news/2023-01-18_PNC_REPORTS_FULL_YEAR_2022_NET_INCOME_OF_6_1_589.pdf",
  },
  "Q1 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23724/presentation/PNC_1Q23_ER_Presentation.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23724/earnings_release/PNC_1Q23_ER_Press_Release.pdf",
  },
  "Q2 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23725/presentation/2Q23+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23725/earnings_release/2Q23+Earnings+Release_Final.pdf",
  },
  "Q3 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23726/presentation/3Q23+Earnings+Slides+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23726/earnings_release/3Q23+Earnings+Release_Final.pdf",
  },
  "Q4 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23727/presentation/4Q23+Earnings+Slides+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23727/earnings_release/4Q23+Earnings+Release_Final.pdf",
  },
  "Q1 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23728/presentation/1Q24+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23728/earnings_release/1Q24+Earnings+Release_Final.pdf",
  },
  "Q2 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23729/presentation/2Q24+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23729/earnings_release/2Q24+Earnings+Release_Final.pdf",
  },
  "Q3 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23730/presentation/3Q24+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23730/earnings_release/3Q24+Earnings+Release_Final.pdf",
  },
  "Q4 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23731/presentation/4Q24+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23731/earnings_release/4Q24+Earnings+Release_Final.pdf",
  },
  "Q1 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23940/presentation/1Q25+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23940/earnings_release/1Q25+Earnings+Release_Final.pdf",
  },
  "Q2 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23963/presentation/2Q25+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23963/earnings_release/2Q25+Earnings+Release_Final.pdf",
  },
  "Q3 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23973/presentation/3Q25+Earnings+Slides.vf.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23973/earnings_release/3Q25+Earnings+Release_Final.pdf",
  },
  "Q4 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23986/presentation/4Q25+Earnings+Slides.vf.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/23986/earnings_release/4Q25+Earnings+Release_Final.pdf",
  },
  "Q1 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/24002/presentation/1Q26+Earnings+Slides.vf.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/24002/earnings_release/1Q26+Earnings+Release_Final.pdf",
  },
  "Q2 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/24018/presentation/2Q26+Earnings+Slides_Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/db/2463/24018/earnings_release/2Q26+Earnings+Release_Final.pdf",
  },
};

export function isPncRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isPncIrPdf(href: string | null | undefined): boolean {
  if (!href || isPncRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "d1io3yog0oux5.cloudfront.net" || host.endsWith(".cloudfront.net"))) return false;
    if (!u.pathname.includes("/pnc/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergePncKnownQuarterDocs(): Map<string, PncQuarterDocs> {
  return new Map(Object.entries(PNC_KNOWN_QUARTER_DOCS));
}
