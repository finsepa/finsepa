import type { ImportOperationLabel } from "@/lib/portfolio/transaction-import/types";

/**
 * Normalize broker event tokens: "CASH_IN", "CASH IN", "cash-in" → comparable key.
 */
function compactEventKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Maps spreadsheet cells (including Snowball / Wio `Event`: CASH_IN, CASH_OUT, BUY, SELL)
 * to app operation labels.
 */
export function parseOperationCell(raw: string, assetUpper: string): ImportOperationLabel | null {
  const compact = compactEventKey(raw);
  if (!compact) return null;

  const isUsd = assetUpper === "USD" || assetUpper === "CASH" || assetUpper === "US DOLLAR";

  /** USD-only: e.g. `CASH_Income`, `CASH_GAIN`, `CASH_Expense` (compact strips separators). */
  if (isUsd) {
    if (compact === "cashincome" || compact === "cashgain") return "Other income";
    if (compact === "cashexpense") return "Other expense";
  }

  // Broker export style (Event column)
  if (compact === "cashin") return "Cash In";
  if (compact === "cashout") return "Cash Out";
  if (compact === "buy") return "Buy";
  if (compact === "sell") return "Sell";
  if (compact === "dividend") return "Dividend";
  if (compact === "split") return "Split";

  const u = raw.trim().toLowerCase();

  if (isUsd) {
    if (/\bcash\s*in\b/.test(u) || /\bdeposit\b/.test(u) || u === "in" || u === "credit" || u === "+") {
      return "Cash In";
    }
    if (/\bcash\s*out\b/.test(u) || /\bwithdraw/.test(u) || u === "out" || u === "debit" || u === "-") {
      return "Cash Out";
    }
    if (u.includes("buy") || u === "long") return "Cash In";
    if (u.includes("sell") || u === "short") return "Cash Out";
    return null;
  }

  if (u.includes("sell") || u === "short") return "Sell";
  if (u.includes("buy") || u === "long") return "Buy";
  if (u === "b" || u === "s") return u === "s" ? "Sell" : "Buy";
  return null;
}
