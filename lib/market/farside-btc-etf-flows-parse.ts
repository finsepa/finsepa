/** Pure Farside BTC ETF flow parsers (no server-only — safe for unit tests). */

const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

const DATE_RE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i;
const CELL_RE = /^-?[\d,]+(?:\.\d+)?$|^\([\d,]+(?:\.\d+)?\)$|^-$|^—$|^–$/;
const SUMMARY_LABELS = new Set(["total", "average", "maximum", "minimum", "fee"]);

function parseFlowCell(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t || t === "-" || t === "—" || t === "–") return null;
  const paren = t.startsWith("(") && t.endsWith(")");
  const n = Number(paren ? t.slice(1, -1) : t);
  if (!Number.isFinite(n)) return null;
  return paren ? -n : n;
}

function dateTokenToYmd(day: number, mon: string, year: number): string | null {
  const key = mon.slice(0, 1).toUpperCase() + mon.slice(1, 3).toLowerCase();
  const m = MONTHS[key];
  if (m == null || day < 1 || day > 31 || year < 2020) return null;
  return `${year.toString().padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse Farside all-data HTML or markdown into daily **Total** net flow points.
 * Values are US dollars (Farside publishes US$m × 1e6).
 */
export function parseFarsideBtcEtfFlowTotals(raw: string): Array<{ time: string; value: number }> {
  if (!raw || /just a moment|cf-chl|challenge-platform/i.test(raw)) return [];

  const fromTables = parseMarkdownOrHtmlTables(raw);
  if (fromTables.length > 0) return fromTables;

  return parseLineOrientedTotals(raw);
}

function parseMarkdownOrHtmlTables(raw: string): Array<{ time: string; value: number }> {
  const out: Array<{ time: string; value: number }> = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    const dateCell = cells[0]!;
    const dm = DATE_RE.exec(dateCell);
    if (!dm) continue;
    const ymd = dateTokenToYmd(Number(dm[1]), dm[2]!, Number(dm[3]));
    if (!ymd) continue;
    const total = parseFlowCell(cells[cells.length - 1]!);
    if (total == null) continue;
    if (seen.has(ymd)) continue;
    seen.add(ymd);
    out.push({ time: ymd, value: total * 1e6 });
  }

  if (out.length > 0) {
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(raw))) {
    const cells = [...rowMatch[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      m[1]!.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim(),
    );
    if (cells.length < 2) continue;
    const dm = DATE_RE.exec(cells[0]!);
    if (!dm) continue;
    const ymd = dateTokenToYmd(Number(dm[1]), dm[2]!, Number(dm[3]));
    if (!ymd) continue;
    const total = parseFlowCell(cells[cells.length - 1]!);
    if (total == null) continue;
    if (seen.has(ymd)) continue;
    seen.add(ymd);
    out.push({ time: ymd, value: total * 1e6 });
  }

  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}

function parseLineOrientedTotals(raw: string): Array<{ time: string; value: number }> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ time: string; value: number }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const dm = DATE_RE.exec(lines[i]!);
    if (!dm) continue;
    const ymd = dateTokenToYmd(Number(dm[1]), dm[2]!, Number(dm[3]));
    if (!ymd) continue;

    const vals: Array<number | null> = [];
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j]!;
      if (DATE_RE.test(line)) break;
      const lower = line.toLowerCase();
      if (SUMMARY_LABELS.has(lower) && vals.length > 0) break;
      if (SUMMARY_LABELS.has(lower)) {
        j += 1;
        continue;
      }
      if (CELL_RE.test(line.replace(/\s+/g, ""))) {
        vals.push(parseFlowCell(line));
      }
      j += 1;
      if (vals.length >= 14) break;
    }

    const total = vals.length ? vals[vals.length - 1] : null;
    if (total == null || seen.has(ymd)) {
      i = Math.max(i, j - 1);
      continue;
    }
    seen.add(ymd);
    out.push({ time: ymd, value: total * 1e6 });
    i = Math.max(i, j - 1);
  }

  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}
