import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { getCryptoLiveQuotes } from "@/lib/market/crypto-live-quotes";
import { cryptoUtcDayChangePct } from "@/lib/market/crypto-live-quotes-shared";
import { ALL_CRYPTO_METAS } from "@/lib/market/crypto-meta";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdSplitsHistory } from "@/lib/market/eodhd-splits-dividends";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { STOCK_CHART_ALL_LOOKBACK_YEARS } from "@/lib/market/stock-chart-types";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import { readUsQuotesBulkMap, usQuotesBulkKey } from "@/lib/market/us-quotes-bulk";
import { buildMarketNotifyInterestMaps, type TickerInterestMap } from "@/lib/notifications/earnings-notify-universe";
import {
  CRYPTO_MOVE_TIERS,
  MARKET_HIGH_LOW_KIND,
  MARKET_PRICE_MOVE_KIND,
  SPLIT_CHECK_MIN_MOVE_PCT,
  STOCK_MOVE_TIERS,
  detectHighLow,
  highLowCopy,
  highLowEventKey,
  lastCloseBefore,
  looksLikeUnadjustedSplit,
  priceExtremesFromCloses,
  priceMoveCopy,
  priceMoveEventKeys,
  priceMoveTier,
  referenceCloseMatchesHistory,
  type HighLowHit,
  type PriceExtremes,
} from "@/lib/notifications/market-alerts-model";
import { loadMarketAlertsDisabledUserIds } from "@/lib/notifications/notification-preferences-store";
import { isEarningsNotifiableTicker } from "@/lib/notifications/ticker-notify-eligibility";
import {
  insertUserNotificationsAndPush,
  type NewUserNotificationRow,
} from "@/lib/notifications/user-notifications-store";
import { loadPortfolioSymbolEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { nyCalendarYmd } from "@/lib/screener/screener-us-market-cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { WATCHLIST_CRYPTO_PREFIX } from "@/lib/watchlist/constants";

export type MarketAlertsScopeResult = {
  skipped: boolean;
  skipReason?: string;
  followed: number;
  quoted: number;
  /** Followed assets left out because the quote and history disagree (split day, bad print). */
  guarded: number;
  candidateEvents: number;
  newEvents: number;
  notificationsCreated: number;
};

export type MarketAlertsIngestResult = {
  stocks: MarketAlertsScopeResult;
  crypto: MarketAlertsScopeResult;
};

type AssetKind = "stock" | "crypto";

type Quoted = {
  /** Key in the interest map (`AAPL`, `BTC`). */
  key: string;
  price: number;
  /** Basis for the day's change: previous close (stocks) or UTC-day open (crypto). */
  referenceClose: number | null;
  changePct: number | null;
  /** Session date the move belongs to: ET for stocks, UTC for crypto. */
  dayYmd: string;
};

type Candidate = {
  quoted: Quoted;
  kind: typeof MARKET_PRICE_MOVE_KIND | typeof MARKET_HIGH_LOW_KIND;
  /** Keys recorded in `market_alert_events`; the first is the one users are notified for. */
  eventKeys: string[];
  hit?: HighLowHit;
};

type Identity = { name: string; logoUrl?: string };

type ScopeConfig = {
  assetKind: AssetKind;
  tiers: readonly number[];
  /** Ticker stored on events + notifications (`AAPL`, `CRYPTO:BTC`). */
  storedTicker: (key: string) => string;
  href: (key: string) => string;
  identity: (key: string) => Promise<Identity>;
};

const BARS_CONCURRENCY = 6;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymdUtc(d);
}

/** Same range as the stock page performance table so both share the cached daily series. */
function dailyHistoryRange(now: Date): { from: string; to: string } {
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  return { from: ymdUtc(fromDate), to: ymdUtc(now) };
}

type History = { extremes: PriceExtremes | null; lastClose: number | null };

