/**
 * TKOMY IR seed — 03-31.
 * Tokio Marine Holdings ADR (TKOMY) March FY. Slides=Overview/Results Presentation; Filings=Summary Report. Latest Q1 2026. Scope stats: 17 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type TkomyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const TKOMY_IR_PAGES = [
  "https://www.tokiomarinehd.com/en/ir/event/presentation.html",
] as const;

export const TKOMY_KNOWN_QUARTER_DOCS: Readonly<Record<string, TkomyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000dt7v-att/Overview_of_1Q_FY2022_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000dt7v-att/1Q_FY2022_Summary_Report_e.pdf",
  },
  "Q2 2022": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000em7i-att/Overview_of_2Q_FY2022_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000em7i-att/2Q_FY2022_Summary_Report_e.pdf",
  },
  "Q3 2022": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000f61q-att/Overview_of_3Q_FY2022_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000f61q-att/3Q_FY2022_Summary_Report_e.pdf",
  },
  "Q4 2022": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000fsse-att/Overview_of_4Q_FY2022_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2022/k82ffv000000fsse-att/4Q_FY2022_Summary_Report_e.pdf",
  },
  "Q1 2023": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/k82ffv000000gi37-att/Overview_of_1Q_FY2023_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/k82ffv000000gi37-att/1Q_FY2023_Summary_Report_e.pdf",
  },
  "Q2 2023": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/k82ffv000000gvsa-att/Overview_of_2Q_FY2023_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/k82ffv000000gvsa-att/2Q_FY2023_Summary_Report_e.pdf",
  },
  "Q3 2023": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/qsbph400000008ko-att/Overview_of_3Q_FY2023_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/qsbph400000008ko-att/3Q_FY2023_Summary_Report_e.pdf",
  },
  "Q4 2023": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/qsbph40000002ear-att/Overview_of_4Q_FY2023_Results_E.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2023/qsbph40000002ear-att/4Q_FY2023_Summary_Report_e.pdf",
  },
  "Q1 2024": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc90000008g07-att/Overview_of_1Q_FY2024_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc90000008g07-att/1Q_FY2024_Summary_Report_e.pdf",
  },
  "Q2 2024": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc9000000gcm8-att/Overview_of_2Q_FY2024_Results_E.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc9000000gcm8-att/2Q_FY2024_Summary_Report_e.pdf",
  },
  "Q3 2024": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc9000000vk0g-att/Overview_of_3Q_FY2024_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc9000000vk0g-att/3Q_FY2024_Summary_Report_e.pdf",
  },
  "Q4 2024": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc9000001gbyp-att/Overview_of_4Q_FY2024_Results_e_v2.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2024/o1ckc9000001gbyp-att/4Q_FY2024_Summary_Report_e.pdf",
  },
  "Q1 2025": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/o1ckc9000001y39m-att/Overview_of_1Q_FY2025_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/o1ckc9000001y39m-att/1Q_FY2025_Summary_Report_e.pdf",
  },
  "Q2 2025": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/fomceq00000006vj-att/Overview_of_2Q_FY2025_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/fomceq00000006vj-att/2Q_FY2025_Summary_Report_e.pdf",
  },
  "Q3 2025": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/f5hrqd0000002zat-att/Overview_of_3Q_FY2025_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/f5hrqd0000002zat-att/3Q_FY2025_Summary_Report_e.pdf",
  },
  "Q4 2025": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/f5hrqd0000008l5a-att/Tokio_Marine_2025Q4_Results_Presentation_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2025/f5hrqd0000005mbv-att/4Q_FY2025_Summary_Report_e.pdf",
  },
  "Q1 2026": {
    slides: "https://www.tokiomarinehd.com/en/ir/event/presentation/2026/f5hrqd000000a3c1-att/Overview_of_2026_1Q_Results_e.pdf",
    filings: "https://www.tokiomarinehd.com/en/ir/event/presentation/2026/f5hrqd000000a3c1-att/1Q_FY2026_Summary_Report_e.pdf",
  },
};

export function isTkomyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|annual.?report|integrated.?report|sustainab|esg|solicitation/i.test(n);
}

export function isTkomyIrPdf(href: string | null | undefined): boolean {
  if (!href || isTkomyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.tokiomarinehd.com" || host.endsWith(".tokiomarinehd.com"))) return false;
    if (!(u.pathname.includes("/ir/") || u.pathname.includes("/presentation/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeTkomyKnownQuarterDocs(): Map<string, TkomyQuarterDocs> {
  return new Map(Object.entries(TKOMY_KNOWN_QUARTER_DOCS));
}
