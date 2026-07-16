import "server-only";

import { unstable_cache } from "next/cache";
import * as XLSX from "xlsx";

import { REVALIDATE_STATIC_DAY, REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { fetchBlsCpiURawSeriesCached } from "@/lib/market/bls-cpi-macro";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

/**
 * Long-horizon S&P 500 valuation and earnings series from Robert Shiller’s *Irrational Exuberance* dataset (`ie_data.xls`).
 *
 * Shiller P/E uses classic CAPE; S&P 500 P/E uses trailing P/E; earnings is Shiller `E`.
 * CAPE and trailing P/E extend past the workbook with live S&P 500 prices (EODHD `GSPC.INDX`).
 * Earnings carries the last reported `E` through the current month (same denominator Multpl uses
 * for estimated P/E when the earnings table has not updated yet).
 *
 * @see http://www.econ.yale.edu/~shiller/data.htm
 * @see https://posix4e.github.io/shiller_wrapper_data/ (mirror + attribution)
 * @see https://www.multpl.com/s-p-500-pe-ratio
 * @see https://www.multpl.com/shiller-pe
 */

const SHILLER_IE_URLS = [
  "https://posix4e.github.io/shiller_wrapper_data/ie_data.xls",
  "https://www.econ.yale.edu/~shiller/data/ie_data.xls",
] as const;

const SPX_EODHD_SYMBOL = "GSPC.INDX";
/** Months of implied e10 used to extrapolate the earnings base past the workbook. */
const E10_GROWTH_LOOKBACK = 6;

export type ShillerIeMacroMetric = "sp500_pe" | "shiller_cape" | "sp500_earnings";

/** Same shape as {@link MacroPoint} in `eodhd-macro` — kept local to avoid import cycles. */
type MacroPoint = { time: string; value: number };

type CapeAnchor = {
  time: string;
  /** Nominal monthly average S&P price (Shiller `P`). */
  p: number;
  cpi: number;
  cape: number;
  /** Real 10y earnings average implied by Price/CAPE (or P/CAPE). */
  e10: number;
};

type PeAnchor = {
  time: string;
  p: number;
  e: number;
  pe: number;
};

type ShillerIeBundle = {
  pe: MacroPoint[];
  shillerCape: MacroPoint[];
  earnings: MacroPoint[];
  /** Historic CPI column from `ie_data.xls` (1982–84 = 100). */
  cpi: MacroPoint[];
  capeAnchors: CapeAnchor[];
  peAnchors: PeAnchor[];
};

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || /^na$/i.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Shiller month keys are Excel numbers like `2025.01` (Jan) / `2025.1` (Oct — `2025.10` collapses in float).
 * `toFixed(2)` restores October as `2025.10`.
 */
function shillerMonthKeyToYmd(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const m = /^(\d{4})\.(\d{2})$/.exec(raw.toFixed(2));
    if (!m) return null;
    return `${m[1]}-${m[2]}-01`;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    const two = /^(\d{4})\.(\d{2})$/.exec(t);
    if (two) return `${two[1]}-${two[2]}-01`;
    const one = /^(\d{4})\.(\d)$/.exec(t);
    if (one) {
      // Lone `.1` after a `.01` row is October (Excel float); otherwise month 1–9.
      const mo = one[2] === "1" ? "10" : one[2]!.padStart(2, "0");
      return `${one[1]}-${mo}-01`;
    }
  }
  return null;
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

function addMonthsYmd(ymd: string, delta: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function ymdTodayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type SpxBar = { date: string; close: number };

/** SPX daily closes for CAPE extension — uses `revalidate` so it works inside `unstable_cache`. */
async function fetchSpxDailyBars(fromYmd: string, toYmd: string): Promise<SpxBar[]> {
  const key = getEodhdApiKey();
  if (!key) return [];
  if (!traceEodhdHttp("fetchSpxDailyBarsForShillerCape", { from: fromYmd, to: toYmd })) return [];

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from: fromYmd,
    to: toYmd,
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(SPX_EODHD_SYMBOL)}?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_WARM } });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    const out: SpxBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const adj = row.adjusted_close;
      const cl = row.close;
      const close =
        typeof adj === "number" && Number.isFinite(adj)
          ? adj
          : typeof cl === "number" && Number.isFinite(cl)
            ? cl
            : null;
      if (close == null) continue;
      out.push({ date, close });
    }
    return out;
  } catch {
    return [];
  }
}

