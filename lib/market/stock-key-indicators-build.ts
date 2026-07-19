import "server-only";

import { parseUnknownDateToUtcMs } from "@/lib/market/eodhd-fundamentals";
import { buildStockTargetPricePayload } from "@/lib/market/stock-target-price-payload";
import type {
  StockKeyIndicator,
  StockKeyIndicatorDirection,
  StockKeyIndicatorPart,
} from "@/lib/market/stock-key-indicators-types";

export const KEY_INDICATORS_BENCHMARK_SYMBOL = "GSPC.INDX";
export const KEY_INDICATORS_EARNINGS_WINDOW_DAYS = 21;
export const KEY_INDICATORS_MAX_LINES = 6;
export const KEY_INDICATORS_MIN_LINES = 2;

export const KEY_INDICATORS_HOT_TTL_MS = 24 * 60 * 60 * 1000;
export const KEY_INDICATORS_SLOW_TTL_MS = 4 * 24 * 60 * 60 * 1000;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstNum(obj: Record<string, unknown> | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const n = num(obj[k]);
    if (n != null) return n;
  }
  return null;
}

function asPercentDisplay(raw: number): number {
  return Math.abs(raw) <= 2 ? raw * 100 : raw;
}

function fmtPct(n: number, digits = 2): string {
  return `${Math.abs(n).toFixed(digits)}%`;
}

function indicator(
  id: StockKeyIndicator["id"],
  direction: StockKeyIndicatorDirection,
  parts: StockKeyIndicatorPart[],
): StockKeyIndicator {
  return { id, direction, parts };
}

function startOfTodayUtcMs(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
}

function earningsRowIsReported(row: Record<string, unknown>): boolean {
  const reported = row.reported ?? row.Reported ?? row.isReported;
  if (typeof reported === "boolean") return reported;
  if (typeof reported === "string") return reported.toLowerCase() === "true" || reported === "1";
  const eps = num(row.epsActual ?? row.EpsActual ?? row.actual ?? row.Actual);
  return eps != null;
}

function earningsRowHasReportDate(row: Record<string, unknown>): boolean {
  const raw = row.reportDate ?? row.ReportDate ?? row.report_date;
  return typeof raw === "string" && raw.trim().length > 0;
}

/** Next upcoming earnings day (UTC midnight), or null when only past / missing. */
export function resolveNextEarningsDayStartUtcMs(
  root: Record<string, unknown>,
  now = new Date(),
): number | null {
  const startToday = startOfTodayUtcMs(now);
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return null;

  const e = earn as Record<string, unknown>;
  const history = e.History;
  if (!history || typeof history !== "object") {
    const direct =
      parseUnknownDateToUtcMs(e.NextEarningsDate ?? e.NextReportDate ?? e.EarningsDate ?? e.NextEarningDate) ??
      null;
    if (direct == null) return null;
    const dayStart = Date.UTC(
      new Date(direct).getUTCFullYear(),
      new Date(direct).getUTCMonth(),
      new Date(direct).getUTCDate(),
      0,
      0,
      0,
      0,
    );
    return dayStart >= startToday ? dayStart : null;
  }

  const rows: Record<string, unknown>[] = [];
  for (const row of Object.values(history as Record<string, unknown>)) {
    if (row && typeof row === "object") rows.push(row as Record<string, unknown>);
  }

  let anyFutureWithReport = false;
  for (const r of rows) {
    const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
    const rawDate = r.date ?? r.Date;
    const primary = (typeof rawReport === "string" && rawReport.trim() ? rawReport : null) ?? rawDate;
    const ms = parseUnknownDateToUtcMs(primary);
    if (ms == null) continue;
    const dayStart = Date.UTC(
      new Date(ms).getUTCFullYear(),
      new Date(ms).getUTCMonth(),
      new Date(ms).getUTCDate(),
      0,
      0,
      0,
      0,
    );
    if (dayStart >= startToday && earningsRowHasReportDate(r) && !earningsRowIsReported(r)) {
      anyFutureWithReport = true;
      break;
    }
  }

  let bestUpcomingMs: number | null = null;
  for (const r of rows) {
    const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
    const rawDate = r.date ?? r.Date;
    const primary = (typeof rawReport === "string" && rawReport.trim() ? rawReport : null) ?? rawDate;
    const ms = parseUnknownDateToUtcMs(primary);
    if (ms == null) continue;
    const dayStart = Date.UTC(
      new Date(ms).getUTCFullYear(),
      new Date(ms).getUTCMonth(),
      new Date(ms).getUTCDate(),
      0,
      0,
      0,
      0,
    );
    if (dayStart < startToday) continue;
    if (earningsRowIsReported(r)) continue;
    if (anyFutureWithReport && !earningsRowHasReportDate(r)) continue;
    if (bestUpcomingMs == null || dayStart < bestUpcomingMs) bestUpcomingMs = dayStart;
  }

  return bestUpcomingMs;
}

