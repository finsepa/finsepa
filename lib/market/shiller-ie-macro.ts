import "server-only";

import { unstable_cache } from "next/cache";
import * as XLSX from "xlsx";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

/**
 * Long-horizon S&P 500 valuation and earnings series from Robert Shiller’s *Irrational Exuberance* dataset (`ie_data.xls`).
 *
 * Primary: Yale-hosted file; fallback mirror if Yale is unreachable (same workbook layout).
 *
 * @see http://www.econ.yale.edu/~shiller/data.htm
 * @see https://posix4e.github.io/shiller_wrapper_data/ (mirror + attribution)
 */

const SHILLER_IE_URLS = [
  "https://www.econ.yale.edu/~shiller/data/ie_data.xls",
  "https://posix4e.github.io/shiller_wrapper_data/ie_data.xls",
] as const;

export type ShillerIeMacroMetric = "sp500_pe" | "shiller_tr_cape" | "sp500_earnings";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
type MacroPoint = { time: string; value: number };

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /^na$/i.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Shiller month keys look like `1871.01` (January). Normalize to ISO day for charts / sorting. */
function shillerMonthKeyToYmd(key: string): string | null {
  const m = /^(\d{4})\.(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = m[1]!;
  const mo = m[2]!;
  return `${y}-${mo}-01`;
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length < 4) continue;
    if (String(r[0] ?? "").trim() === "Date" && String(r[1] ?? "").trim() === "P" && String(r[3] ?? "").trim() === "E")
      return i;
  }
  return -1;
}

function columnIndexFor(headers: unknown[], name: string): number {
  const want = name.trim();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] ?? "").trim() === want) return i;
  }
  return -1;
}

async function fetchShillerIeXlsBufferUncached(): Promise<ArrayBuffer | null> {
  for (const url of SHILLER_IE_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FinsepaMacro/1.0 (+https://finsepa)" },
        next: { revalidate: REVALIDATE_STATIC_DAY },
      });
      if (!res.ok) continue;
      return await res.arrayBuffer();
    } catch {
      continue;
    }
  }
  return null;
}

type ShillerIeBundle = { pe: MacroPoint[]; shillerTrCape: MacroPoint[]; earnings: MacroPoint[] };

function parseIeDataSheet(buf: ArrayBuffer): ShillerIeBundle | null {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets.Data;
  if (!ws) return null;

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as unknown[][];
  const hdrIdx = findHeaderRowIndex(rows);
  if (hdrIdx < 0) return null;

  const headers = rows[hdrIdx] as unknown[];
  const iDate = columnIndexFor(headers, "Date");
  const iP = columnIndexFor(headers, "P");
  const iE = columnIndexFor(headers, "E");
  /** Total-return CAPE — tracks headline aggregator figures more closely than classic CAPE. */
  const iTrCape = columnIndexFor(headers, "TR CAPE");
  if (iDate < 0 || iP < 0 || iE < 0 || iTrCape < 0) return null;

  const pe: MacroPoint[] = [];
  const shillerTrCape: MacroPoint[] = [];
  const earnings: MacroPoint[] = [];

  for (let r = hdrIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[] | undefined;
    if (!Array.isArray(row)) continue;
    const rawDate = row[iDate];
    if (typeof rawDate !== "string") continue;
    const ymd = shillerMonthKeyToYmd(rawDate);
    if (!ymd) continue;

    const p = parseNum(row[iP]);
    const e = parseNum(row[iE]);
    if (e != null && e > 0 && e < 50_000) earnings.push({ time: ymd, value: e });

    if (p != null && e != null && e > 0) {
      const v = p / e;
      if (Number.isFinite(v) && v > 0 && v < 500) pe.push({ time: ymd, value: v });
    }

    const cape = parseNum(row[iTrCape]);
    if (cape != null && cape > 0 && cape < 500) shillerTrCape.push({ time: ymd, value: cape });
  }

  pe.sort((a, b) => a.time.localeCompare(b.time));
  shillerTrCape.sort((a, b) => a.time.localeCompare(b.time));
  earnings.sort((a, b) => a.time.localeCompare(b.time));
  return { pe, shillerTrCape, earnings };
}

async function loadShillerIeMacroPairsUncached(): Promise<ShillerIeBundle> {
  const buf = await fetchShillerIeXlsBufferUncached();
  if (!buf) return { pe: [], shillerTrCape: [], earnings: [] };
  return parseIeDataSheet(buf) ?? { pe: [], shillerTrCape: [], earnings: [] };
}

const loadShillerIeMacroPairsCached = unstable_cache(loadShillerIeMacroPairsUncached, ["shiller-ie-macro-pairs-v2"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

export async function fetchShillerIeMacroSeriesCached(metric: ShillerIeMacroMetric): Promise<MacroPoint[]> {
  const { pe, shillerTrCape, earnings } = await loadShillerIeMacroPairsCached();
  if (metric === "sp500_pe") return pe;
  if (metric === "shiller_tr_cape") return shillerTrCape;
  return earnings;
}
