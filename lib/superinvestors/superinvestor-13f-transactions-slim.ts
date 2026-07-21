import type {
  SuperinvestorQuarterlyTransaction,
  SuperinvestorQuarterlyTransactionKind,
  SuperinvestorQuarterTransactionGroup,
  SuperinvestorTransactionsPayload,
} from "@/lib/superinvestors/types";

/** Per-transaction row stored in market_snapshot (group carries quarter metadata). */
export type SuperinvestorQuarterlyTransactionSlim = {
  kind: SuperinvestorQuarterlyTransactionKind;
  companyName: string;
  ticker: string | null;
  cusip: string | null;
  sharesChangePct: number | null;
  sharesDelta: number | null;
  portfolioWeightChangePct: number | null;
};

export type SuperinvestorQuarterTransactionGroupSlim = {
  quarterLabel: string;
  reportDate: string;
  filingDate: string | null;
  transactions: SuperinvestorQuarterlyTransactionSlim[];
};

export type SuperinvestorTransactionsPayloadSlim = {
  filerDisplayName: string;
  cik: string;
  quarters: SuperinvestorQuarterTransactionGroupSlim[];
  source: SuperinvestorTransactionsPayload["source"];
};

function slimTransaction(tx: SuperinvestorQuarterlyTransaction): SuperinvestorQuarterlyTransactionSlim {
  return {
    kind: tx.kind,
    companyName: tx.companyName,
    ticker: tx.ticker,
    cusip: tx.cusip,
    sharesChangePct: tx.sharesChangePct,
    sharesDelta: tx.sharesDelta,
    portfolioWeightChangePct: tx.portfolioWeightChangePct,
  };
}

/** Drop duplicated quarter metadata and unused historical price fields before persistence. */
export function slimSuperinvestorTransactionsPayload(
  payload: SuperinvestorTransactionsPayload,
): SuperinvestorTransactionsPayloadSlim {
  return {
    filerDisplayName: payload.filerDisplayName,
    cik: payload.cik,
    source: payload.source,
    quarters: payload.quarters.map((group) => ({
      quarterLabel: group.quarterLabel,
      reportDate: group.reportDate,
      filingDate: group.filingDate,
      transactions: group.transactions.map(slimTransaction),
    })),
  };
}

function expandTransaction(
  tx: SuperinvestorQuarterlyTransactionSlim,
  group: SuperinvestorQuarterTransactionGroupSlim,
): SuperinvestorQuarterlyTransaction {
  return {
    ...tx,
    quarterLabel: group.quarterLabel,
    reportDate: group.reportDate,
    avgClosingPriceUsd: null,
    priceRangeLowUsd: null,
    priceRangeHighUsd: null,
  };
}

/** Rehydrate quarter metadata for API / UI consumers after snapshot read. */
export function expandSuperinvestorTransactionsPayload(
  payload: SuperinvestorTransactionsPayloadSlim,
): SuperinvestorTransactionsPayload {
  return {
    filerDisplayName: payload.filerDisplayName,
    cik: payload.cik,
    source: payload.source,
    quarters: payload.quarters.map((group) => ({
      quarterLabel: group.quarterLabel,
      reportDate: group.reportDate,
      filingDate: group.filingDate,
      transactions: group.transactions.map((tx) => expandTransaction(tx, group)),
    })),
  };
}

export function isSuperinvestorTransactionsPayloadSlim(data: unknown): data is SuperinvestorTransactionsPayloadSlim {
  const payload = data as SuperinvestorTransactionsPayloadSlim | null;
  if (!payload?.quarters || !Array.isArray(payload.quarters)) return false;
  const firstGroup = payload.quarters[0];
  if (!firstGroup) return true;
  const firstTx = firstGroup.transactions[0];
  if (!firstTx) return true;
  return !("quarterLabel" in firstTx) && !("reportDate" in firstTx);
}

export function parseSuperinvestorTransactionsSnapshotData(data: unknown): SuperinvestorTransactionsPayload | null {
  if (!data || typeof data !== "object") return null;
  const legacy = data as SuperinvestorTransactionsPayload;
  if (legacy.quarters && Array.isArray(legacy.quarters)) {
    if (isSuperinvestorTransactionsPayloadSlim(data)) {
      return expandSuperinvestorTransactionsPayload(data);
    }
    return legacy;
  }
  return null;
}

/** API response: slim groups, no per-row quarter duplication or price fields. */
export function slimSuperinvestorTransactionsForApi(
  payload: SuperinvestorTransactionsPayload,
): SuperinvestorTransactionsPayloadSlim {
  return slimSuperinvestorTransactionsPayload(payload);
}