export function isKeyIndicatorsEligibleFundamentalsRoot(root: Record<string, unknown> | null): boolean {
  if (!root) return false;
  const gen = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const type = String(gen?.Type ?? "").toLowerCase();
  const sector = String(hl?.Sector ?? gen?.Sector ?? "").toLowerCase();
  if (type.includes("etf") || type.includes("fund") || sector.includes("etf")) return false;
  return true;
}

export function buildVsSp500YtdIndicator(stockYtd: number | null, benchYtd: number | null): StockKeyIndicator | null {
  if (stockYtd == null || benchYtd == null) return null;
  const rel = stockYtd - benchYtd;
  const direction: StockKeyIndicatorDirection = rel >= 0 ? "up" : "down";
  const pct = fmtPct(rel);
  if (rel >= 0) {
    return indicator("vs_sp500_ytd", direction, [
      { kind: "text", value: "Outperforming S&P 500 by " },
      { kind: "emphasis", value: pct },
      { kind: "text", value: " YTD" },
    ]);
  }
  return indicator("vs_sp500_ytd", direction, [
    { kind: "text", value: "Underperforming S&P 500 by " },
    { kind: "emphasis", value: pct },
    { kind: "text", value: " YTD" },
  ]);
}

function buildEarningsCountdownIndicator(
  root: Record<string, unknown>,
  now = new Date(),
): StockKeyIndicator | null {
  const dayStart = resolveNextEarningsDayStartUtcMs(root, now);
  if (dayStart == null) return null;

  const days = Math.round((dayStart - startOfTodayUtcMs(now)) / (24 * 60 * 60 * 1000));
  if (days < 0 || days >= KEY_INDICATORS_EARNINGS_WINDOW_DAYS) return null;

  if (days === 0) {
    return indicator("earnings_countdown", "neutral", [
      { kind: "text", value: "Reports earnings " },
      { kind: "emphasis", value: "today" },
    ]);
  }
  if (days === 1) {
    return indicator("earnings_countdown", "neutral", [
      { kind: "text", value: "Reports earnings " },
      { kind: "emphasis", value: "tomorrow" },
    ]);
  }
  return indicator("earnings_countdown", "neutral", [
    { kind: "text", value: "Reports earnings in " },
    { kind: "emphasis", value: String(days) },
    { kind: "text", value: " days" },
  ]);
}

function extractEpsGrowthForecastPct(root: Record<string, unknown>): number | null {
  const earn = root.Earnings;
  if (earn && typeof earn === "object") {
    const trend = (earn as Record<string, unknown>).Trend;
    if (trend && typeof trend === "object") {
      for (const row of Object.values(trend as Record<string, unknown>)) {
        if (!row || typeof row !== "object") continue;
        const growth = num((row as Record<string, unknown>).earningsEstimateGrowth);
        if (growth != null) return asPercentDisplay(growth);
      }
    }
  }

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const fromHl = firstNum(hl, [
    "EPSEstimateGrowth",
    "EarningsGrowth",
    "FiveYearAnnualEPSGrowthRate",
    "EPSGrowth5Y",
    "EPSGrowth3Y",
  ]);
  return fromHl != null ? asPercentDisplay(fromHl) : null;
}

export type BuildSlowKeyIndicatorsInput = {
  root: Record<string, unknown>;
  price: number | null;
  now?: Date;
};

