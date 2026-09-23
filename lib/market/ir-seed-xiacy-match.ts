/**
 * XIACY IR seed — 12-31.
 * Xiaomi ADR calendar FY. Slides=Presentation; Filings=EN announcement on ir.mi.com (static-files + nasdaq_kms). Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type XiacyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const XIACY_IR_PAGES = [
  "https://ir.mi.com/financial-information/quarterly-results",
] as const;

export const XIACY_KNOWN_QUARTER_DOCS: Readonly<Record<string, XiacyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://ir.mi.com/static-files/5164aa6d-3b5a-4b57-9f3d-1f7e0eaf7504",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2022/05/19/5-48-58/Announcement_1Q22_EN.pdf",
  },
  "Q2 2022": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2022/08/23/5-16-49/Xiaomi%20Corp_22Q2_ER_ENG_vFF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2022/08/19/5-40-32/Annoucement_22Q2_EN.pdf",
  },
  "Q3 2022": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2022/11/23/5-15-37/Xiaomi%20Corp_22Q3_ER_ENG_vF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2022/11/23/4-48-56/Annoucement_22Q3_EN.pdf",
  },
  "Q4 2022": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/03/24/7-03-22/Xiaomi%20Corp_22Q4_ER_ENG_vF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/03/24/7-35-20/HKEX-EPS_20230324_10644395_0.PDF",
  },
  "Q1 2023": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/05/24/6-10-34/Xiaomi%20Corp_23Q1_ER_ENG_vF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/05/24/6-14-31/2023052400737.pdf",
  },
  "Q2 2023": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/09/17/23-02-41/Xiaomi%20Corp_23Q2-ER_ENG_vF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/08/29/6-36-44/2023082900551.pdf",
  },
  "Q3 2023": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/11/20/5-07-45/Xiaomi%20Corp_23Q3_ER_ENG_vF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/11/20/4-56-29/ANNOUNCEMENT.pdf",
  },
  "Q4 2023": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2024/03/19/6-25-27/Xiaomi%20Corp_23Q4_ER_ENG_vF_Upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2024/03/19/5-34-07/23Q4_EN_797121_%28Xiaomi%20RA%20Eng%29_AsPrint_Fullset_1652.pdf",
  },
  "Q1 2024": {
    slides: "https://ir.mi.com/static-files/45f0cac8-fe92-4b21-9fed-21b64afc5c19",
    filings: "https://ir.mi.com/static-files/4c11aa9d-79c8-4370-9f72-bc00ac39241c",
  },
  "Q2 2024": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2024/08/21/6-09-16/Xiaomi%20Corp_24Q2_ER_ENG_v22_upload.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2024/08/21/5-44-48/Announcement.pdf",
  },
  "Q3 2024": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2025/02/24/1-40-34/Xiaomi%20Corp_24Q3_ER_ENG_vF.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2024/11/18/5-32-31/24Q3_Announcement.pdf",
  },
  "Q4 2024": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2025/03/18/6-16-00/Xiaomi%20Corp_24Q4_ER_ENG%20vF.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2025/03/18/5-38-56/%E8%8B%B1%E6%96%87%E5%85%AC%E5%91%8A.pdf",
  },
  "Q1 2025": {
    slides: "https://ir.mi.com/static-files/5aeb45ab-13ba-49aa-b57d-850b73472b58",
    filings: "https://ir.mi.com/static-files/ad8fe815-6b9f-4ee5-bd3c-5a83c1c76f9a",
  },
  "Q2 2025": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2025/08/19/5-46-10/Xiaomi%20Corp_25Q2_ER_ENG%20vF.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2025/08/19/5-36-23/25Q2%20AC_ENG.pdf",
  },
  "Q3 2025": {
    slides: "https://ir.mi.com/static-files/a0eacc97-8113-47af-9ae0-085b77c2b5f4",
    filings: "https://ir.mi.com/static-files/e4830480-8ce9-45f8-a09d-64e40b2bdfac",
  },
  "Q4 2025": {
    slides: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2026/03/24/6-20-53/Xiaomi%20Corp_25Q4_ER_ENG%20vF.pdf",
    filings: "https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2026/03/24/5-35-03/25Q4%20EN%20AC%20Xiaomi.pdf",
  },
  "Q1 2026": {
    slides: "https://ir.mi.com/static-files/cd5e90e6-4a61-4624-83a7-1aa0dd6acce9",
    filings: "https://ir.mi.com/static-files/098acc43-1b58-4d1b-b375-9ea25f35477b",
  },
  "Q2 2026": {
    slides: "https://ir.mi.com/static-files/bdeea0b9-246c-45be-8cb4-ab4faaddf80a",
    filings: "https://ir.mi.com/static-files/4a85fc36-8a6d-4c24-b45b-b18d5d162e6c",
  },
};

export function isXiacyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isXiacyIrPdf(href: string | null | undefined): boolean {
  if (!href || isXiacyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "ir.mi.com" || host.endsWith(".mi.com"))) return false;
    return /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeXiacyKnownQuarterDocs(): Map<string, XiacyQuarterDocs> {
  return new Map(Object.entries(XIACY_KNOWN_QUARTER_DOCS));
}
