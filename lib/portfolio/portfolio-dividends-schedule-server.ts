import "server-only";

import { unstable_cache } from "next/cache";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { fetchEodhdDividendsCalendar } from "@/lib/market/eodhd-dividends-calendar";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { dividendYieldRatioFromFundamentalsRoot } from "@/lib/market/eodhd-key-stats-dividends";
import {
  fetchEodhdDividendsHistory,
  type EodhdDividendRow,
} from "@/lib/market/eodhd-splits-dividends";
import {
  readPortfolioDividendsInputsSnapshot,
  upsertPortfolioDividendsInputsSnapshot,
} from "@/lib/portfolio/portfolio-dividends-snapshot";
import {
  readPortfolioYieldPctSnapshot,
  upsertPortfolioYieldPctSnapshot,
} from "@/lib/portfolio/portfolio-overview-slow-snapshot";
import type {
  PortfolioDividendScheduleMonth,
  PortfolioDividendScheduleRow,
  PortfolioDividendsSchedulePayload,
} from "@/lib/portfolio/portfolio-dividends-schedule-types";

export type {
  PortfolioDividendEventStatus,
  PortfolioDividendScheduleMonth,
  PortfolioDividendScheduleRow,
  PortfolioDividendsSchedulePayload,
} from "@/lib/portfolio/portfolio-dividends-schedule-types";

type HoldingInput = { symbol: string; shares: number };

type ScheduleWindow = {
  fromYmd: string;
  paymentToYmd: string;
  calendarToYmd: string;
  historyFromYmd: string;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function medianPaymentLagDays(history: EodhdDividendRow[]): number {
  const lags: number[] = [];
  for (const row of history) {
    if (!row.paymentDate || !row.date) continue;
    const ex = parseISO(row.date);
    const pay = parseISO(row.paymentDate);
    const days = differenceInCalendarDays(pay, ex);
    if (days >= 0 && days <= 60) lags.push(days);
  }
  return median(lags) ?? 14;
}

function inferFrequencyLabel(sortedExDates: string[]): string | null {
  if (sortedExDates.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < sortedExDates.length; i++) {
    gaps.push(differenceInCalendarDays(parseISO(sortedExDates[i]!), parseISO(sortedExDates[i - 1]!)));
  }
  const med = median(gaps);
  if (med == null) return null;
  if (med >= 350 && med <= 380) return "Annual";
  if (med >= 170 && med <= 200) return "Semi-annual";
  if (med >= 85 && med <= 100) return "Quarterly";
  if (med >= 28 && med <= 35) return "Monthly";
  return null;
}

function dividendGrowthPct(history: EodhdDividendRow[]): number | null {
  const values = history
    .map((r) => r.value)
    .filter((v): v is number => v != null && v > 0)
    .slice(0, 2);
  if (values.length < 2) return null;
  const [latest, prev] = values;
  if (prev <= 0) return null;
  return ((latest - prev) / prev) * 100;
}

function perShareForExDate(history: EodhdDividendRow[], exYmd: string): number | null {
  const exTime = parseISO(exYmd).getTime();
  const match = history.find((r) => r.date === exYmd && r.value != null && r.value > 0);
  if (match?.value != null) return match.value;
  const prior = history.find((r) => {
    if (r.value == null || r.value <= 0) return false;
    return parseISO(r.date).getTime() <= exTime;
  });
  if (prior?.value != null) return prior.value;
  const latest = history.find((r) => r.value != null && r.value > 0);
  return latest?.value ?? null;
}

function projectExDatesFromHistory(history: EodhdDividendRow[], fromYmd: string, toYmd: string): string[] {
  const dated = history
    .map((r) => r.date)
    .filter((d) => YMD.test(d))
    .sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime());
  if (dated.length < 2) return dated.length === 1 ? [dated[0]!] : [];

  const gaps: number[] = [];
  for (let i = 1; i < dated.length; i++) {
    gaps.push(differenceInCalendarDays(parseISO(dated[i]!), parseISO(dated[i - 1]!)));
  }
  const step = median(gaps);
  if (step == null || step < 20) return [];

  const fromTime = parseISO(fromYmd).getTime();
  const toTime = parseISO(toYmd).getTime();
  const out: string[] = [];
  let cursor = parseISO(dated[dated.length - 1]!);

  while (cursor.getTime() <= toTime) {
    cursor = addDays(cursor, step);
    if (cursor.getTime() >= fromTime && cursor.getTime() <= toTime) {
      out.push(format(cursor, "yyyy-MM-dd"));
    }
  }
  return out;
}

