/** Resolve a requested EODHD realtime symbol against provider `code` variants. */
export function pickRealtimePayloadFromMap<T>(
  map: Map<string, T>,
  requestedSymbol: string,
): T | null {
  const u = requestedSymbol.trim().toUpperCase();
  if (!u) return null;
  const bare = u.replace(/\.[A-Z]{2,8}$/i, "");
  return (
    map.get(u) ??
    map.get(bare) ??
    map.get(bare.replace(/\./g, "-")) ??
    null
  );
}

export function normalizeRealtimeSymbols(symbols: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of symbols) {
    const t = s.trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
