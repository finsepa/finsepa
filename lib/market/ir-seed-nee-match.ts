/**
 * NextEra Energy (NEE) IR — calendar FY.
 * Slides = quarterly earnings presentation; Filings = news / press release PDF.
 * Host: www.investor.nexteraenergy.com ~/media (never SEC HTML / scripts / investor-day).
 */

export type NeeQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const NEE_HOST = "https://www.investor.nexteraenergy.com";

/** Encode path segments for Sitecore media URLs (spaces → %20). */
function media(path: string): string {
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${NEE_HOST}/~/media/Files/N/NEE-IR/${encoded}`;
}

export const NEE_IR_PAGES = [
  "https://www.investor.nexteraenergy.com/reports-and-filings/quarterly-financial-results",
  "https://www.investor.nexteraenergy.com/reports-and-filings/quarterly-financial-results/2026",
  "https://www.investor.nexteraenergy.com/reports-and-filings/quarterly-financial-results/2025",
  "https://www.investor.nexteraenergy.com/reports-and-filings/quarterly-financial-results/2024",
  "https://www.investor.nexteraenergy.com/reports-and-filings/quarterly-financial-results/2023",
  "https://www.investor.nexteraenergy.com/reports-and-filings/quarterly-financial-results/2022",
] as const;

/** HTTP-verified Presentation + Press/News Release (path naming varies by year). */
export const NEE_KNOWN_QUARTER_DOCS: Readonly<Record<string, NeeQuarterDocs>> = {
  "Q2 2026": {
    slides: media("reports-and-fillings/quarterly-earnings/2026/Q2 2026/Q2 2026 Earnings Slides_vF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2026/Q2 2026/2026-0724 NEEQ22026News Release vFINAL.pdf",
    ),
  },
  "Q1 2026": {
    slides: media("reports-and-fillings/quarterly-earnings/2026/Q1 2026/1Q 2026 Slides vF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2026/Q1 2026/2026-0423 NEEQ12026News Release vF.pdf",
    ),
  },
  "Q4 2025": {
    slides: media("reports-and-fillings/quarterly-earnings/2025/Q4 2025/4Q 2025 Slides vF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2025/Q4 2025/2026-0127 NEEQ42025News Release vF.pdf",
    ),
  },
  "Q3 2025": {
    slides: media("reports-and-fillings/quarterly-earnings/2025/Q3 2025/3Q 2025 Slides VF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2025/Q3 2025/2025-1028 NEEQ32025News Release vFinal.pdf",
    ),
  },
  "Q2 2025": {
    slides: media("reports-and-fillings/quarterly-earnings/2025/Q2 2025/2Q 2025 Slides vF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2025/Q2 2025/2025-0723 NEEQ22025News Release vFINAL.pdf",
    ),
  },
  "Q1 2025": {
    slides: media("reports-and-fillings/quarterly-earnings/2025/Q1 2025/1Q 2025 Slides vF.pdf"),
    filings: media("reports-and-fillings/quarterly-earnings/2025/Q1 2025/NEEQ12025Exhibit 99.pdf"),
  },
  "Q4 2024": {
    slides: media(
      "news-and-events/events-and-presentations/2025/4Q 2024 Slides vFinal/4Q 2024 Slides vFinal.pdf",
    ),
    filings: media(
      "news-and-events/events-and-presentations/2025/2025-0124 NEEQ42024News Release vFinal.pdf",
    ),
  },
  "Q3 2024": {
    slides: media("news-and-events/events-and-presentations/2024/10-23-24/3Q 2024 Slides.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2024/10-23-24/2024-1023 NEEQ32024News Release vFinal.pdf",
    ),
  },
  "Q2 2024": {
    slides: media("news-and-events/events-and-presentations/2024/7-24-24/2Q 2024 Slides v_Final.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2024/7-24-24/2024-0724 NEEQ22024News Release Final.pdf",
    ),
  },
  "Q1 2024": {
    slides: media("news-and-events/events-and-presentations/2024/04-23-24/1Q 2024 Slides vF.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2024/04-23-24/2024-0423 NEEQ12024News Release Final.pdf",
    ),
  },
  "Q4 2023": {
    slides: media("news-and-events/events-and-presentations/2024/01-25-24/4Q 2023 Slides vF.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2024/01-25-24/2024-0125 NEEQ42023News Release Final.pdf",
    ),
  },
  "Q3 2023": {
    slides: media("news-and-events/events-and-presentations/2023/10-24-23/3Q 2023 Slides v  F.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2023/10-24-23/2023-1024 NEEQ32023News Release Final.pdf",
    ),
  },
  "Q2 2023": {
    slides: media("reports-and-fillings/quarterly-earnings/2023/Q2/2Q 2023 Slides vF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2023/Q2/2023-0725 NEEQ22023News Release Final.pdf",
    ),
  },
  "Q1 2023": {
    slides: media("news-and-events/events-and-presentations/2023/1Q 2023 Slides vF_.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2023/Q1/2023-0425 NEEQ12023News Release Final.pdf",
    ),
  },
  "Q4 2022": {
    slides: media("reports-and-fillings/quarterly-earnings/2022/Q4/4Q 2022 Slides vF.pdf"),
    filings: media(
      "reports-and-fillings/quarterly-earnings/2022/Q4/2023-0125_NEEQ42022News Release Final.pdf",
    ),
  },
  "Q3 2022": {
    slides: media("event_presentaion/3Q 2022 Slides vF.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2022/10-28-22/2022-1028 NEEQ32022News Release Final.pdf",
    ),
  },
  "Q2 2022": {
    slides: media("event_presentaion/2Q 2022 Slides vF.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2022/07-22-2022/2022-0722 NEEQ22022News Release Final.pdf",
    ),
  },
  "Q1 2022": {
    slides: media("news-and-events/events-and-presentations/2022/04-21-22/Q1 2022 Slides_vF.pdf"),
    filings: media(
      "news-and-events/events-and-presentations/2022/04-21-22/2022-0421NEEQ12022News Release FINAL.pdf",
    ),
  },
};

export function isNeeRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|8-?k|transcript|script|remarks|financial.?statement|\.xls|investor[-_\s]*day|analyst/i.test(
      n,
    )
  );
}

export function isNeeIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (
      !(
        u.hostname === "www.investor.nexteraenergy.com" ||
        u.hostname === "investor.nexteraenergy.com" ||
        u.hostname.endsWith(".nexteraenergy.com")
      )
    ) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!u.pathname.includes("/~/media/Files/N/NEE-IR/")) return false;
    const path = decodeURIComponent(u.pathname).toLowerCase();
    if (isNeeRejected(url)) return false;
    return /slides|presentation|news.?release|press.?release|exhibit.?99/i.test(path);
  } catch {
    return false;
  }
}

export function mergeNeeKnownQuarterDocs(): Map<string, NeeQuarterDocs> {
  return new Map(Object.entries(NEE_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