function scheduleWindowForToday(today = new Date()): ScheduleWindow {
  const fromYmd = format(today, "yyyy-MM-dd");
  const paymentToYmd = format(addMonths(today, 12), "yyyy-MM-dd");
  const calendarToYmd = format(addDays(addMonths(today, 12), 45), "yyyy-MM-dd");
  const historyFromYmd = format(addMonths(parseISO(fromYmd), -24), "yyyy-MM-dd");
  return { fromYmd, paymentToYmd, calendarToYmd, historyFromYmd };
}

function yieldPctFromRatio(ratio: number | null): number | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return ratio * 100;
}

async function yieldPctForSymbolUncached(ticker: string): Promise<number | null> {
  const snap = await readPortfolioYieldPctSnapshot(ticker);
  if (snap !== undefined) return snap;

  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;
  const y = yieldPctFromRatio(dividendYieldRatioFromFundamentalsRoot(root));
  void upsertPortfolioYieldPctSnapshot(ticker, y);
  return y;
}

async function loadTickerDividendInputs(
  symbol: string,
  window: ScheduleWindow,
): Promise<{ calendar: Awaited<ReturnType<typeof fetchEodhdDividendsCalendar>>; history: EodhdDividendRow[]; yieldPct: number | null }> {
  const snap = await readPortfolioDividendsInputsSnapshot(
    symbol,
    window.fromYmd,
    window.historyFromYmd,
    window.calendarToYmd,
  );
  if (snap !== undefined) {
    return { calendar: snap.calendar, history: snap.history, yieldPct: snap.yieldPct };
  }

  const [calendar, history, yieldPct] = await Promise.all([
    fetchEodhdDividendsCalendar(symbol, window.fromYmd, window.calendarToYmd),
    fetchEodhdDividendsHistory(symbol, { from: window.historyFromYmd, to: window.calendarToYmd }),
    yieldPctForSymbolUncached(symbol),
  ]);

  void upsertPortfolioDividendsInputsSnapshot(symbol, window.fromYmd, window.historyFromYmd, window.calendarToYmd, {
    calendar,
    history,
    yieldPct,
  });

  return { calendar, history, yieldPct };
}

function scheduleForHolding(
  holding: HoldingInput,
  window: ScheduleWindow,
  inputs: { calendar: Awaited<ReturnType<typeof fetchEodhdDividendsCalendar>>; history: EodhdDividendRow[]; yieldPct: number | null },
): PortfolioDividendScheduleRow[] {
  const routeKey = cryptoRouteBase(holding.symbol);
  if (isSupportedCryptoAssetSymbol(routeKey)) return [];
  if (!Number.isFinite(holding.shares) || holding.shares <= 0) return [];

  const symbol = holding.symbol.trim().toUpperCase();
  if (!symbol) return [];

  const { calendar, history, yieldPct } = inputs;
  const historySorted = [...history].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime(),
  );

  const calendarDates = new Set(calendar.map((c) => c.date));
  const projectedDates = projectExDatesFromHistory(historySorted, window.fromYmd, window.calendarToYmd);
  const exDates = new Set<string>([...calendarDates, ...projectedDates]);

  const paymentLag = medianPaymentLagDays(historySorted);
  const frequencyLabel = inferFrequencyLabel(
    [...exDates].sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime()),
  );
  const growthPct = dividendGrowthPct(historySorted);

  const rows: PortfolioDividendScheduleRow[] = [];

  for (const exYmd of [...exDates].sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime())) {
    const perShare = perShareForExDate(historySorted, exYmd);
    if (perShare == null || perShare <= 0) continue;

    const paymentDate = format(addDays(parseISO(exYmd), paymentLag), "yyyy-MM-dd");
    if (paymentDate < window.fromYmd || paymentDate > window.paymentToYmd) continue;

    rows.push({
      symbol,
      paymentDate,
      exDividendDate: exYmd,
      status: calendarDates.has(exYmd) ? "declared" : "estimated",
      totalUsd: perShare * holding.shares,
      perShareUsd: perShare,
      shares: holding.shares,
      frequencyLabel,
      growthPct,
      yieldPct,
    });
  }

  return rows;
}

