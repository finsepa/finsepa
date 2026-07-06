/** Shared curated WebSocket universe (mirrors lib/market/stock-ws-priority-universe.ts). */

export const PRIORITY_ETFS = ["SPY", "QQQ"];

/** Default tick-perfect test pair when STOCK_WS_ALWAYS_ON is unset (mirrors stock-ws-always-on.ts). */
export const DEFAULT_ALWAYS_ON_TICKERS = ["NVDA", "AAPL"];

export function loadStockWsAlwaysOnTickers() {
  if (process.env.STOCK_WS_ALWAYS_ON === "") return [];
  const raw = process.env.STOCK_WS_ALWAYS_ON?.trim();
  const list = raw ? raw.split(",") : DEFAULT_ALWAYS_ON_TICKERS;
  const out = [];
  const seen = new Set();
  for (const part of list) {
    const sym = normalizeStockTicker(part);
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
}

/** Keep pinned tickers when capping EODHD symbol slots. */
export function capWatchTickerList(ordered, maxSymbols, pinnedTickers) {
  if (ordered.length <= maxSymbols) return ordered;
  const pinned = new Set(pinnedTickers);
  const kept = [];
  const rest = [];
  for (const t of ordered) {
    if (pinned.has(t)) kept.push(t);
    else rest.push(t);
  }
  const slots = Math.max(0, maxSymbols - kept.length);
  return [...kept, ...rest.slice(0, slots)];
}

/** Used when Supabase `top500_market` snapshot is unreachable from the worker. */
export const FALLBACK_CURATED_TOP_STOCKS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "BRK-B",
  "TSLA",
  "LLY",
  "AVGO",
  "JPM",
  "V",
  "UNH",
  "XOM",
  "MA",
  "PG",
  "JNJ",
  "HD",
  "COST",
  "ABBV",
  "NFLX",
  "CRM",
  "BAC",
  "KO",
  "AMD",
  "MRK",
  "ORCL",
  "PEP",
  "CVX",
  "TMO",
  "ACN",
  "CSCO",
  "WMT",
  "MCD",
  "ADBE",
  "LIN",
  "DIS",
  "INTU",
  "QCOM",
  "TXN",
  "AMGN",
  "HON",
  "AMAT",
  "IBM",
  "GE",
  "CAT",
  "PANW",
  "SBUX",
];

export function stockWsTopStocksCount() {
  const raw = process.env.STOCK_WS_TOP_STOCKS;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 48;
}

export function stockWsCuratedMode() {
  return process.env.STOCK_WS_CURATED !== "0";
}

function normalizeStockTicker(raw) {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t || t.includes(":") || t.includes("/") || t.startsWith("$")) return null;
  const base = t.replace(/\.US$/i, "").split(".")[0];
  if (!base || !/^[A-Z0-9-]{1,8}$/.test(base)) return null;
  return base;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export async function loadCuratedUsPriorityTickers(supabase) {
  const ordered = [];
  const seen = new Set();
  const push = (t) => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    ordered.push(t);
  };

  for (const t of PRIORITY_ETFS) push(normalizeStockTicker(t));
  for (const t of (process.env.STOCK_WS_TICKERS ?? "").split(",")) {
    push(normalizeStockTicker(t));
  }

  const topN = stockWsTopStocksCount();

  // Curated worker: static fallback only — snapshot reads compete with minute-bar upserts.
  if (stockWsCuratedMode()) {
    for (const t of FALLBACK_CURATED_TOP_STOCKS) {
      if (ordered.filter((sym) => !PRIORITY_ETFS.includes(sym)).length >= topN) break;
      push(normalizeStockTicker(t));
    }
    return ordered;
  }

  const { data, error } = await supabase
    .from("market_snapshot")
    .select("data")
    .eq("key", "top500_market")
    .maybeSingle();

  if (error) {
    console.warn("top500_market snapshot error", error.message);
  } else if (Array.isArray(data?.data)) {
    let stockCount = 0;
    for (const row of data.data) {
      if (stockCount >= topN) break;
      const sym = normalizeStockTicker(row?.ticker ?? row?.code);
      if (!sym) continue;
      push(sym);
      stockCount += 1;
    }
  }

  let stockSlots = ordered.filter((t) => !PRIORITY_ETFS.includes(t)).length;
  if (stockSlots < topN) {
    console.warn(
      "top500_market snapshot missing or short; using fallback curated list",
      { have: stockSlots, need: topN },
    );
    for (const t of FALLBACK_CURATED_TOP_STOCKS) {
      if (stockSlots >= topN) break;
      const sym = normalizeStockTicker(t);
      if (!sym || seen.has(sym)) continue;
      push(sym);
      stockSlots += 1;
    }
  }

  return ordered;
}
