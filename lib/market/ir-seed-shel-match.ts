/** Shell IR: quarterly slides as slides, quarterly press-release PDF as filings. Never QRA, transcripts, accessibility, or databooks. */

export type ShelQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SHEL_MODEL_JSON =
  "https://www.shell.com/investors/results-and-reporting/quarterly-results.model.json";

export const SHEL_IR_PAGES = [
  "https://www.shell.com/investors/results-and-reporting/quarterly-results.html",
] as const;

const SHELL_ORIGIN = "https://www.shell.com";

export function isShelRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|qra-document|speech|transcript|accessib|with-speech|databook|\.xls|cmd|capital[-_\s]*markets/i.test(
    n,
  );
}

function absShell(path: string): string | null {
  const t = path.trim().replace(/\\+/g, "");
  if (!t) return null;
  try {
    const abs = t.startsWith("http") ? t : `${SHELL_ORIGIN}${t.startsWith("/") ? t : `/${t}`}`;
    const u = new URL(abs);
    if (u.hostname !== "www.shell.com" && u.hostname !== "shell.com") return null;
    return u.href.split("#")[0] ?? null;
  } catch {
    return null;
  }
}

function preferShellPdf(cur: string | null, next: string): string {
  if (!cur) return next;
  const curXf = /experience-fragments/i.test(cur);
  const nextXf = /experience-fragments/i.test(next);
  if (nextXf && !curXf) return next;
  return cur;
}

function labelFromShelFilename(path: string): string | null {
  const n = decodeURIComponent(path).toLowerCase();
  const slides = n.match(/\/q([1-4])-(20\d{2})-slides?\.pdf(?:$|[?#])/i);
  if (slides) return `Q${slides[1]} ${slides[2]}`;
  const press = n.match(/\/q([1-4])-(20\d{2})-quarterly-press(?:-release)?\.pdf(?:$|[?#])/i);
  if (press) return `Q${press[1]} ${press[2]}`;
  return null;
}

function isShelSlidesPath(path: string): boolean {
  return /\/q[1-4]-20\d{2}-slides?\.pdf(?:$|[?#])/i.test(decodeURIComponent(path));
}

function isShelFilingsPath(path: string): boolean {
  return /\/q[1-4]-20\d{2}-quarterly-press(?:-release)?\.pdf(?:$|[?#])/i.test(
    decodeURIComponent(path),
  );
}

/** Parse Shell AEM quarterly-results.model.json (or any JSON/HTML containing stream PDF paths). */
export function parseShelQuarterlyModelJson(raw: string): Map<string, ShelQuarterDocs> {
  const out = new Map<string, ShelQuarterDocs>();
  const pathRe =
    /(?:https:\/\/www\.shell\.com)?(\/(?:content|investors)[^"'\\\s>]+\.pdf)/gi;
  for (const m of raw.matchAll(pathRe)) {
    const rel = m[1] ?? "";
    const abs = absShell(rel);
    if (!abs || isShelRejected(abs)) continue;
    const label = labelFromShelFilename(abs);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (isShelSlidesPath(abs)) cur.slides = preferShellPdf(cur.slides, abs);
    else if (isShelFilingsPath(abs)) cur.filings = preferShellPdf(cur.filings, abs);
    out.set(label, cur);
  }
  return out;
}
