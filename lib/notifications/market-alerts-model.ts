/**
 * Market notifications (free): ±5% / ±10% daily moves and new 52-week / all-time highs and lows
 * for watchlist + held stocks. Pure helpers so detection is unit-testable.
 */

export const MARKET_PRICE_MOVE_KIND = "market_price_move";
export const MARKET_HIGH_LOW_KIND = "market_high_low";

export type MarketAlertKind = typeof MARKET_PRICE_MOVE_KIND | typeof MARKET_HIGH_LOW_KIND;

export function isMarketAlertKind(kind: string | null | undefined): kind is MarketAlertKind {
  return kind === MARKET_PRICE_MOVE_KIND || kind === MARKET_HIGH_LOW_KIND;
}

/** Robinhood-style tiers: one alert at ±5%, another at ±10%, per stock per day per direction. */
export const STOCK_MOVE_TIERS: readonly number[] = [5, 10];
/** Crypto routinely moves 5% in a UTC day, so its tiers sit higher. */
export const CRYPTO_MOVE_TIERS: readonly number[] = [10, 20];
export type MoveDirection = "up" | "down";

/** Highest tier reached by the day's change, or null below the first tier. */
export function priceMoveTier(
  changePct: number | null | undefined,
  tiers: readonly number[] = STOCK_MOVE_TIERS,
): { direction: MoveDirection; tier: number } | null {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  const abs = Math.abs(changePct);
  let tier: number | null = null;
  for (const t of tiers) if (abs >= t) tier = t;
  if (tier == null) return null;
  return { direction: changePct > 0 ? "up" : "down", tier };
}

/** Event keys for every tier up to the one reached — recording lower tiers too stops a 10% day from later re-firing at 5%. */
export function priceMoveEventKeys(
  quoteYmd: string,
  direction: MoveDirection,
  tier: number,
  tiers: readonly number[] = STOCK_MOVE_TIERS,
): string[] {
  return tiers.filter((t) => t <= tier).map((t) => priceMoveEventKey(quoteYmd, direction, t));
}

export function priceMoveEventKey(quoteYmd: string, direction: MoveDirection, tier: number): string {
  return `move:${quoteYmd}:${direction}:${tier}`;
}

/** Last close strictly before `beforeYmd` (bars ascending). */
export function lastCloseBefore(bars: readonly CloseBar[], beforeYmd: string): number | null {
  for (let i = bars.length - 1; i >= 0; i--) {
    const b = bars[i]!;
    if (b.date < beforeYmd && Number.isFinite(b.close) && b.close > 0) return b.close;
  }
  return null;
}

/**
 * The quote's reference close must agree with the history we compare against. On a split day one
 * side is often adjusted and the other not (or the feed glitches) — then every comparison is wrong.
 */
export function referenceCloseMatchesHistory(
  referenceClose: number | null | undefined,
  historyClose: number | null | undefined,
  tolerance = 0.25,
): boolean {
  if (referenceClose == null || historyClose == null) return true;
  if (!(referenceClose > 0) || !(historyClose > 0)) return true;
  return Math.abs(referenceClose / historyClose - 1) <= tolerance;
}

/** Moves this large get a corporate-action check before anyone is alerted. */
export const SPLIT_CHECK_MIN_MOVE_PCT = 25;

const SPLIT_FACTORS = [2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100];

/**
 * Price / previous close sits on a common split ratio (1:2 … 1:100 or reverse) and the move is
 * implausibly large — an unadjusted previous close, not a real crash or rally.
 */
export function looksLikeUnadjustedSplit(price: number, previousClose: number): boolean {
  if (!(price > 0) || !(previousClose > 0)) return false;
  const ratio = price / previousClose;
  if (ratio > 0.55 && ratio < 1.8) return false;
  return SPLIT_FACTORS.some((f) => Math.abs(ratio * f - 1) <= 0.03 || Math.abs(ratio / f - 1) <= 0.03);
}

export type CloseBar = { date: string; close: number };

export type PriceExtremes = {
  high52w: number;
  low52w: number;
  allTimeHigh: number;
  allTimeLow: number;
};

/** A bar-to-bar change in the adjustment factor beyond this is a split; smaller steps are dividends. */
const SPLIT_FACTOR_STEP = 1.3;

/**
 * As-traded closes restated for splits only. Provider "adjusted" closes also take dividends out of
 * history, which lowers past highs — a dividend payer would then "break" its all-time high while
 * still below the price it actually traded at. Split steps are recovered from the adjusted/raw
 * ratio: dividends move it by a few percent at most, splits by 2× or more.
 */
export function splitAdjustedCloses(
  bars: readonly { date: string; close: number; adjustedClose: number }[],
): CloseBar[] {
  const n = bars.length;
  const out = new Array<CloseBar>(n);
  let factor = 1;
  let nextRatio: number | null = null;
  for (let i = n - 1; i >= 0; i--) {
    const b = bars[i]!;
    const ratio = b.close > 0 && b.adjustedClose > 0 ? b.adjustedClose / b.close : null;
    if (ratio != null && nextRatio != null) {
      const step = ratio / nextRatio;
      if (step > SPLIT_FACTOR_STEP || step < 1 / SPLIT_FACTOR_STEP) factor *= step;
    }
    if (ratio != null) nextRatio = ratio;
    out[i] = { date: b.date, close: b.close * factor };
  }
  return out;
}

