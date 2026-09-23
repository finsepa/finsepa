/**
 * Progressive (PGR) IR — calendar FY.
 * Slides = IR Call / Presentation (mostly Q2/Q4); Filings = Complete Earnings Release
 * via ml.globenewswire.com/Resource/Download (PDF bytes, no .pdf suffix).
 * Never 10-Q / 10-K / Shareholder Report / SEC HTML.
 */

export type PgrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PGR_IR_PAGES = [
  "https://investors.progressive.com/",
  "https://investors.progressive.com/financials/financial-results/default.aspx",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const PGR_KNOWN_QUARTER_DOCS: Readonly<Record<string, PgrQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2026/q2/26P20224_Q2_2026_IR_Call.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/80356bff-8751-4f27-b604-5c4f266c944e",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/fefd8f5c-55b4-4317-b656-aa6a1c3e3e8b",
  },
  "Q4 2025": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2025/q4/25P20588_Q4_2025_IR_Call.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/77cdd94c-ff89-4af3-a3ad-6fbcb603c265",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/cf10b395-b40b-429e-91e4-52a8da2b2cf9",
  },
  "Q2 2025": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2025/q2/2025-Q2_Investor-Relations-Call_FINAL.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/6238ae99-9bd9-495d-817b-f02115dea5db",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/74d2643c-b7d1-42af-81c0-083db87e54f4",
  },
  "Q4 2024": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2024/q4/Q4_2024_Investor-Relations.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/14010827-c814-4ace-8e26-84b5b2e03387",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/10a48677-e8ff-4467-813b-dffad6eecaa6",
  },
  "Q2 2024": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2024/q2/Q2_2024_Investor_Relations_8-6-24.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/545fc9c4-4eb5-48c2-9ce1-9fb8f9acb474",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/38d3899e-d80c-4f2e-983c-3245fd7ed90a",
  },
  "Q4 2023": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_events/2024/02/2023q4_presentation.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/581935d0-73d1-41fa-8cf2-f4dccbad47d2",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/24f7df40-c274-4837-9ab9-71f49011100c",
  },
  "Q2 2023": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2023/Q2/q2-23-investor-relations.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/e523cd46-cdd0-4c27-9446-68e323b5f22e",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/7eebd367-356e-45ca-b2a5-98c0af94702f",
  },
  "Q4 2022": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2022/q4/feb-2023-ir-call.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/a9878971-06ea-4e99-8a46-140d69d79006",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/9c712331-ff74-49e5-9efa-b0a09d04c1ab",
  },
  "Q2 2022": {
    slides: "https://s202.q4cdn.com/605347829/files/doc_financials/2022/q2/2022-q2-ir-presentation.pdf",
    filings: "https://ml.globenewswire.com/Resource/Download/6441a584-e1ab-4bd5-ad3d-9e7b23029f25",
  },
  "Q1 2022": {
    slides: null,
    filings: "https://ml.globenewswire.com/Resource/Download/3780ab8c-b0e9-4129-b5eb-82406ba37271",
  },
};

export function isPgrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|shareholder[-_\s]*report|interactive\/index|loss[-_\s]*reserv|reinsurance|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isPgrIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "s202.q4cdn.com" && u.pathname.includes("/605347829/") && /\.pdf(?:$|[?#])/i.test(u.pathname)) {
      return !isPgrRejected(url);
    }
    if (
      (host === "ml.globenewswire.com" || host.endsWith(".globenewswire.com")) &&
      /\/Resource\/Download\/[a-f0-9-]{36}\/?$/i.test(u.pathname)
    ) {
      return !isPgrRejected(url);
    }
    return false;
  } catch {
    return false;
  }
}

export function mergePgrKnownQuarterDocs(): Map<string, PgrQuarterDocs> {
  return new Map(Object.entries(PGR_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
