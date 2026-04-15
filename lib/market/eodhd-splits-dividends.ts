import "server-only";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

/**
 * Corporate actions: dividends and splits.
 * @see https://eodhd.com/financial-apis/api-splits-dividends
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function strField(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function numField(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export type EodhdDividendRow = {
  /** Ex-dividend date */
  date: string;
  declarationDate?: string;
  recordDate?: string;
  paymentDate?: string;
  value: number | null;
  unadjustedValue?: number | null;
  currency?: string;
  period?: string;
};

export type EodhdSplitRow = {
  date: string;
  /** Ratio label from provider, e.g. `4/1` */
  split: string;
};

function parseDividendRow(raw: unknown): EodhdDividendRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = strField(o, "date", "Date", "ex_dividend_date", "exDividendDate");
  if (!date || !YMD.test(date)) return null;

  return {
    date,
    declarationDate: strField(o, "declarationDate", "DeclarationDate"),
    recordDate: strField(o, "recordDate", "RecordDate"),
    paymentDate: strField(o, "paymentDate", "PaymentDate"),
    value: numField(o, "value", "Value", "dividend", "Dividend"),
    unadjustedValue: numField(o, "unadjustedValue", "UnadjustedValue", "unadjusted_value"),
    currency: strField(o, "currency", "Currency"),
    period: strField(o, "period", "Period"),
  };
}

function parseSplitRow(raw: unknown): EodhdSplitRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = strField(o, "date", "Date");
  if (!date || !YMD.test(date)) return null;
  const split =
    strField(o, "split", "Split", "option", "Option") ??
    (typeof o.ratio === "string" && o.ratio.trim() ? o.ratio : undefined);
  if (!split) return null;
  return { date, split };
}

export type EodhdCorporateActionsRange = {
  /** Inclusive start `YYYY-MM-DD` */
  from?: string;
  /** Inclusive end `YYYY-MM-DD` */
  to?: string;
};

function appendRange(params: URLSearchParams, range: EodhdCorporateActionsRange | undefined) {
  if (range?.from) {
    if (YMD.test(range.from)) params.set("from", range.from);
  }
  if (range?.to) {
    if (YMD.test(range.to)) params.set("to", range.to);
  }
}

/**
 * Dividend history for a symbol (defaults to `.US` when no exchange suffix).
 */
export async function fetchEodhdDividendsHistory(
  symbolOrTicker: string,
  range?: EodhdCorporateActionsRange,
): Promise<EodhdDividendRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
  });
  appendRange(params, range);
  const url = `https://eodhd.com/api/div/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdDividendsHistory", { symbol: sym, ...range })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_WARM } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return [];
    return json.map(parseDividendRow).filter(Boolean) as EodhdDividendRow[];
  } catch {
    return [];
  }
}

/**
 * Historical stock splits for a symbol (defaults to `.US` when no exchange suffix).
 */
export async function fetchEodhdSplitsHistory(
  symbolOrTicker: string,
  range?: EodhdCorporateActionsRange,
): Promise<EodhdSplitRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
  });
  appendRange(params, range);
  const url = `https://eodhd.com/api/splits/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdSplitsHistory", { symbol: sym, ...range })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_WARM } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return [];
    return json.map(parseSplitRow).filter(Boolean) as EodhdSplitRow[];
  } catch {
    return [];
  }
}
