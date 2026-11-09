import "server-only";

import { unstable_cache } from "next/cache";

import { BINANCE_REST_BASE } from "@/lib/market/binance-crypto-ticker";
import {
  cryptoBinanceLiveBases,
  cryptoKrakenLiveBases,
  cryptoOkxLiveBases,
  normalizeCryptoBaseSymbol,
  toBinanceUsdtBase,
  toKrakenPairMeta,
  toOkxInstId,
} from "@/lib/market/crypto-live-1d-tickers";
import type { CryptoLiveQuote } from "@/lib/market/crypto-live-quotes-shared";

const FETCH_TIMEOUT_MS = 3_000;
/** Shared by every list surface; the public route adds a CDN layer on top. */
const QUOTES_TTL_MS = 4_000;
/** Binance `tradingDay` weight caps at 200 per request for >50 symbols. */
const BINANCE_TRADING_DAY_BATCH = 100;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function positive(n: unknown): number | null {
  const v = typeof n === "string" || typeof n === "number" ? Number(n) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function utcYmd(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** All Binance spot last prices in one weight-4 call → `BTCUSDT` → price. */
async function fetchBinanceAllPrices(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const json = await fetchJson(`${BINANCE_REST_BASE}/api/v3/ticker/price`);
  if (!Array.isArray(json)) return out;
  for (const row of json as Array<{ symbol?: unknown; price?: unknown }>) {
    const sym = typeof row?.symbol === "string" ? row.symbol : "";
    const px = positive(row?.price);
    if (sym && px != null) out.set(sym, px);
  }
  return out;
}

async function fetchBinanceUtcOpensUncached(pairs: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < pairs.length; i += BINANCE_TRADING_DAY_BATCH) {
    const batch = pairs.slice(i, i + BINANCE_TRADING_DAY_BATCH);
    const symbols = encodeURIComponent(JSON.stringify(batch));
    const json = await fetchJson(
      `${BINANCE_REST_BASE}/api/v3/ticker/tradingDay?symbols=${symbols}&timeZone=0&type=MINI`,
    );
    if (!Array.isArray(json)) continue;
    for (const row of json as Array<{ symbol?: unknown; openPrice?: unknown }>) {
      const sym = typeof row?.symbol === "string" ? row.symbol : "";
      const open = positive(row?.openPrice);
      if (sym && open != null) out[sym] = open;
    }
  }
  if (!Object.keys(out).length) throw new Error("binance tradingDay returned no opens");
  return out;
}

/**
 * UTC-day opens never change until midnight UTC — cache cross-instance per day so the
 * ~1.2k-weight batch runs about once a day instead of on every cold start.
 */
const getBinanceUtcOpensForDay = unstable_cache(
  async (_ymd: string, pairsJson: string) => fetchBinanceUtcOpensUncached(JSON.parse(pairsJson) as string[]),
  ["crypto-live-binance-utc-opens-v1"],
  { revalidate: 3_600 },
);

async function binanceQuotes(nowMs: number): Promise<Record<string, CryptoLiveQuote>> {
  const out: Record<string, CryptoLiveQuote> = {};
  const bases = cryptoBinanceLiveBases();
  if (!bases.length) return out;

  const prices = await fetchBinanceAllPrices();
  if (!prices.size) return out;

  const pairByBase = new Map<string, string>();
  for (const base of bases) {
    const pair = `${toBinanceUsdtBase(base)}USDT`;
    if (prices.has(pair)) pairByBase.set(base, pair);
  }

  let opens: Record<string, number> = {};
  try {
    const pairs = [...new Set(pairByBase.values())].sort();
    opens = await getBinanceUtcOpensForDay(utcYmd(nowMs), JSON.stringify(pairs));
  } catch {
    opens = {};
  }

  for (const [base, pair] of pairByBase) {
    out[base] = { price: prices.get(pair)!, utcOpen: opens[pair] ?? null, source: "binance" };
  }
  return out;
}

/** One Kraken Ticker call for every curated Binance-gap pair; `o` is today's UTC open. */
async function krakenQuotes(): Promise<Record<string, CryptoLiveQuote>> {
  const out: Record<string, CryptoLiveQuote> = {};
  const metas = cryptoKrakenLiveBases()
    .map((base) => ({ base, meta: toKrakenPairMeta(base) }))
    .filter((x): x is { base: string; meta: NonNullable<ReturnType<typeof toKrakenPairMeta>> } => x.meta != null);
  if (!metas.length) return out;

  const pairs = metas.map((m) => m.meta.restPair).join(",");
  const json = (await fetchJson(`https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairs)}`)) as {
    error?: unknown[];
    result?: Record<string, { c?: unknown[]; o?: unknown }>;
  } | null;
  const rows = json?.result ?? {};
  for (const { base, meta } of metas) {
    // Kraken echoes legacy keys for some assets (XMRUSD → XXMRZUSD).
    const row = rows[meta.restPair] ?? rows[`X${base}ZUSD`];
    const price = positive(row?.c?.[0]);
    if (price == null) continue;
    out[base] = { price, utcOpen: positive(row?.o), source: "kraken" };
  }
  return out;
}

async function okxQuotes(): Promise<Record<string, CryptoLiveQuote>> {
  const out: Record<string, CryptoLiveQuote> = {};
  const bases = cryptoOkxLiveBases();
  await Promise.all(
    bases.map(async (base) => {
      const instId = toOkxInstId(base);
      if (!instId) return;
      const json = (await fetchJson(
        `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`,
        { headers: { "User-Agent": "Finsepa/1.0" } },
      )) as { code?: string; data?: Array<{ last?: unknown; sodUtc0?: unknown }> } | null;
      if (!json || (json.code != null && json.code !== "0")) return;
      const row = json.data?.[0];
      const price = positive(row?.last);
      if (price == null) return;
      out[base] = { price, utcOpen: positive(row?.sodUtc0), source: "okx" };
    }),
  );
  return out;
}

let cache: { quotes: Record<string, CryptoLiveQuote>; asOfSec: number; expiresAtMs: number } | null = null;
let inflight: Promise<{ quotes: Record<string, CryptoLiveQuote>; asOfSec: number }> | null = null;

async function loadAll(): Promise<{ quotes: Record<string, CryptoLiveQuote>; asOfSec: number }> {
  const nowMs = Date.now();
  const [bn, kr, ox] = await Promise.all([
    binanceQuotes(nowMs).catch(() => ({})),
    krakenQuotes().catch(() => ({})),
    okxQuotes().catch(() => ({})),
  ]);
  return { quotes: { ...bn, ...kr, ...ox }, asOfSec: Math.floor(nowMs / 1000) };
}

/**
 * Live quotes for every crypto base on a free exchange feed (Binance / Kraken / OKX), keyed by
 * Finsepa base (`BTC`, `RNDR`, …). Coins without coverage (stablecoins, EOS, …) are absent —
 * callers keep their EODHD snapshot values for those.
 */
export async function getAllCryptoLiveQuotes(): Promise<{ quotes: Record<string, CryptoLiveQuote>; asOfSec: number }> {
  const nowMs = Date.now();
  if (cache && cache.expiresAtMs > nowMs) return { quotes: cache.quotes, asOfSec: cache.asOfSec };
  if (inflight) return inflight;
  inflight = loadAll()
    .then((res) => {
      // Keep the last good set when every exchange blips, rather than caching emptiness.
      if (Object.keys(res.quotes).length || !cache) {
        cache = { ...res, expiresAtMs: Date.now() + QUOTES_TTL_MS };
      }
      return cache ? { quotes: cache.quotes, asOfSec: cache.asOfSec } : res;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Subset lookup for server callers (portfolio marks, watchlist enrich). */
export async function getCryptoLiveQuotes(symbols: string[]): Promise<Record<string, CryptoLiveQuote>> {
  const wanted = new Set(symbols.map((s) => normalizeCryptoBaseSymbol(String(s).replace(/^crypto:/i, ""))).filter(Boolean));
  if (!wanted.size) return {};
  const { quotes } = await getAllCryptoLiveQuotes();
  const out: Record<string, CryptoLiveQuote> = {};
  for (const base of wanted) {
    const q = quotes[base];
    if (q) out[base] = q;
  }
  return out;
}