async function loadHistory(symbol: string, dayYmd: string, now: Date): Promise<History> {
  const { from, to } = dailyHistoryRange(now);
  try {
    const bars = await loadPortfolioSymbolEodBars(symbol, from, to);
    return { extremes: priceExtremesFromCloses(bars, dayYmd), lastClose: lastCloseBefore(bars, dayYmd) };
  } catch {
    return { extremes: null, lastClose: null };
  }
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** A split around the session date, or a move that sits exactly on a split ratio. */
async function stockSplitSuspected(q: Quoted): Promise<boolean> {
  if (q.changePct == null || Math.abs(q.changePct) < SPLIT_CHECK_MIN_MOVE_PCT) return false;
  if (q.referenceClose != null && looksLikeUnadjustedSplit(q.price, q.referenceClose)) return true;
  try {
    const splits = await fetchEodhdSplitsHistory(q.key, { from: shiftYmd(q.dayYmd, -5), to: shiftYmd(q.dayYmd, 1) });
    return splits.length > 0;
  } catch {
    return true;
  }
}

function buildCandidates(q: Quoted, history: History, tiers: readonly number[]): Candidate[] {
  const out: Candidate[] = [];
  const move = q.referenceClose != null && q.referenceClose > 0 ? priceMoveTier(q.changePct, tiers) : null;
  if (move) {
    out.push({
      quoted: q,
      kind: MARKET_PRICE_MOVE_KIND,
      eventKeys: priceMoveEventKeys(q.dayYmd, move.direction, move.tier, tiers).reverse(),
    });
  }
  if (history.extremes) {
    for (const hit of detectHighLow(q.price, history.extremes)) {
      out.push({ quoted: q, kind: MARKET_HIGH_LOW_KIND, eventKeys: [highLowEventKey(hit.side, q.dayYmd)], hit });
    }
  }
  return out;
}

/** Records events globally (one row per asset + key). Returns `${ticker}|${key}` for keys that did not exist yet. */
async function recordNewEvents(
  admin: SupabaseClient,
  config: ScopeConfig,
  candidates: readonly Candidate[],
): Promise<Set<string>> {
  const rows = candidates.flatMap((c) =>
    c.eventKeys.map((eventKey) => ({
      ticker: config.storedTicker(c.quoted.key),
      event_key: eventKey,
      kind: c.kind,
      payload: {
        price: c.quoted.price,
        previousClose: c.quoted.referenceClose,
        changePct: c.quoted.changePct,
        level: c.hit?.level ?? null,
        previous: c.hit?.previous ?? null,
      },
    })),
  );
  if (rows.length === 0) return new Set();
  const { data, error } = await admin
    .from("market_alert_events")
    .upsert(rows, { onConflict: "ticker,event_key", ignoreDuplicates: true })
    .select("ticker,event_key");
  if (error) throw new Error(`market_alert_events_insert_failed: ${error.message}`);
  return new Set((data ?? []).map((r) => `${r.ticker}|${r.event_key}`));
}

async function fanOut(
  admin: SupabaseClient,
  config: ScopeConfig,
  interest: TickerInterestMap,
  fresh: readonly Candidate[],
  disabled: { highLow: Set<string>; priceMoves: Set<string> },
): Promise<number> {
  const identityByKey = new Map<string, Promise<Identity>>();
  const rows: NewUserNotificationRow[] = [];

  for (const c of fresh) {
    const key = c.quoted.key;
    const users = interest.get(key);
    if (!users?.size) continue;
    const optedOut = c.kind === MARKET_PRICE_MOVE_KIND ? disabled.priceMoves : disabled.highLow;
    const recipients = [...users].filter((u) => !optedOut.has(u));
    if (recipients.length === 0) continue;

    let pending = identityByKey.get(key);
    if (!pending) {
      pending = config.identity(key);
      identityByKey.set(key, pending);
    }
    const { name, logoUrl } = await pending;
    const displayTicker = key;
    const changePct = c.quoted.changePct ?? 0;
    const copy = c.hit
      ? highLowCopy({ ticker: displayTicker, companyName: name, price: c.quoted.price, hit: c.hit })
      : priceMoveCopy({ ticker: displayTicker, companyName: name, price: c.quoted.price, changePct });
    const storedTicker = config.storedTicker(key);
    const payload: Record<string, unknown> = {
      assetKind: config.assetKind,
      symbol: key,
      companyName: name,
      logoUrl,
      price: c.quoted.price,
      previousClose: c.quoted.referenceClose,
      changePct,
      quoteDate: c.quoted.dayYmd,
      ...(c.hit ? { level: c.hit.level, previousExtreme: c.hit.previous } : {}),
    };
    for (const userId of recipients) {
      rows.push({
        user_id: userId,
        kind: c.kind,
        ticker: storedTicker,
        title: copy.title,
        body: copy.body,
        href: config.href(key),
        payload,
        dedupe_key: `${storedTicker}:${c.eventKeys[0]}`,
      });
    }
  }

  return insertUserNotificationsAndPush(admin, rows);
}

function emptyScope(skipReason: string, extra: Partial<MarketAlertsScopeResult> = {}): MarketAlertsScopeResult {
  return {
    skipped: true,
    skipReason,
    followed: 0,
    quoted: 0,
    guarded: 0,
    candidateEvents: 0,
    newEvents: 0,
    notificationsCreated: 0,
    ...extra,
  };
}

async function runScope(
  admin: SupabaseClient,
  config: ScopeConfig,
  interest: TickerInterestMap,
  quoted: readonly Quoted[],
  now: Date,
  disabledPromise: () => Promise<{ highLow: Set<string>; priceMoves: Set<string> }>,
): Promise<MarketAlertsScopeResult> {
  const base = { skipped: false, followed: interest.size, quoted: quoted.length };
  if (quoted.length === 0) return emptyScope("no_quotes", { followed: interest.size });

  const histories = await mapWithConcurrency(quoted, BARS_CONCURRENCY, (q) => loadHistory(q.key, q.dayYmd, now));

  let guarded = 0;
  const candidates: Candidate[] = [];
  for (let i = 0; i < quoted.length; i++) {
    const q = quoted[i]!;
    const history = histories[i]!;
    if (!referenceCloseMatchesHistory(q.referenceClose, history.lastClose)) {
      guarded += 1;
      continue;
    }
    const found = buildCandidates(q, history, config.tiers);
    if (found.length === 0) continue;
    if (config.assetKind === "stock" && (await stockSplitSuspected(q))) {
      guarded += 1;
      continue;
    }
    candidates.push(...found);
  }

  if (candidates.length === 0) return { ...base, guarded, candidateEvents: 0, newEvents: 0, notificationsCreated: 0 };

  const newKeys = await recordNewEvents(admin, config, candidates);
  // A move notifies only when its highest tier is new (jumping straight to 10% also records 5%, silently).
  const fresh = candidates.filter((c) => newKeys.has(`${config.storedTicker(c.quoted.key)}|${c.eventKeys[0]}`));
  const notificationsCreated =
    fresh.length > 0 ? await fanOut(admin, config, interest, fresh, await disabledPromise()) : 0;
  return { ...base, guarded, candidateEvents: candidates.length, newEvents: newKeys.size, notificationsCreated };
}

const STOCK_SCOPE: ScopeConfig = {
  assetKind: "stock",
  tiers: STOCK_MOVE_TIERS,
  storedTicker: (key) => key,
  href: (key) => `/stock/${encodeURIComponent(key)}`,
  identity: async (key) => {
    const root = await fetchEodhdFundamentalsJson(key).catch(() => null);
    const general =
      root?.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
    const nameRaw = general?.Name ?? general?.CompanyName;
    return {
      name: typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : key,
      logoUrl: logoUrlFromFundamentalsRoot(root, key) || undefined,
    };
  },
};

const CRYPTO_NAME_BY_SYMBOL = new Map(ALL_CRYPTO_METAS.map((m) => [m.symbol.toUpperCase(), m.name]));

const CRYPTO_SCOPE: ScopeConfig = {
  assetKind: "crypto",
  tiers: CRYPTO_MOVE_TIERS,
  storedTicker: (key) => `${WATCHLIST_CRYPTO_PREFIX}${key}`,
  href: (key) => `/crypto/${encodeURIComponent(key)}`,
  identity: async (key) => ({
    name: CRYPTO_NAME_BY_SYMBOL.get(key) ?? key,
    logoUrl: getCryptoLogoUrl(key) || undefined,
  }),
};

async function stockQuotes(interest: TickerInterestMap, now: Date): Promise<Quoted[] | null> {
  const quotes = await readUsQuotesBulkMap();
  if (!quotes) return null;
  const todayYmd = nyCalendarYmd(now);
  const out: Quoted[] = [];
  for (const key of interest.keys()) {
    if (!isEarningsNotifiableTicker(key)) continue;
    const quote = quotes.get(usQuotesBulkKey(key));
    if (!quote?.tsSec) continue;
    const dayYmd = nyCalendarYmd(new Date(quote.tsSec * 1000));
    // Halted / untraded today: the row still carries an older session's change.
    if (dayYmd !== todayYmd) continue;
    out.push({ key, price: quote.price, referenceClose: quote.previousClose, changePct: quote.changePct, dayYmd });
  }
  return out;
}

async function cryptoQuotes(interest: TickerInterestMap, now: Date): Promise<Quoted[]> {
  const live = await getCryptoLiveQuotes([...interest.keys()]);
  const dayYmd = ymdUtc(now);
  const out: Quoted[] = [];
  for (const key of interest.keys()) {
    const q = live[key];
    if (!q || q.utcOpen == null) continue;
    out.push({
      key,
      price: q.price,
      referenceClose: q.utcOpen,
      changePct: cryptoUtcDayChangePct(q.price, q.utcOpen),
      dayYmd,
    });
  }
  return out;
}

/**
 * Cron step for the Market notifications (free):
 * - Stocks: ±5% / ±10% vs previous close during US regular + post session, from the 15-minute bulk
 *   quote snapshot (no extra provider calls).
 * - Crypto: ±10% / ±20% vs the UTC-day open (same basis as list 1D %), 24/7, from the free exchange feed.
 * - Both: new 52-week / all-time closing highs and lows from the cached daily series, at most one
 *   high and one low per asset per week.
 * Each event fires once per asset, then fans out to watchers and holders.
 */
export async function ingestMarketAlerts(now: Date = new Date()): Promise<MarketAlertsIngestResult> {
  return runWithProviderTrace("cron/market-alerts", async () => {
    const admin = getSupabaseAdminClient();
    if (!admin) return { stocks: emptyScope("no_supabase_admin"), crypto: emptyScope("no_supabase_admin") };

    const interest = await buildMarketNotifyInterestMaps(admin);
    let disabled: Promise<{ highLow: Set<string>; priceMoves: Set<string> }> | null = null;
    const loadDisabled = () => (disabled ??= loadMarketAlertsDisabledUserIds(admin));

    const session = getUsEquityMarketSession(now);
    const stocksPromise = (async (): Promise<MarketAlertsScopeResult> => {
      if (session !== "regular" && session !== "post") return emptyScope(`session_${session}`);
      const quoted = await stockQuotes(interest.stocks, now);
      if (!quoted) return emptyScope("no_bulk_quotes", { followed: interest.stocks.size });
      return runScope(admin, STOCK_SCOPE, interest.stocks, quoted, now, loadDisabled);
    })();

    const cryptoPromise = (async (): Promise<MarketAlertsScopeResult> => {
      if (interest.crypto.size === 0) return emptyScope("no_followers");
      const quoted = await cryptoQuotes(interest.crypto, now);
      return runScope(admin, CRYPTO_SCOPE, interest.crypto, quoted, now, loadDisabled);
    })();

    const [stocks, crypto] = await Promise.all([stocksPromise, cryptoPromise]);
    return { stocks, crypto };
  });
}
