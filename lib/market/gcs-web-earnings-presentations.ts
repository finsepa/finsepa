/** Q4 / Business Wire GCS-web JSON feeds and static-files presentation discovery. */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const FETCH_MS = 12_000;
const HEAD_MS = 2500;

export type GcsWebEvent = {
  title: string;
  startDate: string;
  presentationUrl: string | null;
};

type RawGcsEvent = {
  Title?: string;
  StartDate?: string;
  EventId?: number;
  WebCastLink?: string;
  Documents?: { DocumentPath?: string; Title?: string; DocumentFileType?: string }[];
};

function gcsWebOriginFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().includes("gcs-web.com")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function staticFilesUrl(host: string, uuid: string): string {
  const origin = host.startsWith("http") ? new URL(host).origin : `https://${host}`;
  return `${origin}/static-files/${uuid}`;
}

/** Extract `static-files/{uuid}` links from IR HTML (Q4 / cmcsa.com). */
export function extractStaticFilesPresentationUrls(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }
  const re = /(?:https?:\/\/[^"'\\s]+)?\/static-files\/([a-f0-9-]{36})/gi;
  for (const m of html.matchAll(re)) {
    const uuid = m[1]!;
    const raw = m[0]!.startsWith("http") ? m[0]! : `${base.origin}/static-files/${uuid}`;
    try {
      out.push(new URL(raw, base).href.split("#")[0]!);
    } catch {
      out.push(staticFilesUrl(base.origin, uuid));
    }
  }
  return [...new Set(out)];
}

/** Normalize "Q2 2026", "Q2-26", "FQ2 2026" → `Q2 2026` for row label matching. */
function normalizeEarningsDeckQuarterLabel(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const m =
    t.match(/\bQ([1-4])\s+20(\d{2})\b/i) ??
    t.match(/\bQ([1-4])[-\s]?20(\d{2})\b/i) ??
    t.match(/\bFQ([1-4])\s+20(\d{2})\b/i) ??
    t.match(/\bFY\s*20(\d{2})\s+Q([1-4])\b/i);
  if (!m) return null;
  const fq = m[1]!.length === 1 ? Number(m[1]) : Number(m[2]);
  const yy = m[1]!.length === 1 ? m[2]! : m[1]!;
  if (fq < 1 || fq > 4) return null;
  return `Q${fq} 20${yy}`;
}

function anchorContextLooksLikeEarningsDeck(context: string): boolean {
  return /earnings\s*deck|presentation|slides?\b/i.test(context) && !/prepared\s*remarks/i.test(context);
}

/**
 * Map fiscal labels (`Q2 2026`) to static-files deck URLs scraped from IR HTML
 * (Micron / Comcast-style `investors.{brand}.com/events-and-presentations`).
 */
export function extractQuarterLabeledEarningsDeckUrls(html: string, pageUrl: string): Map<string, string> {
  const out = new Map<string, string>();
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }

  const anchorRe =
    /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const hrefRaw = (m[2] ?? "").replace(/&amp;/g, "&").trim();
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!hrefRaw || !/\/static-files\/[a-f0-9-]{36}/i.test(hrefRaw)) continue;

    const titleMatch = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i);
    const title = titleMatch?.[1] ?? "";
    const context = `${title} ${inner}`;
    if (!anchorContextLooksLikeEarningsDeck(context)) continue;

    const label = normalizeEarningsDeckQuarterLabel(context);
    if (!label) continue;

    let abs: string;
    try {
      abs = new URL(hrefRaw, base).href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!out.has(label)) out.set(label, abs);
  }

  return out;
}

function normalizeSlidePresentationQuarterLabel(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const q = t.match(/\bQ([1-4])\s+20(\d{2})\b/i);
  if (q) return `Q${q[1]} 20${q[2]}`;
  const fy = t.match(/\bFY\s*20(\d{2})\b/i);
  if (fy) return `Q4 20${fy[1]}`;
  return null;
}

function quarterLabelFromCompactToken(token: string): string | null {
  const m = token.match(/\b([1-4])Q(\d{2})\b/i);
  if (!m) return null;
  return `Q${m[1]} 20${m[2]}`;
}

