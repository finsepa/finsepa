import "server-only";

import { INDEX_TOP10 } from "@/lib/market/indices-top10";

/** Ten major benchmarks for the screener Indices tab + global search (symbols match EODHD). */
export const SCREENER_INDICES_10 = INDEX_TOP10.map(({ name, symbol }) => ({ name, symbol }));

export const SCREENER_INDEX_SYMBOLS: readonly string[] = SCREENER_INDICES_10.map((e) => e.symbol);

export const SCREENER_INDEX_SYMBOL_SET = new Set(SCREENER_INDEX_SYMBOLS);