function parseIeDataSheet(buf: ArrayBuffer): ShillerIeBundle | null {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets.Data;
  if (!ws) return null;

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];
  const hdrIdx = findHeaderRowIndex(rows);
  if (hdrIdx < 0) return null;

  const headers = rows[hdrIdx] as unknown[];
  const iDate = columnIndexFor(headers, "Date");
  const iP = columnIndexFor(headers, "P");
  const iE = columnIndexFor(headers, "E");
  const iCpi = columnIndexFor(headers, "CPI");
  const iPrice = columnIndexFor(headers, "Price");
  const iCape = columnIndexFor(headers, "CAPE");
  if (iDate < 0 || iP < 0 || iE < 0 || iCape < 0) return null;

  const pe: MacroPoint[] = [];
  const shillerCape: MacroPoint[] = [];
  const earnings: MacroPoint[] = [];
  const cpiSeries: MacroPoint[] = [];
  const capeAnchors: CapeAnchor[] = [];
  const peAnchors: PeAnchor[] = [];
  let lastE: number | null = null;

  for (let r = hdrIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[] | undefined;
    if (!Array.isArray(row)) continue;
    const ymd = shillerMonthKeyToYmd(row[iDate]);
    if (!ymd) continue;

    const p = parseNum(row[iP]);
    const e = parseNum(row[iE]);
    const cpi = iCpi >= 0 ? parseNum(row[iCpi]) : null;
    const realPrice = iPrice >= 0 ? parseNum(row[iPrice]) : null;
    const cape = parseNum(row[iCape]);

    if (cpi != null && cpi > 0) {
      cpiSeries.push({ time: ymd, value: cpi });
    }

    if (e != null && e > 0 && e < 50_000) {
      lastE = e;
      earnings.push({ time: ymd, value: e });
    }

    // Trailing P/E — carry last reported E when Shiller’s E cell lags (Multpl-style estimates).
    if (p != null && p > 0 && lastE != null && lastE > 0) {
      const v = p / lastE;
      if (Number.isFinite(v) && v > 0 && v < 500) {
        pe.push({ time: ymd, value: v });
        peAnchors.push({ time: ymd, p, e: lastE, pe: v });
      }
    }

    if (cape != null && cape > 0 && cape < 500) {
      shillerCape.push({ time: ymd, value: cape });
      if (p != null && p > 0 && cpi != null && cpi > 0) {
        const basis = realPrice != null && realPrice > 0 ? realPrice : p;
        const e10 = basis / cape;
        if (Number.isFinite(e10) && e10 > 0) {
          capeAnchors.push({ time: ymd, p, cpi, cape, e10 });
        }
      }
    }
  }

  pe.sort((a, b) => a.time.localeCompare(b.time));
  shillerCape.sort((a, b) => a.time.localeCompare(b.time));
  earnings.sort((a, b) => a.time.localeCompare(b.time));
  cpiSeries.sort((a, b) => a.time.localeCompare(b.time));
  capeAnchors.sort((a, b) => a.time.localeCompare(b.time));
  peAnchors.sort((a, b) => a.time.localeCompare(b.time));
  return { pe, shillerCape, earnings, cpi: cpiSeries, capeAnchors, peAnchors };
}

async function fetchShillerIeXlsBufferUncached(): Promise<ArrayBuffer | null> {
  let best: { buf: ArrayBuffer; lastTime: string } | null = null;

  for (const url of SHILLER_IE_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FinsepaMacro/1.0 (+https://finsepa)" },
        next: { revalidate: REVALIDATE_STATIC_DAY },
      });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const parsed = parseIeDataSheet(buf);
      const lastTime = parsed?.shillerCape[parsed.shillerCape.length - 1]?.time ?? "";
      if (!lastTime) continue;
      if (!best || lastTime > best.lastTime) best = { buf, lastTime };
    } catch {
      continue;
    }
  }

  return best?.buf ?? null;
}

function averageMonthlyE10Delta(anchors: readonly CapeAnchor[]): number {
  if (anchors.length < 2) return 0;
  const slice = anchors.slice(-Math.min(E10_GROWTH_LOOKBACK + 1, anchors.length));
  const deltas: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    deltas.push(slice[i]!.e10 - slice[i - 1]!.e10);
  }
  if (!deltas.length) return 0;
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