export function buildSlowKeyIndicators(input: BuildSlowKeyIndicatorsInput): StockKeyIndicator[] {
  const { root, price, now = new Date() } = input;
  if (!isKeyIndicatorsEligibleFundamentalsRoot(root)) return [];

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const tech = root.Technicals && typeof root.Technicals === "object" ? (root.Technicals as Record<string, unknown>) : null;
  const gen = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;

  const out: StockKeyIndicator[] = [];

  const targetPayload = buildStockTargetPricePayload(root);
  const target = targetPayload.consensusTarget ?? targetPayload.wallStreetTarget;
  if (price != null && target != null && target > 0) {
    const pctVsTarget = ((price - target) / target) * 100;
    // Above target = rich / overpriced (con); below target = discount to consensus (pro).
    const direction: StockKeyIndicatorDirection = pctVsTarget >= 0 ? "down" : "up";
    const pct = fmtPct(pctVsTarget);
    out.push(
      indicator("vs_analyst_target", direction, [
        { kind: "text", value: "Trading at " },
        { kind: "emphasis", value: pct },
        { kind: "text", value: pctVsTarget >= 0 ? " above analyst target" : " below estimates" },
      ]),
    );
  }

  const epsGrowth = extractEpsGrowthForecastPct(root);
  if (epsGrowth != null) {
    const direction: StockKeyIndicatorDirection = epsGrowth >= 0 ? "up" : "down";
    out.push(
      indicator("eps_growth_forecast", direction, [
        { kind: "text", value: "Earnings are forecast to grow " },
        { kind: "emphasis", value: fmtPct(epsGrowth) },
        { kind: "text", value: " per year" },
      ]),
    );
  }

  const revYoyRaw = firstNum(hl, [
    "QuarterlyRevenueGrowth",
    "RevenueGrowthQuarterlyYoY",
    "QuarterlyRevenueGrowthYOY",
    "RevenueQuarterlyGrowth",
    "QuarterlyRevenueGrowthYoy",
  ]);
  if (revYoyRaw != null) {
    const revYoy = asPercentDisplay(revYoyRaw);
    const direction: StockKeyIndicatorDirection = revYoy >= 0 ? "up" : "down";
    out.push(
      indicator("revenue_yoy", direction, [
        { kind: "text", value: "Revenue grew " },
        { kind: "emphasis", value: fmtPct(revYoy) },
        { kind: "text", value: " year-over-year (last quarter)" },
      ]),
    );
  }

  const trailingPe = firstNum(hl, ["PERatio", "PE", "TrailingPE"]) ?? firstNum(val, ["TrailingPE"]);
  const forwardPe = firstNum(hl, ["ForwardPE"]) ?? firstNum(val, ["ForwardPE"]);
  if (trailingPe != null && forwardPe != null && trailingPe > 0) {
    const premium = ((forwardPe - trailingPe) / trailingPe) * 100;
    const direction: StockKeyIndicatorDirection = premium <= 0 ? "up" : "down";
    out.push(
      indicator("forward_vs_trailing_pe", direction, [
        {
          kind: "text",
          value:
            premium <= 0
              ? `Forward P/E (${forwardPe.toFixed(1)}×) is ${Math.abs(premium).toFixed(0)}% below trailing (${trailingPe.toFixed(1)}×)`
              : `Forward P/E (${forwardPe.toFixed(1)}×) is ${Math.abs(premium).toFixed(0)}% above trailing (${trailingPe.toFixed(1)}×)`,
        },
      ]),
    );
  } else {
    const beta = firstNum(tech, ["Beta", "Beta5Y"]) ?? firstNum(gen, ["Beta"]) ?? firstNum(hl, ["Beta"]);
    if (beta != null) {
      const direction: StockKeyIndicatorDirection = beta > 1.1 ? "down" : beta < 0.9 ? "up" : "neutral";
      const text =
        beta > 1.1
          ? `More volatile than the market (beta ${beta.toFixed(2)})`
          : beta < 0.9
            ? `Less volatile than the market (beta ${beta.toFixed(2)})`
            : `Market-like volatility (beta ${beta.toFixed(2)})`;
      out.push(indicator("beta", direction, [{ kind: "text", value: text }]));
    }
  }

  const earningsLine = buildEarningsCountdownIndicator(root, now);
  if (earningsLine) out.push(earningsLine);

  return out;
}

export function mergeKeyIndicatorsForDisplay(
  slowIndicators: StockKeyIndicator[],
  hotIndicator: StockKeyIndicator | null,
): StockKeyIndicator[] {
  const withoutYtd = slowIndicators.filter((i) => i.id !== "vs_sp500_ytd");
  const merged: StockKeyIndicator[] = [];
  if (hotIndicator) merged.push(hotIndicator);

  for (const ind of withoutYtd) {
    if (merged.length >= KEY_INDICATORS_MAX_LINES) break;
    if (ind.id === "earnings_countdown") continue;
    if (ind.id === "vs_analyst_target") {
      const text = ind.parts.map((part) => part.value).join("");
      const direction: StockKeyIndicatorDirection = text.includes(" above analyst target")
        ? "down"
        : text.includes(" below estimates")
          ? "up"
          : ind.direction;
      merged.push(direction === ind.direction ? ind : { ...ind, direction });
      continue;
    }
    merged.push(ind);
  }

  const earnings = withoutYtd.find((i) => i.id === "earnings_countdown");
  if (earnings && merged.length < KEY_INDICATORS_MAX_LINES) {
    merged.push(earnings);
  } else if (earnings && merged.length >= KEY_INDICATORS_MAX_LINES) {
    merged[merged.length - 1] = earnings;
  }

  return merged.slice(0, KEY_INDICATORS_MAX_LINES);
}

export function keyIndicatorsResponseIsRenderable(indicators: StockKeyIndicator[]): boolean {
  return indicators.length >= KEY_INDICATORS_MIN_LINES;
}
