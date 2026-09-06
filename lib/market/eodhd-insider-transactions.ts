import "server-only";

import { format, parse, subYears } from "date-fns";
import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import type { InsiderTransactionKind, InsiderTransactionRow } from "@/lib/market/insider-transactions-types";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";

export type { InsiderTransactionKind, InsiderTransactionRow } from "@/lib/market/insider-transactions-types";

/**
 * SEC Form 4 insider transactions (US) via EODHD `/api/sec-filings/{symbol}/form4`.
 * Each HTTP page consumes **10** API credits. Legacy `/api/insider-transactions` is obsolete
 * and returns empty for many large-caps (e.g. AAPL).
 * @see https://eodhd.com/financial-apis/insider-transactions-api
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Default lookback when `from` is omitted: **1 calendar year** before `to`. */
export const INSIDER_DEFAULT_LOOKBACK_YEARS = 1;

/** Page size for Form 4 (API max 100). */
const FORM4_PAGE_LIMIT = 100;

/**
 * Cap provider fan-out on cold miss (10 credits/page). 4 pages ≈ 400 filings —
 * enough for large-cap coverage under the default 1y window.
 */
const FORM4_MAX_PAGES = 4;

/**
 * Rolling window ending on `to` (defaults through today). When `from` is omitted,
 * `from` is one calendar year before `to`.
 */
export function resolveInsiderQueryWindow(partial?: { from?: string; to?: string }): { from: string; to: string } {
  const to =
    partial?.to && YMD.test(partial.to) ? partial.to : format(new Date(), "yyyy-MM-dd");
  const from =
    partial?.from && YMD.test(partial.from)
      ? partial.from
      : format(subYears(parse(to, "yyyy-MM-dd", new Date()), INSIDER_DEFAULT_LOOKBACK_YEARS), "yyyy-MM-dd");
  return { from, to };
}

/** True when the request uses the canonical 1Y default window (no custom from/to). */
export function isCanonicalInsider1YRequest(partial?: { from?: string; to?: string }): boolean {
  return !(partial?.from && YMD.test(partial.from)) && !(partial?.to && YMD.test(partial.to));
}

/** Path segment for Form 4 — `AAPL.US` → `AAPL`. */
function form4PathSymbol(symbolOrTicker: string): string {
  const code = toEodhdSymbol(symbolOrTicker);
  const i = code.lastIndexOf(".");
  return i > 0 ? code.slice(0, i) : code;
}

function ymdFromIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = raw.trim().slice(0, 10);
  return YMD.test(t) ? t : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function footnoteBlob(footnotes: unknown): string {
  if (!Array.isArray(footnotes)) return "";
  return footnotes
    .map((f) => {
      if (!f || typeof f !== "object") return "";
      const t = (f as { text?: unknown }).text;
      return typeof t === "string" ? t : "";
    })
    .filter(Boolean)
    .join(" ");
}

function ownerTitleFromForm4(tx: Record<string, unknown>): string | null {
  const officer = typeof tx.officer_title === "string" && tx.officer_title.trim() ? tx.officer_title.trim() : null;
  if (officer) return officer;
  const bits: string[] = [];
  if (tx.is_director === true) bits.push("Director");
  if (tx.is_officer === true) bits.push("Officer");
  if (tx.is_ten_percent_owner === true) bits.push("10% Owner");
  if (typeof tx.other_text === "string" && tx.other_text.trim()) bits.push(tx.other_text.trim());
  return bits.length ? bits.join(", ") : null;
}

/**
 * Map SEC Form 4 non-derivative codes we surface as buys/sells.
 * Grants/exercises (A/M/…) stay out of the retail table.
 */
function classifyForm4Kind(
  codeRaw: string,
  acquiredOrDisposed: string | undefined,
  footnotesText: string,
): InsiderTransactionKind | null {
  const code = codeRaw.trim().toUpperCase();
  const ad = (acquiredOrDisposed ?? "").trim().toUpperCase();
  const planned = /10b5-?1|rule\s+10b5/i.test(footnotesText);

  if (code === "P" || (code === "L" && ad === "A")) {
    return "purchase";
  }
  if (code === "S" || code === "F" || (code === "D" && ad === "D")) {
    return planned ? "planned_sale" : "sale";
  }
  return null;
}

function parseForm4NonDerivative(
  tx: unknown,
  footnotesText: string,
): InsiderTransactionRow | null {
  if (!tx || typeof tx !== "object") return null;
  const o = tx as Record<string, unknown>;

  const transactionDate = ymdFromIso(o.transaction_date);
  if (!transactionDate) return null;

  const ownerName =
    typeof o.reporting_owner_name === "string" && o.reporting_owner_name.trim()
      ? o.reporting_owner_name.trim()
      : null;
  if (!ownerName) return null;

  const transactionCode =
    (typeof o.transaction_code === "string" && o.transaction_code.trim()
      ? o.transaction_code.trim()
      : "—") || "—";
  const ad =
    typeof o.acquired_or_disposed === "string" ? o.acquired_or_disposed.trim() : undefined;

  const kind = classifyForm4Kind(transactionCode, ad, footnotesText);
  if (!kind) return null;

  const price = numOrNull(o.price_per_share);
  let shareMag = numOrNull(o.shares_amount);
  if (shareMag != null) shareMag = Math.abs(shareMag);

  let signedShares: number | null = null;
  if (shareMag != null) {
    signedShares = kind === "purchase" ? shareMag : -shareMag;
  }

  const post = numOrNull(o.shares_owned_after);
  let positionChangePct: number | null = null;
  if (signedShares != null && post != null && Number.isFinite(post)) {
    const amt = Math.abs(signedShares);
    if (amt > 0) {
      if (signedShares < 0) {
        const prior = post + amt;
        if (prior > 0) positionChangePct = -(amt / prior) * 100;
      } else {
        const prior = post - amt;
        if (prior > 0) positionChangePct = (amt / prior) * 100;
      }
    }
  }

  let value = numOrNull(o.total_value);
  if (value == null && price != null && shareMag != null) value = price * shareMag;

  return {
    transactionDate,
    ownerName,
    ownerTitle: ownerTitleFromForm4(o),
    transactionCode,
    kind,
    shares: signedShares,
    positionChangePct,
    price,
    value,
  };
}