/** A year of sessions — younger listings make every move a "record", so they get no high/low alerts. */
export const MIN_BARS_FOR_EXTREMES = 250;

/**
 * Closing-price extremes from bars strictly before `beforeYmd` (today's partial session never counts
 * against itself). 52-week window is the 365 calendar days before `beforeYmd`.
 */
export function priceExtremesFromCloses(bars: readonly CloseBar[], beforeYmd: string): PriceExtremes | null {
  const past = bars.filter((b) => b.date < beforeYmd && Number.isFinite(b.close) && b.close > 0);
  if (past.length < MIN_BARS_FOR_EXTREMES) return null;
  const cutoff = new Date(`${beforeYmd}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 365);
  const cutoffYmd = cutoff.toISOString().slice(0, 10);

  let allTimeHigh = -Infinity;
  let allTimeLow = Infinity;
  let high52w = -Infinity;
  let low52w = Infinity;
  for (const b of past) {
    if (b.close > allTimeHigh) allTimeHigh = b.close;
    if (b.close < allTimeLow) allTimeLow = b.close;
    if (b.date >= cutoffYmd) {
      if (b.close > high52w) high52w = b.close;
      if (b.close < low52w) low52w = b.close;
    }
  }
  if (!Number.isFinite(high52w) || !Number.isFinite(low52w)) return null;
  return { high52w, low52w, allTimeHigh, allTimeLow };
}

export type HighLowLevel = "all_time_high" | "52w_high" | "all_time_low" | "52w_low";

export type HighLowHit = { level: HighLowLevel; side: "high" | "low"; previous: number };

/** A stock that closed at a record ticks past it by a cent the next morning — that is not news. */
export const HIGH_LOW_BREAK_MARGIN = 0.005;

/** Strongest level the price broke through on each side (an all-time high is also a 52-week high — report once). */
export function detectHighLow(price: number, extremes: PriceExtremes): HighLowHit[] {
  if (!Number.isFinite(price) || price <= 0) return [];
  const above = (level: number) => price > level * (1 + HIGH_LOW_BREAK_MARGIN);
  const below = (level: number) => price < level * (1 - HIGH_LOW_BREAK_MARGIN);
  const hits: HighLowHit[] = [];
  if (above(extremes.allTimeHigh)) hits.push({ level: "all_time_high", side: "high", previous: extremes.allTimeHigh });
  else if (above(extremes.high52w)) hits.push({ level: "52w_high", side: "high", previous: extremes.high52w });
  if (below(extremes.allTimeLow)) hits.push({ level: "all_time_low", side: "low", previous: extremes.allTimeLow });
  else if (below(extremes.low52w)) hits.push({ level: "52w_low", side: "low", previous: extremes.low52w });
  return hits;
}

/** ISO week (`2026-W46`) of a `YYYY-MM-DD` date. */
export function isoWeekKey(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** One high and one low alert per stock per week (a stock in a rally would otherwise ping daily). */
export function highLowEventKey(side: "high" | "low", quoteYmd: string): string {
  return `${side}:${isoWeekKey(quoteYmd)}`;
}

export function formatUsdPrice(value: number): string {
  if (value > 0 && value < 0.01) {
    return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`;
}

const LEVEL_LABEL: Record<HighLowLevel, string> = {
  all_time_high: "all-time high",
  "52w_high": "52-week high",
  all_time_low: "all-time low",
  "52w_low": "52-week low",
};

export function highLowLevelLabel(level: HighLowLevel): string {
  return LEVEL_LABEL[level];
}

const LEVEL_TITLE: Record<HighLowLevel, string> = {
  all_time_high: "All-Time High",
  "52w_high": "52-Week High",
  all_time_low: "All-Time Low",
  "52w_low": "52-Week Low",
};

/** `GLXY Price Alert` / `GLXY is up 12.40% to $15.86`. */
export function priceMoveCopy(input: {
  ticker: string;
  companyName: string;
  price: number;
  changePct: number;
}): { title: string; body: string } {
  const pct = Math.abs(input.changePct).toFixed(2);
  const verb = input.changePct > 0 ? "up" : "down";
  return {
    title: `${input.ticker} Price Alert`,
    body: `${input.ticker} is ${verb} ${pct}% to ${formatUsdPrice(input.price)}`,
  };
}

/** `AAPL 52-Week High` / `AAPL hit a new 52-week high of $353.60`. */
export function highLowCopy(input: {
  ticker: string;
  companyName: string;
  price: number;
  hit: HighLowHit;
}): { title: string; body: string } {
  return {
    title: `${input.ticker} ${LEVEL_TITLE[input.hit.level]}`,
    body: `${input.ticker} hit a new ${LEVEL_LABEL[input.hit.level]} of ${formatUsdPrice(input.price)}`,
  };
}
