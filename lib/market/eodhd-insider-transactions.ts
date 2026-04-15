import "server-only";

import { format, parse, subYears } from "date-fns";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import type { InsiderTransactionKind, InsiderTransactionRow } from "@/lib/market/insider-transactions-types";

export type { InsiderTransactionKind, InsiderTransactionRow } from "@/lib/market/insider-transactions-types";

/**
 * SEC Form 4–style insider transactions (US).
 * Each HTTP request consumes **10** EODHD API credits per provider docs.
 * @see https://eodhd.com/financial-apis/insider-transactions-api
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Default lookback when `from` is omitted: **5 calendar years** before `to`. */
const INSIDER_DEFAULT_LOOKBACK_YEARS = 5;

/**
 * Rolling window ending on `to` (defaults through today). When `from` is omitted,
 * `from` is five calendar years before `to`.
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

function strField(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
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

/** STOCK Act–style filings: exclude U.S. federal legislators from company “insider” tables. */
function titleIndicatesUsCongressMember(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.toLowerCase();
  if (/u\.?\s*s\.?\s*congress/.test(t)) return true;
  if (/united states congress/.test(t)) return true;
  if (/member of congress/.test(t)) return true;
  if (/congressional?\s+memb/.test(t)) return true;
  if (/congress(wo)?man|congressperson/.test(t)) return true;
  if (/u\.?\s*s\.?\s*senator\b|united states senator/.test(t)) return true;
  if (/u\.?\s*s\.?\s*representative\b|united states representative/.test(t)) return true;
  if (/u\.?\s*s\.?\s*house of representatives/.test(t)) return true;
  return false;
}

function rowLooksLikeUsCongressDisclosure(o: Record<string, unknown>): boolean {
  const parts = [
    strField(o, "ownerTitle", "OwnerTitle"),
    strField(o, "position", "Position"),
    strField(o, "ownerRelationship", "OwnerRelationship"),
  ];
  return parts.some((p) => titleIndicatesUsCongressMember(p));
}

function classifyKind(
  codeRaw: string,
  adRaw: string | undefined,
  descBlob: string,
): InsiderTransactionKind {
  const code = codeRaw.trim().toUpperCase();
  const ad = (adRaw ?? "").trim().toUpperCase();
  const isSale = code === "S" || ad === "D";
  const isBuy = code === "P" || ad === "A";
  if (isSale && /10b5-?1|planned\s+sale|rule\s+10b5/i.test(descBlob)) {
    return "planned_sale";
  }
  if (isBuy) return "purchase";
  if (isSale) return "sale";
  return "other";
}

function parseRow(raw: unknown): InsiderTransactionRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const transactionDate =
    strField(o, "transactionDate", "TransactionDate", "date", "Date") ??
    strField(o, "filingDate", "FilingDate");
  if (!transactionDate || !YMD.test(transactionDate)) return null;

  const ownerName = strField(o, "ownerName", "OwnerName", "insiderName", "InsiderName", "name", "Name");
  if (!ownerName) return null;

  if (rowLooksLikeUsCongressDisclosure(o)) return null;

  const ownerTitle =
    strField(o, "ownerTitle", "OwnerTitle", "position", "Position", "ownerRelationship", "OwnerRelationship") ?? null;

  const transactionCode = (strField(o, "transactionCode", "TransactionCode") ?? "").trim() || "—";
  const ad = strField(o, "transactionAcquiredDisposed", "TransactionAcquiredDisposed", "acquiredDisposed", "AcquiredDisposed");
  const descBlob = [
    strField(o, "description", "Description", "transactionDescription", "TransactionDescription"),
    strField(o, "type", "Type"),
    JSON.stringify(o),
  ]
    .filter(Boolean)
    .join(" ");

  const kind = classifyKind(transactionCode, ad, descBlob);

  const price = numField(o, "transactionPrice", "TransactionPrice", "price", "Price");

  let shareMag = numField(
    o,
    "transactionAmount",
    "TransactionAmount",
    "securitiesTransacted",
    "SecuritiesTransacted",
    "amount",
    "Amount",
    "shares",
    "Shares",
    "difference",
    "Difference",
  );
  if (shareMag != null) shareMag = Math.abs(shareMag);

  let signedShares: number | null = null;
  if (shareMag != null && Number.isFinite(shareMag)) {
    const isDisposal = transactionCode.toUpperCase() === "S" || (ad ?? "").toUpperCase() === "D";
    const isAcquisition = transactionCode.toUpperCase() === "P" || (ad ?? "").toUpperCase() === "A";
    if (isDisposal) signedShares = -shareMag;
    else if (isAcquisition) signedShares = shareMag;
    else signedShares = shareMag;
  }

  const post = numField(
    o,
    "postTransactionAmount",
    "PostTransactionAmount",
    "securitiesOwned",
    "SecuritiesOwned",
    "sharesOwnedFollowingTransaction",
    "SharesOwnedFollowingTransaction",
    "securitiesOwnedFollowingTransaction",
  );

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

  let value: number | null = null;
  if (price != null && shareMag != null) value = price * shareMag;

  return {
    transactionDate,
    ownerName,
    ownerTitle,
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
  /** 1–1000 — default 1000 so a multi-year window is not truncated for active symbols. */
  limit?: number;
};

function clampLimit(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return 1000;
  return Math.min(1000, Math.max(1, Math.floor(n)));
}

/**
 * Insider transactions for a single symbol (defaults to `.US`).
 */
export async function fetchEodhdInsiderTransactions(
  symbolOrTicker: string,
  opts?: FetchInsiderTransactionsOpts,
): Promise<InsiderTransactionRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const code = toEodhdSymbol(symbolOrTicker);
  const limit = clampLimit(opts?.limit);
  const { from, to } = resolveInsiderQueryWindow({ from: opts?.from, to: opts?.to });
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    code,
    limit: String(limit),
    from,
    to,
  });

  const url = `https://eodhd.com/api/insider-transactions?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdInsiderTransactions", { code, limit, from, to })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_WARM_LONG } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    const rows = Array.isArray(json) ? json : (json as { data?: unknown })?.data;
    if (!Array.isArray(rows)) return [];
    const parsed = rows.map(parseRow).filter(Boolean) as InsiderTransactionRow[];
    parsed.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    return parsed;
  } catch {
    return [];
  }
}
