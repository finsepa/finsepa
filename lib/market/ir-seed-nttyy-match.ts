/**
 * NTTYY IR seed — 03-31.
 * NTT ADR March FY. Slides=earnings presentation; Filings=kessan release on group.ntt. Latest Q1 2026. Scope stats: 17 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export const NTTYY_FY_END = "03-31" as const;

export type NttyyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const NTTYY_IR_PAGES = [
  "https://group.ntt/en/ir/",
  "https://group.ntt/en/ir/library/presentation/financial/",
] as const;

export const NTTYY_KNOWN_QUARTER_DOCS: Readonly<Record<string, NttyyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://group.ntt/en/ir/library/presentation/2022/220808e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2022/pdf/fy2022q1kessan0808e.pdf",
  },
  "Q2 2022": {
    slides: "https://group.ntt/en/ir/library/presentation/2022/221108e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2022/pdf/fy2022q2kessan1108e.pdf",
  },
  "Q3 2022": {
    slides: "https://group.ntt/en/ir/library/presentation/2022/230209e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2022/pdf/fy2022q3kessan0209e.pdf",
  },
  "Q4 2022": {
    slides: "https://group.ntt/en/ir/library/presentation/2022/230512e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2022/pdf/fy2022q4kessan0512e.pdf",
  },
  "Q1 2023": {
    slides: "https://group.ntt/en/ir/library/presentation/2023/230809e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2023/pdf/fy2023q1kessan0809e.pdf",
  },
  "Q2 2023": {
    slides: "https://group.ntt/en/ir/library/presentation/2023/231107e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2023/pdf/fy2023q2kessan1107e.pdf",
  },
  "Q3 2023": {
    slides: "https://group.ntt/en/ir/library/presentation/2023/240208e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2023/pdf/fy2023q3kessan0208e.pdf",
  },
  "Q4 2023": {
    slides: "https://group.ntt/en/ir/library/presentation/2023/240510e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2023/pdf/fy2023q4kessan0510e.pdf",
  },
  "Q1 2024": {
    slides: "https://group.ntt/en/ir/library/presentation/2024/240807e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2024/pdf/fy2024q1kessan0807e.pdf",
  },
  "Q2 2024": {
    slides: "https://group.ntt/en/ir/library/presentation/2024/241107e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2024/pdf/fy2024q2kessan1107e.pdf",
  },
  "Q3 2024": {
    slides: "https://group.ntt/en/ir/library/presentation/2024/250207e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2024/pdf/fy2024q3kessan0207e.pdf",
  },
  "Q4 2024": {
    slides: "https://group.ntt/en/ir/library/presentation/2024/250509e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2024/pdf/fy2024q4kessan0509e.pdf",
  },
  "Q1 2025": {
    slides: "https://group.ntt/en/ir/library/presentation/2025/250806e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2025/pdf/fy2025q1kessan0806e.pdf",
  },
  "Q2 2025": {
    slides: "https://group.ntt/en/ir/library/presentation/2025/251104e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2025/pdf/fy2025q2kessan1104e.pdf",
  },
  "Q3 2025": {
    slides: "https://group.ntt/en/ir/library/presentation/2025/260205e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2025/pdf/fy2025q3kessan0205e.pdf",
  },
  "Q4 2025": {
    slides: "https://group.ntt/en/ir/library/presentation/2025/260508e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2025/pdf/fy2025q4kessan0508e.pdf",
  },
  "Q1 2026": {
    slides: "https://group.ntt/en/ir/library/presentation/2026/260806e.pdf",
    filings: "https://group.ntt/en/ir/library/results/2026/pdf/fy2026q1kessan0806e.pdf",
  },
};

export function isNttyyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isNttyyIrPdf(href: string | null | undefined): boolean {
  if (!href || isNttyyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "group.ntt" || host.endsWith(".ntt"))) return false;
    if (!u.pathname.includes("/en/ir/library/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeNttyyKnownQuarterDocs(): Map<string, NttyyQuarterDocs> {
  return new Map(Object.entries(NTTYY_KNOWN_QUARTER_DOCS));
}
