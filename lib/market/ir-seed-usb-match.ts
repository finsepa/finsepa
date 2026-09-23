/**
 * USB IR seed — 12-31.
 * U.S. Bancorp calendar FY. Slides=Earnings Call Presentation; Filings=Earnings Release on s203.q4cdn.com/711684571. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type UsbQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const USB_IR_PAGES = [
  "https://ir.usbank.com/",
] as const;

export const USB_KNOWN_QUARTER_DOCS: Readonly<Record<string, UsbQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2022/04/1q22_earnings_call_presentation_-_final.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2022/04/usb_1q22_earnings_release_and_consolidated_financial_schedules.pdf",
  },
  "Q2 2022": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2022/07/2q22_earnings_call_presentation_-_final.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2022/07/usb_2q22_earnings_release_and_consolidated_financial_schedules.pdf",
  },
  "Q3 2022": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2022/10/3q22_earnings_call_presentation_-_final.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2022/10/USB-3Q22-Earnings-Release-and-Consolidated-Financial-Schedules.pdf",
  },
  "Q4 2022": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2023/01/4q22_earnings_call_presentation_-_final.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2023/01/usb_4q22_earnings_release_and_consolidated_financial_schedules.pdf",
  },
  "Q1 2023": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2023/04/1q23_earnings_call_presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2023/04/usb_1q23_earnings_release_and_consolidated_financial_schedules.pdf",
  },
  "Q2 2023": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2023/07/USB-2Q23-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2023/07/usb_2q23_earnings_release_and_consolidated_financial_schedules.pdf",
  },
  "Q3 2023": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2023/10/3q23_earnings_call_presentation_final.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2023/10/usb_3q23_earnings_release_and_consolidated_financial_schedules.pdf",
  },
  "Q4 2023": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_financials/2023/Q4/q4_2023_earnings_call_presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_financials/2023/Q4/q4_2023_earnings_release.pdf",
  },
  "Q1 2024": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2024/Apr/17/1Q24-Earnings-Call-Presentation-Final.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2024/Apr/17/Q1-2024-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_financials/2024/q2/2Q24-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_financials/2024/q2/Press-Release-2Q24.pdf",
  },
  "Q3 2024": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2024/Oct/16/3Q24-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2024/Oct/16/Press-Release-3Q24.pdf",
  },
  "Q4 2024": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Jan/16/Earnings-Call-Presentation-4Q24.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Jan/16/4Q24-Earnings-Release-4Q24.pdf",
  },
  "Q1 2025": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Apr/16/Earnings-Call-Presentation-1Q25.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Apr/16/1Q25-Earnings-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Jul/17/2Q25-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Jul/17/2Q25-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Oct/16/Earnings-Call-Presentation-3Q25.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2025/Oct/16/3Q25-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2026/Jan/20/4Q25-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2026/Jan/20/4Q25-Earnings-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2026/Apr/16/EarningsCallPresentation1Q26_vF.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2026/Apr/16/1Q26EarningsRelease.pdf",
  },
  "Q2 2026": {
    slides: "https://s203.q4cdn.com/711684571/files/doc_events/2026/Jul/16/EarningsCallPresentation2Q26vF.pdf",
    filings: "https://s203.q4cdn.com/711684571/files/doc_events/2026/Jul/16/2Q26EarningsRelease.pdf",
  },
};

export function isUsbRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isUsbIrPdf(href: string | null | undefined): boolean {
  if (!href || isUsbRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s203.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/711684571/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeUsbKnownQuarterDocs(): Map<string, UsbQuarterDocs> {
  return new Map(Object.entries(USB_KNOWN_QUARTER_DOCS));
}
