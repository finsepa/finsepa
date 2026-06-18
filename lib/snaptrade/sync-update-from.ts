import { format, parseISO } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";

export const SNAPTRADE_UPDATE_FROM_TOOLTIP =
  "The date used to start transactions sync. By default, the date of the latest transaction added to the portfolio is substituted. If not specified, then all transactions are synchronized from the beginning of the portfolio's existence.";

/** Latest ledger date, or `null` when the portfolio has no transactions (full history). */
export function defaultSnaptradeUpdateFromYmd(
  transactions: readonly PortfolioTransaction[],
): string | null {
  if (transactions.length === 0) return null;
  return transactions.reduce(
    (max, t) => (t.date > max ? t.date : max),
    transactions[0]!.date,
  );
}

export function normalizeSnaptradeUpdateFromYmd(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = parseISO(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return trimmed;
}

export function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d);
}

export function localDateToYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
