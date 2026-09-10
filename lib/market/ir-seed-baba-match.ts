/** Alibaba IR: quarterly results presentation as slides, press-release PDF as filings. Never earnings-call transcripts or annual reports. */

export type BabaQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BABA_LIST_JSON = (year: number): string =>
  `https://data.alibabagroup.com/data/index/ir/quarterly-results/q${year}/list.json`;

export const BABA_DOCUMENT_JSON = (id: string): string =>
  `https://data.alibabagroup.com/data/document/${id}.json`;

export const BABA_IR_PAGES = [
  "https://www.alibabagroup.com/en-US/ir-financial-reports-quarterly-results",
] as const;

const MONTH_NUM: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

export function isBabaRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|earnings\s*call|transcript|annual\s*report|interim\s*report|esg/i.test(n);
}

/** Calendar month of the IR title → `YYYY-MM` (June Quarter 2026 → 2026-06). */
export function babaYmFromTitle(title: string): string | null {
  const t = title.replace(/\s+/g, " ").trim();
  const y = t.match(/\b(20\d{2})\b/);
  if (!y) return null;
  for (const [name, mm] of Object.entries(MONTH_NUM)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(t)) return `${y[1]}-${mm}`;
  }
  return null;
}

export function babaYmFromPeriodEndYmd(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd.slice(0, 7);
}

function i18nEn(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "en_US" in value) {
    const en = (value as { en_US?: unknown }).en_US;
    if (typeof en === "string") return en;
  }
  return "";
}

function pickBabaPdf(url: string | null | undefined, title = ""): string | null {
  if (!url || !/^https:\/\/data\.alibabagroup\.com\//i.test(url)) return null;
  if (!/\.pdf(?:$|[?#])/i.test(url)) return null;
  if (isBabaRejected(url, title)) return null;
  return url.split("#")[0] ?? null;
}

type BabaListItem = {
  documentTitle?: unknown;
  pressRelease?: unknown;
  urls?: Record<string, unknown>;
};

export function parseBabaQuarterlyListJson(raw: unknown): Map<string, BabaQuarterDocs & { pressId: string | null }> {
  const out = new Map<string, BabaQuarterDocs & { pressId: string | null }>();
  const root = raw && typeof raw === "object" ? (raw as { content?: unknown }) : null;
  const items = Array.isArray(root?.content)
    ? root.content
    : Array.isArray(raw)
      ? raw
      : [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const it = item as BabaListItem;
    const title = i18nEn(it.documentTitle);
    const ym = babaYmFromTitle(title);
    if (!ym) continue;
    const urls = it.urls && typeof it.urls === "object" ? it.urls : {};
    const slides = pickBabaPdf(
      typeof urls.presentationUrl_en_US === "string"
        ? urls.presentationUrl_en_US
        : typeof urls.presentationLink === "string"
          ? urls.presentationLink
          : null,
      title,
    );
    const pressId = typeof it.pressRelease === "string" && /^\d+$/.test(it.pressRelease) ? it.pressRelease : null;
    const cur = out.get(ym) ?? { slides: null, filings: null, pressId: null };
    out.set(ym, {
      slides: cur.slides ?? slides,
      filings: cur.filings,
      pressId: cur.pressId ?? pressId,
    });
  }
  return out;
}

/** Press PDF from Alibaba `/data/document/{id}.json` body. */
export function pressPdfFromBabaDocumentJson(raw: unknown): string | null {
  const root = raw && typeof raw === "object" ? (raw as { content?: unknown }) : null;
  const content = root?.content && typeof root.content === "object" ? (root.content as Record<string, unknown>) : null;
  if (!content) return null;
  const title = i18nEn(content.documentTitle);
  const urls = content.urls && typeof content.urls === "object" ? (content.urls as Record<string, unknown>) : {};
  const fromUrls = pickBabaPdf(typeof urls.pdf_en_US === "string" ? urls.pdf_en_US : null, title);
  if (fromUrls) return fromUrls;
  const html = typeof content.documentContentEnUS === "string" ? content.documentContentEnUS : "";
  const m = html.match(/https:\/\/data\.alibabagroup\.com\/ecms-files\/[^"'\\\s>]+\.pdf/i);
  return pickBabaPdf(m?.[0] ?? null, title);
}
