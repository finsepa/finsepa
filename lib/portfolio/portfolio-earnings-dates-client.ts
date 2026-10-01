import type { PortfolioEarningsDateEntry } from "@/lib/portfolio/portfolio-earnings-dates";

export type PortfolioEarningsDatesPayload = {
  bySymbol: Record<string, PortfolioEarningsDateEntry>;
  /** Server could not resolve every symbol — undated entries are unknown, retry later. */
  incomplete?: boolean;
};

type CacheEntry = {
  at: number;
  entry: PortfolioEarningsDateEntry;
};

const MEMORY_TTL_MS = 15 * 60 * 1000;
/** Per-symbol cache is shared across different portfolios and symbol subsets. */
const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PortfolioEarningsDatesPayload | null>>();
/** Bump when payload shape changes so stale clients re-fetch (e.g. fiscal quarter). */
const CACHE_VERSION = "v2-fiscal-quarter";

function cacheKey(symbol: string): string {
  return `${CACHE_VERSION}:${symbol}`;
}

export function portfolioEarningsSymbolsKey(symbols: readonly string[]): string {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))]
    .sort()
    .join(",");
}

function readSymbol(symbol: string): PortfolioEarningsDateEntry | null {
  const hit = memory.get(cacheKey(symbol));
  if (!hit) return null;
  if (Date.now() - hit.at > MEMORY_TTL_MS) {
    memory.delete(cacheKey(symbol));
    return null;
  }
  return hit.entry;
}

function readSymbols(symbolsKey: string): PortfolioEarningsDatesPayload | null {
  const bySymbol: Record<string, PortfolioEarningsDateEntry> = {};
  for (const symbol of symbolsKey.split(",").filter(Boolean)) {
    const entry = readSymbol(symbol);
    if (!entry) return null;
    bySymbol[symbol] = entry;
  }
  return { bySymbol };
}

export function peekPortfolioEarningsDatesClient(
  symbolsKey: string,
): PortfolioEarningsDatesPayload | null {
  return symbolsKey ? readSymbols(symbolsKey) : { bySymbol: {} };
}

async function fetchPortfolioEarningsDatesJson(
  symbolsKey: string,
): Promise<PortfolioEarningsDatesPayload | null> {
  const response = await fetch("/api/portfolio/earnings-dates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ symbols: symbolsKey.split(",") }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as Partial<PortfolioEarningsDatesPayload>;
  return {
    bySymbol:
      json.bySymbol && typeof json.bySymbol === "object" ? json.bySymbol : {},
    incomplete: json.incomplete === true,
  };
}

/** Memory hits first, then the fresh payload; flags `incomplete` when any symbol is still unresolved. */
function mergeWithMemory(
  symbolsKey: string,
  payload: PortfolioEarningsDatesPayload | null,
): PortfolioEarningsDatesPayload {
  const bySymbol: Record<string, PortfolioEarningsDateEntry> = {};
  let incomplete = payload == null || payload.incomplete === true;
  for (const symbol of symbolsKey.split(",").filter(Boolean)) {
    const entry = readSymbol(symbol) ?? payload?.bySymbol[symbol];
    if (entry) bySymbol[symbol] = entry;
    else incomplete = true;
  }
  return { bySymbol, incomplete };
}

/**
 * Shared client cache for portfolio earnings dates.
 * Deduplicates concurrent mounts and makes tab revisits synchronous.
 */
export async function fetchPortfolioEarningsDatesClient(
  symbolsKey: string,
): Promise<PortfolioEarningsDatesPayload | null> {
  if (!symbolsKey) return { bySymbol: {} };

  const cached = readSymbols(symbolsKey);
  if (cached) return cached;

  const requestedSymbols = symbolsKey.split(",").filter(Boolean);
  const missingKey = portfolioEarningsSymbolsKey(
    requestedSymbols.filter((symbol) => readSymbol(symbol) == null),
  );
  const pending = inflight.get(missingKey);
  if (pending) {
    return mergeWithMemory(symbolsKey, await pending);
  }

  const request = fetchPortfolioEarningsDatesJson(missingKey)
    .then((payload) => {
      if (!payload) return null;
      const at = Date.now();
      for (const [symbol, entry] of Object.entries(payload.bySymbol)) {
        // An undated entry from a partial response means "unknown", not "no earnings" — don't pin it.
        if (payload.incomplete && !entry.notApplicable && !entry.earningsDateYmd) continue;
        memory.set(cacheKey(symbol), { at, entry });
      }
      return payload;
    })
    .catch(() => null);

  inflight.set(missingKey, request);
  void request.finally(() => {
    if (inflight.get(missingKey) === request) inflight.delete(missingKey);
  });
  return mergeWithMemory(symbolsKey, await request);
}
