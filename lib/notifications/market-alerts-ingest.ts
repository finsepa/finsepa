import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { runWithProviderTrace } from "@/lib/market/provider-trace";
import { STOCK_CHART_ALL_LOOKBACK_YEARS } from "@/lib/market/stock-chart-types";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import { readUsQuotesBulkMap, usQuotesBulkKey, type UsBulkQuote } from "@/lib/market/us-quotes-bulk";
import { buildEarningsNotifyInterestMap } from "@/lib/notifications/earnings-notify-universe";
import {
  MARKET_HIGH_LOW_KIND,
  MARKET_PRICE_MOVE_KIND,
  detectHighLow,
  highLowCopy,
  highLowEventKey,
  priceExtremesFromCloses,
  priceMoveCopy,
  priceMoveEventKeys,
  priceMoveTier,
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

export type MarketAlertsIngestResult = {
  skipped: boolean;
  skipReason?: string;
  followedTickers: number;
  quotedToday: number;
  candidateEvents: number;
  newEvents: number;
  notificationsCreated: number;
};

type Candidate = {
  ticker: string;
  kind: typeof MARKET_PRICE_MOVE_KIND | typeof MARKET_HIGH_LOW_KIND;
  /** Keys recorded in `market_alert_events`; the first is the one users are notified for. */
  eventKeys: string[];
  quote: UsBulkQuote;
  quoteYmd: string;
  hit?: HighLowHit;
};

const BARS_CONCURRENCY = 6;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Same range as the stock page performance table so both share the cached daily series. */
function dailyHistoryRange(now: Date): { from: string; to: string } {
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - STOCK_CHART_ALL_LOOKBACK_YEARS);
  return { from: ymdUtc(fromDate), to: ymdUtc(now) };
}

