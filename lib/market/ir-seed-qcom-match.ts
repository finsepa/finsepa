/** Qualcomm (QCOM) IR — FY ends ~Sept. Slides = Earnings Presentation; Filings = Earnings Release. Never transcript / SEC HTML. */

export type QcomQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends late September. */
export const QCOM_FY_END = "09-30";

const CDN = "https://s204.q4cdn.com/645488518/files/doc_financials";

export const QCOM_IR_PAGES = [
  "https://investor.qualcomm.com/",
] as const;

/** HTTP-verified q4cdn catalog (issuer FY labels). Empty slides when issuer did not publish a deck. */
export const QCOM_KNOWN_QUARTER_DOCS: Readonly<Record<string, QcomQuarterDocs>> = {
  "Q3 2026": {
    slides: `${CDN}/2026/q3/FY2026-3rd-Quarter-Earnings-Presentation_7-29-26_Final.pdf`,
    filings: `${CDN}/2026/q3/FY2026-3rd-Quarter-Earnings-Release.pdf`,
  },
  "Q2 2026": {
    slides: `${CDN}/2026/q2/FY2026-2nd-Quarter-Earnings-Presentation_4-29-26_Final.pdf`,
    filings: `${CDN}/2026/q2/FY2026-2nd-Quarter-Earnings-Release.pdf`,
  },
  "Q1 2026": {
    slides: `${CDN}/2026/q1/FY2026-1st-Quarter-Earnings-Presentation_2-4-26_final_distributed.pdf`,
    filings: `${CDN}/2026/q1/FY2026-1st-Quarter-Earnings-Release.pdf`,
  },
  "Q4 2025": {
    slides: `${CDN}/2025/q4/FY2025-4th-Quarter-Earnings-Presentation_11-5-25_final.pdf`,
    filings: `${CDN}/2025/q4/FY2025-4th-Quarter-Earnings-Release.pdf`,
  },
  "Q3 2025": {
    slides: `${CDN}/2025/q3/FY2025-3rd-Quarter-Earnings-Presentation_7-30-25_Final.pdf`,
    filings: `${CDN}/2025/q3/FY2025-3rd-Quarter-Earnings-Release.pdf`,
  },
  "Q2 2025": {
    slides: `${CDN}/2025/q2/FY2025-2nd-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2025/q2/FY2025-2nd-Quarter-Earnings-Release.pdf`,
  },
  "Q1 2025": {
    slides: `${CDN}/2025/q1/FY2025-1st-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2025/q1/FY2025-1st-Quarter-Earnings-Release.pdf`,
  },
  "Q4 2024": {
    slides: `${CDN}/2024/q4/FY2024-4th-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q4/FY2024-4th-Quarter-Earnings-Release.pdf`,
  },
  "Q3 2024": {
    slides: `${CDN}/2024/q3/FY2024-3rd-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q3/FY2024-3rd-Quarter-Earnings-Release.pdf`,
  },
  "Q2 2024": {
    slides: `${CDN}/2024/q2/FY2024-2nd-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q2/FY2024-2nd-Quarter-Earnings-Release.pdf`,
  },
  "Q1 2024": {
    slides: `${CDN}/2024/q1/FY2024-1st-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q1/FY2024-1st-Quarter-Earnings-Release.pdf`,
  },
  "Q4 2023": {
    slides: `${CDN}/2023/q4/FY2023-4th-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q4/FY-2023-4th-Quarter-Earnings-Release.pdf`,
  },
  "Q3 2023": {
    slides: `${CDN}/2023/q3/FY2023-3rd-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q3/FY-2023-3rd-Quarter-Earnings-Release.pdf`,
  },
  "Q2 2023": {
    slides: `${CDN}/2023/q2/FY2023-2nd-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q2/FY-2023-2nd-Quarter-Earnings-Release.pdf`,
  },
  "Q1 2023": {
    slides: `${CDN}/2023/q1/FY2023-1st-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q1/FY-2023-1st-Quarter-Earnings-Release.pdf`,
  },
  "Q4 2022": {
    slides: `${CDN}/2022/q4/FY2022-4th-Quarter-Earnings-Presentation.pdf`,
    filings: `${CDN}/2022/q4/FY2022-4th-Quarter-Earnings-Release.pdf`,
  },
  "Q3 2022": {
    slides: null,
    filings: `${CDN}/2022/q3/FY-2022-3rd-Quarter-Earnings-Release.pdf`,
  },
  "Q2 2022": {
    slides: `${CDN}/2022/q2/FY2022-2nd-Quarter-Earnings-Presentation_Final.pdf`,
    filings: `${CDN}/2022/q2/FY-2022-2nd-Quarter-Earnings-Release.pdf`,
  },
  "Q1 2022": {
    slides: null,
    filings: `${CDN}/2022/q1/FY-2022-1st-Quarter-Earnings-Release.pdf`,
  },
};

export function isQcomRejected(href: string, title = ""): boolean {
  const n = `${href} ${title}`.toLowerCase();
  return (
    n.includes("transcript") ||
    n.includes("10-q") ||
    n.includes("10-k") ||
    n.includes("investor-day") ||
    n.includes("snapdragon") ||
    n.includes("sec.gov") ||
    /\.htm(?:l)?(?:$|[?#])/i.test(href)
  );
}

export function isQcomIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (!(h === "q4cdn.com" || h.endsWith(".q4cdn.com"))) return false;
    return u.pathname.includes("/645488518/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeQcomKnownQuarterDocs(): Map<string, QcomQuarterDocs> {
  return new Map(Object.entries(QCOM_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
