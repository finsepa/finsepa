/**
 * MITSY IR seed — 03-31.
 * Mitsui & Co March FY. Slides=IR Meeting Presentation (en_*_ppt); Filings=flash (en_*_ta) on mitsui.com. Latest Q1 2027. Scope stats: 21 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export const MITSY_FY_END = "03-31" as const;

export type MitsyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MITSY_IR_PAGES = [
  "https://www.mitsui.com/jp/en/ir/",
  "https://www.mitsui.com/jp/en/ir/library/meeting/",
] as const;

export const MITSY_KNOWN_QUARTER_DOCS: Readonly<Record<string, MitsyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/__icsFiles/afieldfile/2022/08/08/en_223_1q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/__icsFiles/afieldfile/2021/08/03/en_223_1q_ta.pdf",
  },
  "Q2 2022": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/__icsFiles/afieldfile/2021/11/19/en_223_2q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/__icsFiles/afieldfile/2021/11/02/en_223_2q_ta.pdf",
  },
  "Q3 2022": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_223_3q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_223_3q_ta.pdf",
  },
  "Q4 2022": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_223_4q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_223_4q_ta.pdf",
  },
  "Q1 2023": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_1q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_1q_ta.pdf",
  },
  "Q2 2023": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_2q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_2q_ta.pdf",
  },
  "Q3 2023": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_3q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_3q_ta.pdf",
  },
  "Q4 2023": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_4q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_233_4q_ta.pdf",
  },
  "Q1 2024": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_1q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_1q_ta.pdf",
  },
  "Q2 2024": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_2q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_2q_ta.pdf",
  },
  "Q3 2024": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_3q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_3q_ta.pdf",
  },
  "Q4 2024": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_4q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_243_4q_ta.pdf",
  },
  "Q1 2025": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_1q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_1q_ta.pdf",
  },
  "Q2 2025": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_2q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_2q_ta.pdf",
  },
  "Q3 2025": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_3q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_3q_ta.pdf",
  },
  "Q4 2025": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_4q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_253_4q_ta.pdf",
  },
  "Q1 2026": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_1q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_1q_ta.pdf",
  },
  "Q2 2026": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_2q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_2q_ta.pdf",
  },
  "Q3 2026": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_3q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_3q_ta.pdf",
  },
  "Q4 2026": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_4q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_263_4q_ta.pdf",
  },
  "Q1 2027": {
    slides: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_273_1q_ppt.pdf",
    filings: "https://www.mitsui.com/jp/en/ir/library/meeting/pdf/en_273_1q_ta.pdf",
  },
};

export function isMitsyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|strategic.?update/i.test(n);
}

export function isMitsyIrPdf(href: string | null | undefined): boolean {
  if (!href || isMitsyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.mitsui.com" || host.endsWith(".mitsui.com"))) return false;
    if (!u.pathname.includes("/ir/library/meeting/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMitsyKnownQuarterDocs(): Map<string, MitsyQuarterDocs> {
  return new Map(Object.entries(MITSY_KNOWN_QUARTER_DOCS));
}