function groupSpxBarsByMonth(bars: readonly SpxBar[]): Map<string, { closes: number[]; lastDate: string; lastClose: number }> {
  const byMonth = new Map<string, { closes: number[]; lastDate: string; lastClose: number }>();
  for (const bar of bars) {
    const month = `${bar.date.slice(0, 7)}-01`;
    const row = byMonth.get(month);
    if (row) {
      row.closes.push(bar.close);
      if (bar.date >= row.lastDate) {
        row.lastDate = bar.date;
        row.lastClose = bar.close;
      }
    } else {
      byMonth.set(month, { closes: [bar.close], lastDate: bar.date, lastClose: bar.close });
    }
  }
  return byMonth;
}

function monthsAheadOf(fromYmd: string, toYmd: string): number {
  return (
    (Number(toYmd.slice(0, 4)) - Number(fromYmd.slice(0, 4))) * 12 +
    (Number(toYmd.slice(5, 7)) - Number(fromYmd.slice(5, 7)))
  );
}

/**
 * Extend classic CAPE past Shiller’s last workbook month using live SPX + BLS CPI.
 * Completed months → monthly average close on the 1st; current month → latest close on the bar date.
 */
function extendCapeSeries(
  historical: MacroPoint[],
  anchors: CapeAnchor[],
  bars: readonly SpxBar[],
  cpiByMonth: Map<string, number>,
  todayYmd: string,
): MacroPoint[] {
  if (!historical.length || !anchors.length || !bars.length) return historical;

  const lastAnchor = anchors[anchors.length - 1]!;
  const avgDe10 = averageMonthlyE10Delta(anchors);
  const byMonth = groupSpxBarsByMonth(bars);
  const todayMonth = `${todayYmd.slice(0, 7)}-01`;
  const extra: MacroPoint[] = [];

  for (const month of [...byMonth.keys()].sort((a, b) => a.localeCompare(b))) {
    if (month <= lastAnchor.time) continue;
    const bucket = byMonth.get(month)!;
    const e10 = lastAnchor.e10 + avgDe10 * monthsAheadOf(lastAnchor.time, month);
    if (!(e10 > 0)) continue;

    const cpiM = cpiByMonth.get(month);
    const cpi0 = lastAnchor.cpi;
    const hasNativeCpi = cpiM != null && cpiM > 0;
    const isCurrentMonth = month === todayMonth;

    const capeFromPrice = (p: number): number | null => {
      if (!(p > 0)) return null;
      const cape =
        hasNativeCpi && cpi0 > 0 ? (p * cpi0) / (e10 * cpiM!) : p / e10;
      if (!(cape > 0 && cape < 500)) return null;
      return Math.round(cape * 100) / 100;
    };

    if (isCurrentMonth) {
      const cape = capeFromPrice(bucket.lastClose);
      if (cape != null) extra.push({ time: bucket.lastDate, value: cape });
    } else {
      const p = bucket.closes.reduce((a, b) => a + b, 0) / bucket.closes.length;
      const cape = capeFromPrice(p);
      if (cape != null) extra.push({ time: month, value: cape });
    }
  }

  if (!extra.length) return historical;
  return [...historical, ...extra].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Carry last reported trailing earnings through today (month stubs + current-day stamp).
 * Multpl’s earnings table stops at the last report; estimated P/E still uses that E — we mirror it.
 */
function extendEarningsSeries(historical: MacroPoint[], todayYmd: string): MacroPoint[] {
  if (!historical.length) return historical;
  const last = historical[historical.length - 1]!;
  const e = last.value;
  if (!(e > 0)) return historical;

  const todayMonth = `${todayYmd.slice(0, 7)}-01`;
  const lastMonth = `${last.time.slice(0, 7)}-01`;
  if (lastMonth >= todayMonth) {
    // Already has a point in the current month — refresh the as-of date if needed.
    if (last.time < todayYmd && lastMonth === todayMonth) {
      return [...historical.slice(0, -1), { time: todayYmd, value: e }];
    }
    return historical;
  }

  const extra: MacroPoint[] = [];
  for (let month = addMonthsYmd(lastMonth, 1); month <= todayMonth; month = addMonthsYmd(month, 1)) {
    if (month === todayMonth) {
      extra.push({ time: todayYmd, value: e });
    } else {
      extra.push({ time: month, value: e });
    }
  }
  if (!extra.length) return historical;
  return [...historical, ...extra].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Extend trailing S&P 500 P/E past the workbook: PE = SPX / last reported E.
 * Multpl-style estimates hold trailing earnings flat until Shiller publishes a new E.
 */
function extendTrailingPeSeries(
  historical: MacroPoint[],
  anchors: PeAnchor[],
  bars: readonly SpxBar[],
  todayYmd: string,
): MacroPoint[] {
  if (!historical.length || !anchors.length || !bars.length) return historical;

  const lastAnchor = anchors[anchors.length - 1]!;
  const e = lastAnchor.e;
  if (!(e > 0)) return historical;

  const byMonth = groupSpxBarsByMonth(bars);
  const todayMonth = `${todayYmd.slice(0, 7)}-01`;
  const extra: MacroPoint[] = [];

  for (const month of [...byMonth.keys()].sort((a, b) => a.localeCompare(b))) {
    if (month <= lastAnchor.time) continue;
    const bucket = byMonth.get(month)!;

    const peFromPrice = (p: number): number | null => {
      if (!(p > 0)) return null;
      const pe = p / e;
      if (!(pe > 0 && pe < 500)) return null;
      return Math.round(pe * 100) / 100;
    };

    if (month === todayMonth) {
      const pe = peFromPrice(bucket.lastClose);
      if (pe != null) extra.push({ time: bucket.lastDate, value: pe });
    } else {
      const p = bucket.closes.reduce((a, b) => a + b, 0) / bucket.closes.length;
      const pe = peFromPrice(p);
      if (pe != null) extra.push({ time: month, value: pe });
    }
  }

  if (!extra.length) return historical;
  return [...historical, ...extra].sort((a, b) => a.time.localeCompare(b.time));
}

async function loadShillerIeMacroPairsUncached(): Promise<ShillerIeBundle> {
  const empty: ShillerIeBundle = {
    pe: [],
    shillerCape: [],
    earnings: [],
    cpi: [],
    capeAnchors: [],
    peAnchors: [],
  };
  const buf = await fetchShillerIeXlsBufferUncached();
  if (!buf) return empty;
  const parsed = parseIeDataSheet(buf);
  if (!parsed) return empty;

  const todayYmd = ymdTodayUtc();
  const capeFrom = parsed.capeAnchors.length
    ? addMonthsYmd(parsed.capeAnchors[parsed.capeAnchors.length - 1]!.time, 1)
    : todayYmd;
  const peFrom = parsed.peAnchors.length
    ? addMonthsYmd(parsed.peAnchors[parsed.peAnchors.length - 1]!.time, 1)
    : todayYmd;
  const eodFrom = capeFrom < peFrom ? capeFrom : peFrom;

  const [bars, cpiSeries] = await Promise.all([
    eodFrom <= todayYmd ? fetchSpxDailyBars(eodFrom, todayYmd) : Promise.resolve([] as SpxBar[]),
    fetchBlsCpiURawSeriesCached(),
  ]);
  const cpiByMonth = new Map(cpiSeries.map((p) => [p.time, p.value]));

  const shillerCape = extendCapeSeries(parsed.shillerCape, parsed.capeAnchors, bars, cpiByMonth, todayYmd);
  const pe = extendTrailingPeSeries(parsed.pe, parsed.peAnchors, bars, todayYmd);
  const earnings = extendEarningsSeries(parsed.earnings, todayYmd);

  return { ...parsed, pe, shillerCape, earnings };
}

const loadShillerIeMacroPairsCached = unstable_cache(loadShillerIeMacroPairsUncached, ["shiller-ie-macro-pairs-v10-cpi"], {
  revalidate: REVALIDATE_WARM,
});

export async function fetchShillerIeMacroSeriesCached(metric: ShillerIeMacroMetric): Promise<MacroPoint[]> {
  const { pe, shillerCape, earnings } = await loadShillerIeMacroPairsCached();
  if (metric === "sp500_pe") return pe;
  if (metric === "shiller_cape") return shillerCape;
  return earnings;
}

/** Historic Shiller CPI — same XLS parse as CAPE / P/E (no second workbook download). */
export async function fetchShillerCpiSeriesCached(): Promise<MacroPoint[]> {
  const { cpi } = await loadShillerIeMacroPairsCached();
  return cpi;
}
