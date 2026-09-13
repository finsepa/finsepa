/** Disney (DIS) IR — FY ends ~late Sept. Slides = Earnings Presentation when published, else Shareholder Letter / Earnings Report; Filings = Earnings Report when presentation used, else Financial Reconciliations. Never transcript / 10-Q / SEC HTML. */

export type DisQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends Saturday nearest Sept 30. */
export const DIS_FY_END = "09-30";

export const DIS_IR_PAGES = [
  "https://investors.thewaltdisneycompany.com/financials/quarterly-results/default.aspx",
] as const;

export const DIS_KNOWN_QUARTER_DOCS: Readonly<Record<string, DisQuarterDocs>> = {
  "Q3 2026": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_financials/2026/q3/q3-fy26-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_financials/2026/q3/q3-fy26-financial-reconciliations.pdf",
  },
  "Q2 2026": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_financials/2026/q2/q2-fy26-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_financials/2026/q2/q2-fy26-financial-reconciliations.pdf",
  },
  "Q1 2026": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_financials/2026/q1/FY2026_Q1_PR_Ex99-1_Final-to-Comm-and-IR.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2026/Feb/02/Financial-Reconciliations.pdf",
  },
  "Q4 2025": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2025/11/q4-fy25-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2025/11/reconciliation_q4_fy25.pdf",
  },
  "Q3 2025": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2025/08/q3-fy25-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2025/08/reconciliation_q3_fy25.pdf",
  },
  "Q2 2025": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2025/05/q2-fy25-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2025/05/reconciliation_q2_fy25.pdf",
  },
  "Q1 2025": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2025/02/q1-fy25-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2025/02/reconciliation_q1_fy25.pdf",
  },
  "Q4 2024": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2024/11/Q4-FY24-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2024/11/q4-fy24-earnings.pdf",
  },
  "Q3 2024": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2024/08/Q3-FY24-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2024/08/q3-fy24-earnings.pdf",
  },
  "Q2 2024": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2024/05/Q2_FY24_Earnings_Presentation.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2024/05/q2-fy24-earnings.pdf",
  },
  "Q1 2024": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2024/02/Q1_FY24_Earnings_Presentation.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2024/02/q1-fy24-earnings.pdf",
  },
  "Q4 2023": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_presentation/2023/11/Q4_FY23_Earnings_Presentation-1.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2023/11/q4-fy23-earnings.pdf",
  },
  "Q3 2023": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_presentation/2023/08/Q3_FY23_Earnings_Presentation-1.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2023/08/q3-fy23-earnings.pdf",
  },
  "Q2 2023": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2023/05/Q2_FY23_Earnings_Presentation.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2023/05/q2-fy23-earnings.pdf",
  },
  "Q1 2023": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_presentation/2023/02/Q1_FY23_Earnings_Presentation-1.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2023/02/q1-fy23-earnings.pdf",
  },
  "Q4 2022": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2022/11/q4-fy22-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2022/11/reconciliation_q4_fy22.pdf",
  },
  "Q3 2022": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2022/08/q3-fy22-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2022/08/reconciliation_q3_fy22.pdf",
  },
  "Q2 2022": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2022/05/q2-fy22-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2022/05/reconciliation_q2_fy22.pdf",
  },
  "Q1 2022": {
    slides: "https://s206.q4cdn.com/979796730/files/doc_events/2022/02/q1-fy22-earnings.pdf",
    filings: "https://s206.q4cdn.com/979796730/files/doc_events/2022/02/reconciliation_q1_fy22.pdf",
  },
};

export function isDisRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|8-?k|executive.?commentary|svod|recap/i.test(n);
}

export function isDisIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "s206.q4cdn.com" || u.hostname.endsWith(".q4cdn.com"))) return false;
    return u.pathname.includes("/979796730/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeDisKnownQuarterDocs(): Map<string, DisQuarterDocs> {
  return new Map(Object.entries(DIS_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