async function loadExtremes(ticker: string, quoteYmd: string, now: Date): Promise<PriceExtremes | null> {
  const { from, to } = dailyHistoryRange(now);
  try {
    const bars = await loadPortfolioSymbolEodBars(ticker, from, to);
    return priceExtremesFromCloses(bars, quoteYmd);
  } catch {
    return null;
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

/** Records events globally (one row per stock + key). Returns the keys that did not exist yet. */
async function recordNewEvents(admin: SupabaseClient, candidates: readonly Candidate[]): Promise<Set<string>> {
  const rows = candidates.flatMap((c) =>
    c.eventKeys.map((eventKey) => ({
      ticker: c.ticker,
      event_key: eventKey,
      kind: c.kind,
      payload: {
        price: c.quote.price,
        previousClose: c.quote.previousClose,
        changePct: c.quote.changePct,
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

function emptyResult(skipReason: string, extra: Partial<MarketAlertsIngestResult> = {}): MarketAlertsIngestResult {
  return {
    skipped: true,
    skipReason,
    followedTickers: 0,
    quotedToday: 0,
    candidateEvents: 0,
    newEvents: 0,
    notificationsCreated: 0,
    ...extra,
  };
}

/**
 * Cron step: ±5% / ±10% daily moves and new 52-week / all-time closing highs and lows for stocks
 * users watch or hold. Prices come from the 15-minute US bulk quote snapshot (no extra provider calls);
 * history comes from the cached daily series. Each event fires once per stock, then fans out to followers.
 */
export async function ingestMarketAlerts(now: Date = new Date()): Promise<MarketAlertsIngestResult> {
  return runWithProviderTrace("cron/market-alerts", async () => {
    const session = getUsEquityMarketSession(now);
    if (session !== "regular" && session !== "post") return emptyResult(`session_${session}`);

    const admin = getSupabaseAdminClient();
    if (!admin) return emptyResult("no_supabase_admin");

    const quotes = await readUsQuotesBulkMap();
    if (!quotes) return emptyResult("no_bulk_quotes");

    const interest = await buildEarningsNotifyInterestMap(admin);
    const todayYmd = nyCalendarYmd(now);

    const quoted: { ticker: string; quote: UsBulkQuote; quoteYmd: string }[] = [];
    for (const ticker of interest.keys()) {
      if (!isEarningsNotifiableTicker(ticker)) continue;
      const quote = quotes.get(usQuotesBulkKey(ticker));
      if (!quote?.tsSec) continue;
      const quoteYmd = nyCalendarYmd(new Date(quote.tsSec * 1000));
      // Halted / untraded today: the row still carries an older session's change.
      if (quoteYmd !== todayYmd) continue;
      quoted.push({ ticker, quote, quoteYmd });
    }
    if (quoted.length === 0) return emptyResult("no_quotes_today", { followedTickers: interest.size });

    const candidates: Candidate[] = [];
    const extremes = await mapWithConcurrency(quoted, BARS_CONCURRENCY, (q) => loadExtremes(q.ticker, q.quoteYmd, now));
    quoted.forEach(({ ticker, quote, quoteYmd }, i) => {
      const move = quote.previousClose != null && quote.previousClose > 0 ? priceMoveTier(quote.changePct) : null;
      if (move) {
        candidates.push({
          ticker,
          kind: MARKET_PRICE_MOVE_KIND,
          eventKeys: priceMoveEventKeys(quoteYmd, move.direction, move.tier).reverse(),
          quote,
          quoteYmd,
        });
      }
      const ex = extremes[i];
      if (!ex) return;
      for (const hit of detectHighLow(quote.price, ex)) {
        candidates.push({
          ticker,
          kind: MARKET_HIGH_LOW_KIND,
          eventKeys: [highLowEventKey(hit.side, quoteYmd)],
          quote,
          quoteYmd,
          hit,
        });
      }
    });

    const base = { skipped: false, followedTickers: interest.size, quotedToday: quoted.length };
    if (candidates.length === 0) return { ...base, candidateEvents: 0, newEvents: 0, notificationsCreated: 0 };

    const newKeys = await recordNewEvents(admin, candidates);
    // A move notifies only when its highest tier is new (jumping straight to 10% also records 5%, silently).
    const fresh = candidates.filter((c) => newKeys.has(`${c.ticker}|${c.eventKeys[0]}`));
    if (fresh.length === 0) {
      return { ...base, candidateEvents: candidates.length, newEvents: newKeys.size, notificationsCreated: 0 };
    }

    const disabled = await loadMarketAlertsDisabledUserIds(admin);
    const rootByTicker = new Map<string, Promise<Record<string, unknown> | null>>();
    const rows: NewUserNotificationRow[] = [];

    for (const c of fresh) {
      const users = interest.get(c.ticker);
      if (!users?.size) continue;
      const optedOut = c.kind === MARKET_PRICE_MOVE_KIND ? disabled.priceMoves : disabled.highLow;
      const recipients = [...users].filter((u) => !optedOut.has(u));
      if (recipients.length === 0) continue;

      let pending = rootByTicker.get(c.ticker);
      if (!pending) {
        pending = fetchEodhdFundamentalsJson(c.ticker).catch(() => null);
        rootByTicker.set(c.ticker, pending);
      }
      const root = await pending;
      const general =
        root?.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
      const nameRaw = general?.Name ?? general?.CompanyName;
      const companyName = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : c.ticker;
      const logoUrl = logoUrlFromFundamentalsRoot(root, c.ticker) || undefined;
      const changePct = c.quote.changePct ?? 0;

      const copy = c.hit
        ? highLowCopy({ ticker: c.ticker, companyName, price: c.quote.price, hit: c.hit })
        : priceMoveCopy({ ticker: c.ticker, companyName, price: c.quote.price, changePct });
      const payload: Record<string, unknown> = {
        companyName,
        logoUrl,
        price: c.quote.price,
        previousClose: c.quote.previousClose,
        changePct,
        quoteDate: c.quoteYmd,
        ...(c.hit ? { level: c.hit.level, previousExtreme: c.hit.previous } : {}),
      };
      for (const userId of recipients) {
        rows.push({
          user_id: userId,
          kind: c.kind,
          ticker: c.ticker,
          title: copy.title,
          body: copy.body,
          href: `/stock/${encodeURIComponent(c.ticker)}`,
          payload,
          dedupe_key: `${c.ticker}:${c.eventKeys[0]}`,
        });
      }
    }

    const notificationsCreated = await insertUserNotificationsAndPush(admin, rows);
    return { ...base, candidateEvents: candidates.length, newEvents: newKeys.size, notificationsCreated };
  });
}
