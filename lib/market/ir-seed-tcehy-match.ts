/**
 * Tencent (TCEHY) IR results page parsing — Earnings Presentation + Earnings Releases PDFs.
 */

export type TcehyQuarterDocs = { slides: string | null; filings: string | null };

const TCEHY_STATIC = "https://static.www.tencent.com/uploads";

/**
 * Archived quarterly PPT + press PDFs. The live results page is JS-gated and
 * typically only exposes 2025–2026. Prefer press “TENCENT ANNOUNCES …” over
 * HKEX long announcements / annual reports.
 */
export const TCEHY_KNOWN_QUARTER_DOCS: Readonly<Record<string, TcehyQuarterDocs>> = {
  "Q1 2022": {
    slides: `${TCEHY_STATIC}/2022/05/19/1501a739addd20a382dadeda55b3a7aa.pdf`,
    filings: `${TCEHY_STATIC}/2022/05/18/f403326038a641b20465a17eff3567ce.pdf`,
  },
  "Q2 2022": {
    slides: `${TCEHY_STATIC}/2022/08/17/d0d74555dfe436e57a9a3c05a0ded87b.pdf`,
    filings: `${TCEHY_STATIC}/2022/08/17/a1a39b69021bb7e4bf7f8dd238070079.pdf`,
  },
  "Q3 2022": {
    slides: `${TCEHY_STATIC}/2022/11/16/2e74fd58866aa9a05eef8518f28073dc.pdf`,
    filings: `${TCEHY_STATIC}/2022/11/16/33aad36dea97848eb75aa988d785e9f8.pdf`,
  },
  "Q4 2022": {
    slides: `${TCEHY_STATIC}/2023/03/22/cae26aa75f380a804ba83bc7a9a7314e.pdf`,
    filings: `${TCEHY_STATIC}/2023/03/22/3b5431187fdc8a053d9fee3a4c031aa6.pdf`,
  },
  "Q1 2023": {
    slides: `${TCEHY_STATIC}/2023/05/17/b08a7a48f3cca0ccb6081b00141f9806.pdf`,
    filings: `${TCEHY_STATIC}/2023/05/17/7b07c1a2b0befc1a89a6fc4219ed6cae.pdf`,
  },
  "Q2 2023": {
    slides: `${TCEHY_STATIC}/2023/08/16/fd005676b39a09da4ac60be5889b6ba0.pdf`,
    filings: `${TCEHY_STATIC}/2023/08/16/f283f2dfd05151ae7659e7a8e3d667ef.pdf`,
  },
  "Q3 2023": {
    slides: `${TCEHY_STATIC}/2023/11/15/b7d902f720c9fd3a56b5f3e1652ed793.pdf`,
    filings: `${TCEHY_STATIC}/2023/11/15/9e4da3187104bbdf04e2cbe491b75147.pdf`,
  },
  "Q4 2023": {
    slides: `${TCEHY_STATIC}/2024/03/20/77e0ebaf83f2fe36dac418e9fed68f5b.pdf`,
    filings: `${TCEHY_STATIC}/2024/03/20/fe50310bf15caaab4b05dd9e8e49d316.pdf`,
  },
  "Q1 2024": {
    slides: `${TCEHY_STATIC}/2024/05/14/1c37a19fdb83ad5b84ad65ff15ee781b.pdf`,
    filings: `${TCEHY_STATIC}/2024/05/14/207c400f3d6e2d9894c0b9b778507cf1.pdf`,
  },
  "Q2 2024": {
    slides: `${TCEHY_STATIC}/2024/08/14/44149b29cb1ebb83e059bab039501c5b.pdf`,
    filings: `${TCEHY_STATIC}/2024/08/14/027889ef78b4ed2b83337dd4a7c2ffef.pdf`,
  },
  "Q3 2024": {
    slides: `${TCEHY_STATIC}/2024/11/13/ccffd154b896b6c3e1ae65c13b73761d.pdf`,
    filings: `${TCEHY_STATIC}/2024/11/13/fc23e847ab5be9093587be6b7b01c115.pdf`,
  },
  "Q4 2024": {
    slides: `${TCEHY_STATIC}/2025/03/19/f55938d61be94cf9700a971a4db08809.pdf`,
    filings: `${TCEHY_STATIC}/2025/03/19/81cb1f36bec218d27d6e0b24eec012b6.pdf`,
  },
};

/** Live scrape wins; fill any missing slot from the known overlay. */
export function mergeTcehyKnownQuarterDocs(fromHtml: Map<string, TcehyQuarterDocs>): Map<string, TcehyQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(TCEHY_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

const ORDINAL_FQ: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
};

function parseQuarterYearFromHeading(text: string): { fq: number; fy: number } | null {
  const t = text.replace(/\s+/g, " ").trim();
  // "Tencent Announces 2026 Second Quarter Results" / "… 2025 Annual and Fourth Quarter Results"
  const m =
    t.match(/\b(20\d{2})\s+(First|Second|Third|Fourth)\s+Quarter\b/i) ??
    t.match(/\b(20\d{2})\s+Annual\s+and\s+(First|Second|Third|Fourth)\s+Quarter\b/i);
  if (!m) return null;
  const fy = Number(m[1]);
  const fq = ORDINAL_FQ[m[2]!.toLowerCase()];
  if (!fq || !Number.isFinite(fy)) return null;
  return { fq, fy };
}

function isPdfHref(href: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(href);
}

/**
 * Walk Tencent `/investors/results/` HTML: headings carry FY/FQ; sibling anchors
 * labeled "Earnings Presentation" / "Earnings Releases".
 */
export function parseTencentResultsHtml(html: string): Map<string, TcehyQuarterDocs> {
  const out = new Map<string, TcehyQuarterDocs>();
  const merge = (fq: number, fy: number, kind: "slides" | "filings", url: string) => {
    const key = `Q${fq} ${fy}`;
    const cur = out.get(key) ?? { slides: null, filings: null };
    if (kind === "slides" && !cur.slides) cur.slides = url;
    if (kind === "filings" && !cur.filings) cur.filings = url;
    out.set(key, cur);
  };

  // Split on h2/h3 headings that mention Quarter Results.
  const parts = html.split(/(?=<h[23]\b)/i);
  for (const part of parts) {
    const headingM = part.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i);
    if (!headingM) continue;
    const heading = headingM[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const q = parseQuarterYearFromHeading(heading);
    if (!q) continue;

    const anchorRe = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
    for (const m of part.matchAll(anchorRe)) {
      const href = (m[2] ?? "").replace(/&amp;/g, "&").trim().split("#")[0]!;
      if (!href.startsWith("http") || !isPdfHref(href)) continue;
      // Prefer static.www.tencent.com / tencent.com uploads — skip unrelated CDNs.
      if (!/tencent\.com/i.test(href)) continue;

      const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const attrs = m[1] ?? "";
      const blob = `${attrs} ${inner}`;
      if (/earnings\s*presentation|earnings\s*ppt|\bppt\b/i.test(blob)) {
        merge(q.fq, q.fy, "slides", href);
      } else if (/earnings\s*releases?|results\.pdf/i.test(blob) && !/hkex|announcement/i.test(blob)) {
        merge(q.fq, q.fy, "filings", href);
      } else if (/link-text[^>]*>\s*Earnings\s*Presentation/i.test(m[0] ?? "")) {
        merge(q.fq, q.fy, "slides", href);
      } else if (/link-text[^>]*>\s*Earnings\s*Releases?/i.test(m[0] ?? "")) {
        merge(q.fq, q.fy, "filings", href);
      }
    }
  }

  return out;
}
