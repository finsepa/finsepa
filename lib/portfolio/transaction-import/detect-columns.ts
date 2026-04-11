import { normalizeHeaderText } from "@/lib/portfolio/transaction-import/normalize-header";
import type { ImportFieldKey } from "@/lib/portfolio/transaction-import/types";

const SYNONYMS: Record<ImportFieldKey, readonly string[]> = {
  asset: [
    "symbol",
    "ticker",
    "tickers",
    "asset",
    "instrument",
    "security",
    "stock",
    "name",
    "company",
  ],
  operation: [
    "event",
    "operation",
    "type",
    "side",
    "action",
    "transaction",
    "txn",
    "buy sell",
  ],
  date: ["date", "trade date", "opened", "as of", "settlement", "time"],
  price: [
    "price",
    "share price",
    "avg price",
    "average price",
    "cost",
    "cost per share",
    "avg cost",
    "rate",
  ],
  shares: ["shares", "quantity", "qty", "units", "amount", "size", "volume"],
  fee: ["fee", "fees", "feetax", "fee tax", "commission", "commissions"],
  /** Omit generic "amount" — many sheets use Amount for share/quantity; that must map to `shares`, not proceeds. */
  total: ["total", "sum", "value", "net", "proceeds", "cash flow", "total amount"],
};

function scoreHeaderForField(normalizedHeader: string, field: ImportFieldKey): number {
  let best = 0;
  for (const syn of SYNONYMS[field]) {
    if (normalizedHeader === syn) best = Math.max(best, 1);
    else if (normalizedHeader.includes(syn) || syn.includes(normalizedHeader)) best = Math.max(best, 0.88);
    else {
      for (const w of normalizedHeader.split(/\s+/)) {
        if (w.length >= 3 && syn.includes(w)) best = Math.max(best, 0.55);
      }
    }
  }
  return best;
}

export type ColumnPick = { field: ImportFieldKey; index: number; score: number };

/**
 * Assigns each column index to at most one field; picks strongest matches first.
 */
export function detectImportColumns(headers: string[]): Partial<Record<ImportFieldKey, number>> {
  const normalized = headers.map((h) => normalizeHeaderText(h || ""));
  const candidates: ColumnPick[] = [];
  const fields: ImportFieldKey[] = [
    "asset",
    "operation",
    "date",
    "price",
    "shares",
    "fee",
    "total",
  ];

  for (let col = 0; col < headers.length; col++) {
    const h = normalized[col] ?? "";
    if (!h) continue;
    for (const field of fields) {
      const s = scoreHeaderForField(h, field);
      if (s >= 0.45) candidates.push({ field, index: col, score: s });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const usedCols = new Set<number>();
  const out: Partial<Record<ImportFieldKey, number>> = {};

  for (const c of candidates) {
    if (usedCols.has(c.index)) continue;
    if (out[c.field] !== undefined) continue;
    usedCols.add(c.index);
    out[c.field] = c.index;
  }

  return out;
}
