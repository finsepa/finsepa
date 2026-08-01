import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT, REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import {
  indexSupportsComponents,
  type IndexComponentRow,
} from "@/lib/market/index-page-shared";

export type { IndexComponentRow } from "@/lib/market/index-page-shared";
export {
  indexAssetHref,
  indexDisplayCode,
  indexSupportsComponents,
  isIndexPageSymbol,
  resolveIndexPageTitle,
} from "@/lib/market/index-page-shared";

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function rowsFromComponentMap(raw: unknown): IndexComponentRow[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  const out: IndexComponentRow[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const code = strOrNull(row.Code) ?? strOrNull(row.code) ?? strOrNull(row.Symbol);
    const name = strOrNull(row.Name) ?? strOrNull(row.name) ?? code;
    if (!code || !name) continue;
    out.push({
      code: code.toUpperCase(),
      name,
      sector: strOrNull(row.Sector) ?? strOrNull(row.sector),
      weight: numOrNull(row.Weight) ?? numOrNull(row.weight),
      exchange: strOrNull(row.Exchange) ?? strOrNull(row.exchange),
    });
  }
  return out;
}

function parseIndexComponentsFromFundamentals(
  symbol: string,
  root: Record<string, unknown> | null,
): IndexComponentRow[] {
  if (!root) return [];
  const sym = symbol.trim().toUpperCase();

  const fromIndex = rowsFromComponentMap(root.Components);
  if (fromIndex.length) {
    return fromIndex.sort((a, b) => {
      const aw = a.weight ?? -1;
      const bw = b.weight ?? -1;
      if (aw !== bw) return bw - aw;
      return a.code.localeCompare(b.code);
    });
  }

  // Russell card / ETF proxy — holdings with weights.
  if (sym.endsWith(".US") || sym === "IWM.US") {
    const etf = root.ETF_Data;
    if (etf && typeof etf === "object") {
      const data = etf as Record<string, unknown>;
      const holdings =
        rowsFromComponentMap(data.Holdings).length > 0
          ? rowsFromComponentMap(data.Holdings)
          : rowsFromComponentMap(data.Top_10_Holdings);
      if (holdings.length) {
        return holdings.sort((a, b) => {
          const aw = a.weight ?? -1;
          const bw = b.weight ?? -1;
          if (aw !== bw) return bw - aw;
          return a.code.localeCompare(b.code);
        });
      }
    }
  }

  return [];
}

async function loadIndexComponentsUncached(symbol: string): Promise<IndexComponentRow[]> {
  const s = symbol.trim().toUpperCase();
  if (!s || !indexSupportsComponents(s)) return [];
  const root = await fetchEodhdFundamentalsJson(s);
  return parseIndexComponentsFromFundamentals(s, root);
}

export const loadIndexComponents = unstable_cache(
  loadIndexComponentsUncached,
  ["index-components-v1"],
  { revalidate: REVALIDATE_WARM },
);

export const loadIndexComponentsLimited = unstable_cache(
  async (symbol: string, limit = 50) => {
    const rows = await loadIndexComponentsUncached(symbol);
    return rows.slice(0, Math.max(1, limit));
  },
  ["index-components-limited-v1"],
  { revalidate: REVALIDATE_HOT },
);
