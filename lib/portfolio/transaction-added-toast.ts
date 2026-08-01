import { toast } from "sonner";

import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";

const qtyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Sonner toast after a new ledger row is added. */
export function toastTransactionAdded(title: string, description: string): void {
  toast.success(title, { description });
}

/** Quantity + unit for trade toasts (`2 shares`, `0.5 BTC`). */
export function formatTradeToastQty(shares: number, symbol: string): string {
  const qty = qtyFormatter.format(shares);
  const sym = symbol.trim().toUpperCase();
  const base = cryptoRouteBase(sym);
  if (base !== sym) return `${qty} ${base}`;
  if (sym === "USD") return `${qty} USD`;
  return `${qty} shares`;
}

/** e.g. `Bought 2 shares of META` / `Sold 0.5 BTC`. */
export function formatTradeToastDescription(
  operation: "Buy" | "Sell",
  shares: number,
  symbol: string,
): string {
  const verb = operation === "Sell" ? "Sold" : "Bought";
  const qty = formatTradeToastQty(shares, symbol);
  const sym = symbol.trim().toUpperCase();
  const base = cryptoRouteBase(sym);
  if (base !== sym || sym === "USD") return `${verb} ${qty}`;
  return `${verb} ${qty} of ${sym}`;
}

export function formatIncomeToastDescription(
  operation: string,
  symbol: string,
  netUsd: number,
): string {
  const sym = symbol.trim().toUpperCase();
  const amount = usdFormatter.format(netUsd);
  if (operation === "Dividend") return `${amount} dividend · ${sym}`;
  return `${amount} income · ${sym}`;
}

export function formatExpenseToastDescription(
  operation: string,
  symbol: string,
  amountUsd: number,
): string {
  const sym = symbol.trim().toUpperCase();
  return `${usdFormatter.format(amountUsd)} ${operation.toLowerCase()} · ${sym}`;
}

export function formatCashToastDescription(direction: "in" | "out" | string, amountUsd: number): string {
  const amount = usdFormatter.format(amountUsd);
  if (direction === "in") return `${amount} deposited`;
  if (direction === "out") return `${amount} withdrawn`;
  return `${amount} recorded`;
}