function normalizeHoldings(holdings: HoldingInput[]): HoldingInput[] {
  return holdings
    .map((h) => ({
      symbol: h.symbol?.trim().toUpperCase() ?? "",
      shares: h.shares,
    }))
    .filter((h) => {
      if (!h.symbol) return false;
      if (isSupportedCryptoAssetSymbol(cryptoRouteBase(h.symbol))) return false;
      return Number.isFinite(h.shares) && h.shares > 0;
    });
}

function holdingsCacheKey(holdings: HoldingInput[]): string {
  return [...holdings]
    .map((h) => `${h.symbol}:${h.shares}`)
    .sort()
    .join("|");
}

async function buildPortfolioDividendsScheduleUncached(
  holdings: HoldingInput[],
  windowKey: string,
): Promise<PortfolioDividendsSchedulePayload> {
  void windowKey;
  const window = scheduleWindowForToday();
  const eligible = normalizeHoldings(holdings);

  const inputsBySymbol = new Map<
    string,
    { calendar: Awaited<ReturnType<typeof fetchEodhdDividendsCalendar>>; history: EodhdDividendRow[]; yieldPct: number | null }
  >();
  const uniqueSymbols = [...new Set(eligible.map((h) => h.symbol))];

  await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      const inputs = await loadTickerDividendInputs(symbol, window);
      inputsBySymbol.set(symbol, inputs);
    }),
  );

  const perHolding = eligible.map((h) =>
    scheduleForHolding(h, window, inputsBySymbol.get(h.symbol)!),
  );
  const flat = perHolding.flat();

  const byMonth = new Map<string, PortfolioDividendScheduleRow[]>();
  for (const row of flat) {
    const key = format(startOfMonth(parseISO(row.paymentDate)), "yyyy-MM");
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }

  const months: PortfolioDividendScheduleMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, rows]) => {
      const sortedRows = [...rows].sort(
        (a, b) => parseISO(a.paymentDate).getTime() - parseISO(b.paymentDate).getTime(),
      );
      const totalUsd = sortedRows.reduce((s, r) => s + r.totalUsd, 0);
      const labelDate = parseISO(`${monthKey}-01`);
      return {
        monthKey,
        label: format(labelDate, "MMMM yy"),
        totalUsd,
        rows: sortedRows,
      };
    });

  return { months };
}

const getCachedPortfolioDividendsSchedule = unstable_cache(
  async (holdingsJson: string, windowKey: string) => {
    const holdings = JSON.parse(holdingsJson) as HoldingInput[];
    return buildPortfolioDividendsScheduleUncached(holdings, windowKey);
  },
  ["portfolio-dividends-schedule-v1"],
  { revalidate: REVALIDATE_HOT },
);

export async function buildPortfolioDividendsSchedule(
  holdings: HoldingInput[],
): Promise<PortfolioDividendsSchedulePayload> {
  const window = scheduleWindowForToday();
  const windowKey = `${window.fromYmd}|${window.paymentToYmd}|${window.calendarToYmd}`;
  const normalized = normalizeHoldings(holdings);
  const holdingsJson = JSON.stringify(
    normalized.map((h) => ({ symbol: h.symbol, shares: h.shares })),
  );
  return getCachedPortfolioDividendsSchedule(holdingsJson, windowKey);
}
