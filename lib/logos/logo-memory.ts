"use client";

type GlobalWithLogoMem = typeof globalThis & { __finsepaLogoMem?: Map<string, string | null> };

function map(): Map<string, string | null> {
  const g = globalThis as GlobalWithLogoMem;
  if (!g.__finsepaLogoMem) g.__finsepaLogoMem = new Map();
  return g.__finsepaLogoMem;
}

/** Persist a resolved logo URL (or confirmed miss) for cross-route client reuse. */
export function mergeLogoMemory(symbol: string, url: string | null): void {
  map().set(symbol.trim().toUpperCase(), url);
}

/** Previously resolved URL for this symbol, if any. */
export function readLogoMemory(symbol: string): string | null | undefined {
  return map().get(symbol.trim().toUpperCase());
}
