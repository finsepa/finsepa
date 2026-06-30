/** Shared curated WebSocket universe (mirrors lib/market/stock-ws-priority-universe.ts). */

export const PRIORITY_ETFS = ["SPY", "QQQ"];

export function stockWsTopStocksCount() {
  const n = Number(process.env.STOCK_WS_TOP_STOCKS ?? 48);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 48;
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

  return ordered;
}