export type FetchInsiderTransactionsOpts = {
  from?: string;
  to?: string;
  /** Max flattened rows after parse (default 1000). */
  limit?: number;
};

function clampLimit(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return 1000;
  return Math.min(1000, Math.max(1, Math.floor(n)));
}

type Form4PageJson = {
  data?: unknown;
  meta?: { total?: number; page?: { offset?: number; limit?: number } };
  links?: { next?: string | null };
};

async function fetchForm4Page(
  pathSymbol: string,
  offset: number,
  pageLimit: number,
  apiKey: string,
): Promise<Form4PageJson | null> {
  const params = new URLSearchParams({
    api_token: apiKey,
    "page[offset]": String(offset),
    "page[limit]": String(pageLimit),
  });
  const url = `https://eodhd.com/api/sec-filings/${encodeURIComponent(pathSymbol)}/form4?${params.toString()}`;
  if (
    !traceEodhdHttp("fetchEodhdInsiderTransactionsForm4", {
      symbol: pathSymbol,
      offset,
      pageLimit,
    })
  ) {
    return null;
  }
  const res = await fetchEodhd(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as Form4PageJson;
}

/**
 * Insider transactions for a single US symbol (Form 4 non-derivative buys/sells).
 * Uncached — prefer {@link loadInsiderTransactionsForTicker} for the user/API path.
 */
export async function fetchEodhdInsiderTransactionsUncached(
  symbolOrTicker: string,
  opts?: FetchInsiderTransactionsOpts,
): Promise<InsiderTransactionRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const pathSymbol = form4PathSymbol(symbolOrTicker);
  if (!pathSymbol) return [];

  const rowLimit = clampLimit(opts?.limit);
  const { from, to } = resolveInsiderQueryWindow({ from: opts?.from, to: opts?.to });

  const out: InsiderTransactionRow[] = [];
  let offset = 0;

  try {
    for (let page = 0; page < FORM4_MAX_PAGES; page++) {
      const json = await fetchForm4Page(pathSymbol, offset, FORM4_PAGE_LIMIT, key);
      if (!json) break;

      const filings = Array.isArray(json.data) ? json.data : [];
      if (filings.length === 0) break;

      let oldestFiled: string | null = null;
      for (const filing of filings) {
        if (!filing || typeof filing !== "object") continue;
        const f = filing as Record<string, unknown>;
        const filedAt = ymdFromIso(f.filed_at);
        if (filedAt && (oldestFiled == null || filedAt < oldestFiled)) oldestFiled = filedAt;

        // Filings are newest-first; once an entire page is older than `from`, we can stop after this page.
        if (filedAt && filedAt < from) continue;

        const notes = footnoteBlob(f.footnotes);
        const nonDeriv = Array.isArray(f.non_derivative) ? f.non_derivative : [];
        for (const tx of nonDeriv) {
          const row = parseForm4NonDerivative(tx, notes);
          if (!row) continue;
          if (row.transactionDate < from || row.transactionDate > to) continue;
          out.push(row);
          if (out.length >= rowLimit) break;
        }
        if (out.length >= rowLimit) break;
      }

      if (out.length >= rowLimit) break;
      if (oldestFiled != null && oldestFiled < from) break;

      const next = json.links?.next;
      if (!next || typeof next !== "string") break;
      offset += FORM4_PAGE_LIMIT;
      const total = typeof json.meta?.total === "number" ? json.meta.total : null;
      if (total != null && offset >= total) break;
    }
  } catch {
    return out.length ? out : [];
  }

  out.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  return out.slice(0, rowLimit);
}

const fetchEodhdInsiderTransactionsCached = unstable_cache(
  async (symbolOrTicker: string, from: string, to: string, limitKey: string) => {
    const limit = limitKey ? Number.parseInt(limitKey, 10) : undefined;
    return fetchEodhdInsiderTransactionsUncached(symbolOrTicker, { from, to, limit });
  },
  ["eodhd-insider-transactions-form4-v2-1y"],
  { revalidate: REVALIDATE_WARM_LONG },
);

export async function fetchEodhdInsiderTransactions(
  symbolOrTicker: string,
  opts?: FetchInsiderTransactionsOpts,
): Promise<InsiderTransactionRow[]> {
  const { from, to } = resolveInsiderQueryWindow({ from: opts?.from, to: opts?.to });
  const limitKey = opts?.limit != null ? String(clampLimit(opts.limit)) : "";
  return fetchEodhdInsiderTransactionsCached(symbolOrTicker, from, to, limitKey);
}