function quarterLabelFromPdfHref(hrefRaw: string): string | null {
  const decoded = decodeURIComponent(hrefRaw).replace(/\+/g, " ");
  const compact = quarterLabelFromCompactToken(decoded);
  if (compact) return compact;

  const qApostrophe = decoded.match(/\bQ([1-4])['%27](\d{2})\b/i);
  if (qApostrophe) return `Q${qApostrophe[1]} 20${qApostrophe[2]}`;

  const qUnderscore = decoded.match(/\bQ([1-4])_(\d{4})\b/i);
  if (qUnderscore) return `Q${qUnderscore[1]} ${qUnderscore[2]}`;

  const fullYear = decoded.match(/\b([1-4])Q(\d{4})\b/i);
  if (fullYear) return `Q${fullYear[1]} ${fullYear[2]}`;

  const spaced = decoded.match(/\b20(\d{2})\s*Q([1-4])\b/i) ?? decoded.match(/\bQ([1-4])\s*20(\d{2})\b/i);
  if (!spaced) return null;
  if (spaced[1]!.length === 2) return `Q${spaced[2]} 20${spaced[1]}`;
  return `Q${spaced[1]} 20${spaced[2]}`;
}

function quarterLabelFromAnchorContext(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const spaced = t.match(/\bQ([1-4])\s+(\d{4})\b/i) ?? t.match(/\bQ([1-4])\s+20(\d{2})\b/i);
  if (spaced) {
    if (spaced[2]!.length === 4) return `Q${spaced[1]} ${spaced[2]}`;
    return `Q${spaced[1]} 20${spaced[2]}`;
  }
  return quarterLabelFromPdfHref(t);
}

/**
 * Custom IR asset hosts (Coca-Cola class): `1Q26+IR+Overview+Presentation.pdf` on `/pdf/` paths.
 */
export function extractQuarterLabeledIrOverviewPresentationPdfUrls(
  html: string,
  pageUrl: string,
): Map<string, string> {
  const out = new Map<string, string>();
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const hrefRaw = (m[1] ?? "").replace(/&amp;/g, "&").trim();
    if (!hrefRaw || !/\.pdf(?:$|[?#])/i.test(hrefRaw)) continue;
    const decoded = decodeURIComponent(hrefRaw).replace(/\+/g, " ");
    if (!/ir.*overview.*presentation|overview.*presentation|investor.*overview.*presentation/i.test(decoded)) {
      continue;
    }
    const label = quarterLabelFromPdfHref(hrefRaw);
    if (!label) continue;
    let abs: string;
    try {
      abs = new URL(hrefRaw, base).href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!out.has(label)) out.set(label, abs);
  }
  return out;
}

/** Earnings deck PDFs (Intel class): `/earnings_presentation/Q1'26+Earnings+Deck.pdf`. */
export function extractQuarterLabeledEarningsDeckPdfUrls(html: string, pageUrl: string): Map<string, string> {
  const out = new Map<string, string>();
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }

  const anchorRe =
    /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const hrefRaw = (m[2] ?? "").replace(/&amp;/g, "&").trim();
    if (!hrefRaw || !/\.pdf(?:$|[?#])/i.test(hrefRaw)) continue;
    const decoded = decodeURIComponent(hrefRaw).replace(/\+/g, " ");
    if (
      !/earnings_presentation|earnings\+deck|earnings.deck|earnings deck/i.test(decoded) &&
      !/earnings\s*presentation|earnings\s*deck/i.test(attrs)
    ) {
      continue;
    }

    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const label = quarterLabelFromPdfHref(hrefRaw) ?? quarterLabelFromAnchorContext(`${title} ${inner}`);
    if (!label) continue;

    let abs: string;
    try {
      abs = new URL(hrefRaw, base).href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!out.has(label)) out.set(label, abs);
  }

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const hrefRaw = (m[1] ?? "").replace(/&amp;/g, "&").trim();
    if (!hrefRaw || !/\.pdf(?:$|[?#])/i.test(hrefRaw)) continue;
    const decoded = decodeURIComponent(hrefRaw).replace(/\+/g, " ");
    if (!/earnings_presentation|earnings\+deck|earnings.deck/i.test(decoded)) continue;
    const label = quarterLabelFromPdfHref(hrefRaw);
    if (!label) continue;
    let abs: string;
    try {
      abs = new URL(hrefRaw, base).href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!out.has(label)) out.set(label, abs);
  }

  return out;
}

/** Earnings release PDFs on custom IR hosts, e.g. `Coca-Cola+2026+Q1+Earnings+Release`. */
export function extractQuarterLabeledEarningsReleasePdfUrls(html: string, pageUrl: string): Map<string, string> {
  const out = new Map<string, string>();
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const hrefRaw = (m[1] ?? "").replace(/&amp;/g, "&").trim();
    if (!hrefRaw || !/\.pdf(?:$|[?#])/i.test(hrefRaw)) continue;
    const decoded = decodeURIComponent(hrefRaw).replace(/\+/g, " ");
    if (!/earnings[-_. ]?release|financial[-_. ]?results/i.test(decoded)) continue;
    const label = quarterLabelFromPdfHref(hrefRaw);
    if (!label) continue;
    let abs: string;
    try {
      abs = new URL(hrefRaw, base).href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!out.has(label)) out.set(label, abs);
  }
  return out;
}

/** Map fiscal labels to slide PDFs on IR pages (AMD / Q4 `cloudfront` quarterly-results). */
export function extractQuarterLabeledSlidePresentationPdfUrls(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const anchorRe =
    /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const hrefRaw = (m[2] ?? "").replace(/&amp;/g, "&").trim();
    if (!hrefRaw || !/\.pdf(?:$|[?#])/i.test(hrefRaw)) continue;
    if (!/\/presentation\//i.test(hrefRaw) && !/earnings_presentation|earnings\+deck|earnings.deck/i.test(hrefRaw)) {
      continue;
    }
    if (!/earnings\s*slide/i.test(hrefRaw) && !/earnings_presentation|earnings\+deck|earnings.deck/i.test(hrefRaw)) {
      continue;
    }

    const aria = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const context = `${aria} ${inner}`;
    if (
      !/slide\s*presentation|earnings\s*slide|earnings\s*presentation|earnings\s*deck/i.test(context) &&
      !/earnings_presentation|earnings\+deck|earnings.deck/i.test(hrefRaw)
    ) {
      continue;
    }

    const label =
      normalizeSlidePresentationQuarterLabel(context) ??
      quarterLabelFromPdfHref(hrefRaw) ??
      quarterLabelFromAnchorContext(context);
    if (!label) continue;

    let abs: string;
    try {
      abs = new URL(hrefRaw).href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!out.has(label)) out.set(label, abs);
  }
  return out;
}

function resolveGcsDocumentPath(path: string, docOrigins: readonly string[]): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.split("#")[0]!;
  for (const o of docOrigins) {
    if (trimmed.startsWith("/static-files/")) return `${o}${trimmed}`;
    if (/^[a-f0-9-]{36}$/i.test(trimmed)) return staticFilesUrl(o, trimmed);
  }
  return null;
}

function presentationFromGcsEvent(ev: RawGcsEvent, origin: string): string | null {
  const cmcsaOrigin = origin.includes("gcs-web.com")
    ? origin.replace(".gcs-web.com", ".com")
    : origin;
  const docOrigins = [...new Set([origin, cmcsaOrigin])];
  const docs = ev.Documents ?? [];
  for (const d of docs) {
    const title = `${d.Title ?? ""} ${d.DocumentPath ?? ""}`.toLowerCase();
    if (!/present|slide|deck/i.test(title)) continue;
    const path = d.DocumentPath?.trim();
    if (!path) continue;
    const resolved = resolveGcsDocumentPath(path, docOrigins);
    if (resolved) return resolved;
  }
  if (!/earnings|results|quarter/i.test(ev.Title ?? "")) return null;
  for (const d of docs) {
    const title = `${d.Title ?? ""}`.toLowerCase();
    if (!/press release and financial|financial tables|earnings release/i.test(title)) continue;
    const path = d.DocumentPath?.trim();
    if (!path) continue;
    const resolved = resolveGcsDocumentPath(path, docOrigins);
    if (resolved) return resolved;
  }
  return null;
}

/** Fetch earnings-call events from a `{ticker}.gcs-web.com` JSON feed when reachable. */
export async function fetchGcsWebEarningsEvents(irHostUrl: string): Promise<GcsWebEvent[]> {
  const origin = gcsWebOriginFromUrl(irHostUrl);
  if (!origin) return [];

  const feedUrl = `${origin}/feed/Event.svc/GetEventList?LanguageId=1&eventSelection=2&eventDateFilter=0&includeUpcoming=false&includePast=true`;
  let body: string;
  try {
    const res = await fetch(feedUrl, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return [];
    body = await res.text();
  } catch {
    return [];
  }
  if (!body.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return [];
  }

  const list =
    (parsed as { GetEventListResult?: RawGcsEvent[] })?.GetEventListResult ??
    (Array.isArray(parsed) ? parsed : null);
  if (!Array.isArray(list)) return [];

  return list
    .filter((ev) => /earnings|results|quarter/i.test(ev.Title ?? ""))
    .map((ev) => ({
      title: ev.Title ?? "",
      startDate: ev.StartDate ?? "",
      presentationUrl: presentationFromGcsEvent(ev, origin.replace(".gcs-web.com", ".com")) || presentationFromGcsEvent(ev, origin),
    }));
}

export async function headPdfLikeUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return null;
    if (ct.includes("application/pdf") || /static-files\//i.test(url)) {
      return res.url || url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Match a GCS earnings event to a report date (±4 calendar days). */
export function gcsEventForReportDate(events: readonly GcsWebEvent[], reportYmd: string): GcsWebEvent | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportYmd)) return null;
  const target = Date.parse(`${reportYmd}T12:00:00.000Z`);
  if (!Number.isFinite(target)) return null;

  let best: { ev: GcsWebEvent; delta: number } | null = null;
  for (const ev of events) {
    if (!ev.presentationUrl) continue;
    const d = Date.parse(ev.startDate);
    if (!Number.isFinite(d)) continue;
    const delta = Math.abs(d - target);
    if (delta > 4 * 86400000) continue;
    if (!best || delta < best.delta) best = { ev, delta };
  }
  return best?.ev ?? null;
}
