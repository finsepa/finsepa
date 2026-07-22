/**
 * Manual ↔ Connected parity comparison helpers (offline, deterministic).
 *
 * Economic fields are compared after provenance is stripped. Downstream engines
 * (Phase 1–4) must match within documented tolerances.
 */

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { buildPortfolioAllocationRows } from "@/lib/portfolio/portfolio-allocation-rows";
import { replayPortfolioLedger } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import {
  lifetimeEquityProfitUsd,
} from "@/lib/portfolio/realized-pnl-from-trades";
import {
  totalNetWorth,
  unrealizedProfitUsd,
  lifetimeEquityProfitPct,
} from "@/lib/portfolio/overview-metrics";
import { portfolioPeriodReturnDietz } from "@/lib/portfolio/returns/portfolio-return-engine";
import { comparePortfolioToBenchmark } from "@/lib/portfolio/benchmark/benchmark-engine";
import { transactionSource } from "@/lib/snaptrade/snaptrade-provenance";

/** USD tolerance (half-cent display rounding). */
export const USD_EPS = 0.005;
/** Share / avg-cost quantity tolerance. */
export const QTY_EPS = 1e-9;
/** Percentage / ratio tolerance. */
export const PCT_EPS = 1e-6;

export type EconomicFingerprint = {
  date: string;
  kind: PortfolioTransaction["kind"];
  operation: string;
  symbol: string;
  shares: number;
  price: number;
  fee: number;
  sum: number;
  sequence: number | null;
};

export function economicFingerprint(t: PortfolioTransaction): EconomicFingerprint {
  return {
    date: t.date,
    kind: t.kind,
    operation: t.operation,
    symbol: (t.symbol ?? "").toUpperCase(),
    shares: t.shares,
    price: t.price,
    fee: t.fee,
    sum: t.sum,
    sequence: t.sequence ?? null,
  };
}

export function economicLedgerFingerprint(txs: readonly PortfolioTransaction[]): string {
  const { transactions } = migratePortfolioTransactionSequences([...txs]);
  const ordered = sortPortfolioTransactionsCanonical(transactions);
  return JSON.stringify(ordered.map(economicFingerprint));
}

export function approxEqual(a: number, b: number, eps: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= eps;
}

export type DownstreamSnapshot = {
  txCount: number;
  economicFp: string;
  cashUsd: number;
  realizedGainUsd: number;
  openCostBasisUsd: number;
  holdings: Array<{
    symbol: string;
    shares: number;
    avgPrice: number;
    costBasis: number;
    currentValue: number;
  }>;
  unrealizedUsd: number;
  totalProfitUsd: number;
  totalProfitPct: number | null;
  currentValue: number;
  dietzPct: number | null;
  benchmarkPct: number | null;
  aheadPct: number | null;
  allocation: Array<{ symbol: string; weightPct: number }>;
  dividendIncomeUsd: number;
  sources: Record<string, number>;
  externalIds: string[];
};

/** Fixed mark prices for offline valuation (symbol → last price). */
const DEFAULT_MARKS: Record<string, number> = {
  AAPL: 200,
  MSFT: 400,
  SPY: 500,
  VTI: 250,
  AAA: 100,
  BBB: 50,
};

function applyMarks(holdings: PortfolioHolding[], marks: Record<string, number>): PortfolioHolding[] {
  return holdings.map((h) => {
    const px = marks[h.symbol.toUpperCase()] ?? h.marketPrice ?? h.avgPrice;
    return {
      ...h,
      marketPrice: px,
      currentValue: h.shares * px,
    };
  });
}

function dividendIncomeUsd(txs: readonly PortfolioTransaction[]): number {
  let s = 0;
  for (const t of txs) {
    if (t.kind === "income" && t.operation.toLowerCase().includes("dividend")) s += t.sum;
  }
  return s;
}

/**
 * Full offline downstream snapshot using Phase 1 ledger + Phase 2 Dietz + Phase 3
 * contribution benchmark (synthetic SPY flat price path) + allocation.
 * Analytics risk ratios that require market EOD series are out of scope for offline parity;
 * they consume the same return series builder when prices are supplied.
 */
export function captureDownstreamSnapshot(
  txs: readonly PortfolioTransaction[],
  opts?: {
    marks?: Record<string, number>;
    portfolioId?: string;
    inceptionYmd?: string;
    asOfYmd?: string;
    spyPrice?: number;
  },
): DownstreamSnapshot {
  const marks = { ...DEFAULT_MARKS, ...opts?.marks };
  const { transactions } = migratePortfolioTransactionSequences([...txs]);
  const ledger = replayPortfolioLedger(transactions, {
    mode: "display",
    portfolioId: opts?.portfolioId ?? "cert",
  });
  const holdings = applyMarks(ledger.holdings, marks);
  const cashUsd = ledger.cashUsd;
  const unrealizedUsd = unrealizedProfitUsd(holdings);
  const realizedGainUsd = ledger.realizedGainUsd;
  const totalProfitUsd = lifetimeEquityProfitUsd(holdings, transactions);
  const totalProfitPct = lifetimeEquityProfitPct(holdings, transactions);
  const currentValue = totalNetWorth(holdings, cashUsd);

  const inceptionYmd = opts?.inceptionYmd ?? transactions.map((t) => t.date).sort()[0] ?? "2024-01-01";
  const asOfYmd = opts?.asOfYmd ?? "2024-12-31";
  // Synthetic NAV: use cash+equity at end; start = first cash deposit (or 0).
  const vStart = 0;
  const vEnd = currentValue;
  const dietz = portfolioPeriodReturnDietz({
    transactions,
    vStart,
    vEnd,
    startYmd: inceptionYmd,
    endYmd: asOfYmd,
  });

  const spy = opts?.spyPrice ?? 500;
  const bench = comparePortfolioToBenchmark({
    transactions,
    portfolioVStart: vStart,
    portfolioVEnd: vEnd,
    startYmd: inceptionYmd,
    endYmd: asOfYmd,
    priceOnOrBefore: () => spy,
  });

  const allocation = buildPortfolioAllocationRows(holdings, transactions).map((r) => ({
    symbol: r.symbol,
    weightPct: r.weightPct,
  }));

  const sources: Record<string, number> = {};
  const externalIds: string[] = [];
  for (const t of transactions) {
    const s = transactionSource(t);
    sources[s] = (sources[s] ?? 0) + 1;
    if (t.externalId) externalIds.push(t.externalId);
  }
  externalIds.sort();

  return {
    txCount: transactions.length,
    economicFp: economicLedgerFingerprint(transactions),
    cashUsd,
    realizedGainUsd,
    openCostBasisUsd: ledger.openCostBasisUsd,
    holdings: holdings
      .map((h) => ({
        symbol: h.symbol.toUpperCase(),
        shares: h.shares,
        avgPrice: h.avgPrice,
        costBasis: h.costBasis,
        currentValue: h.currentValue,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    unrealizedUsd,
    totalProfitUsd,
    totalProfitPct,
    currentValue,
    dietzPct: dietz.pct,
    benchmarkPct: bench.benchmarkPct,
    aheadPct: bench.aheadPct,
    allocation: allocation.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    dividendIncomeUsd: dividendIncomeUsd(transactions),
    sources,
    externalIds,
  };
}

export type ParityDiff = { field: string; manual: unknown; connected: unknown };

/** Compare Manual vs Connected economic + downstream outputs (provenance may differ). */
export function diffParitySnapshots(
  manual: DownstreamSnapshot,
  connected: DownstreamSnapshot,
  opts?: { ignoreSources?: boolean; ignoreExternalIds?: boolean },
): ParityDiff[] {
  const diffs: ParityDiff[] = [];
  const push = (field: string, a: unknown, b: unknown) => {
    diffs.push({ field, manual: a, connected: b });
  };

  if (manual.txCount !== connected.txCount) push("txCount", manual.txCount, connected.txCount);
  if (manual.economicFp !== connected.economicFp) push("economicFp", manual.economicFp, connected.economicFp);

  if (!approxEqual(manual.cashUsd, connected.cashUsd, USD_EPS)) {
    push("cashUsd", manual.cashUsd, connected.cashUsd);
  }
  if (!approxEqual(manual.realizedGainUsd, connected.realizedGainUsd, USD_EPS)) {
    push("realizedGainUsd", manual.realizedGainUsd, connected.realizedGainUsd);
  }
  if (!approxEqual(manual.openCostBasisUsd, connected.openCostBasisUsd, USD_EPS)) {
    push("openCostBasisUsd", manual.openCostBasisUsd, connected.openCostBasisUsd);
  }
  if (!approxEqual(manual.unrealizedUsd, connected.unrealizedUsd, USD_EPS)) {
    push("unrealizedUsd", manual.unrealizedUsd, connected.unrealizedUsd);
  }
  if (!approxEqual(manual.totalProfitUsd, connected.totalProfitUsd, USD_EPS)) {
    push("totalProfitUsd", manual.totalProfitUsd, connected.totalProfitUsd);
  }
  if (
    (manual.totalProfitPct == null) !== (connected.totalProfitPct == null) ||
    (manual.totalProfitPct != null &&
      connected.totalProfitPct != null &&
      !approxEqual(manual.totalProfitPct, connected.totalProfitPct, PCT_EPS))
  ) {
    push("totalProfitPct", manual.totalProfitPct, connected.totalProfitPct);
  }
  if (!approxEqual(manual.currentValue, connected.currentValue, USD_EPS)) {
    push("currentValue", manual.currentValue, connected.currentValue);
  }
  if (
    (manual.dietzPct == null) !== (connected.dietzPct == null) ||
    (manual.dietzPct != null &&
      connected.dietzPct != null &&
      !approxEqual(manual.dietzPct, connected.dietzPct, PCT_EPS))
  ) {
    push("dietzPct", manual.dietzPct, connected.dietzPct);
  }
  if (
    (manual.benchmarkPct == null) !== (connected.benchmarkPct == null) ||
    (manual.benchmarkPct != null &&
      connected.benchmarkPct != null &&
      !approxEqual(manual.benchmarkPct, connected.benchmarkPct, PCT_EPS))
  ) {
    push("benchmarkPct", manual.benchmarkPct, connected.benchmarkPct);
  }
  if (
    (manual.aheadPct == null) !== (connected.aheadPct == null) ||
    (manual.aheadPct != null &&
      connected.aheadPct != null &&
      !approxEqual(manual.aheadPct, connected.aheadPct, PCT_EPS))
  ) {
    push("aheadPct", manual.aheadPct, connected.aheadPct);
  }
  if (!approxEqual(manual.dividendIncomeUsd, connected.dividendIncomeUsd, USD_EPS)) {
    push("dividendIncomeUsd", manual.dividendIncomeUsd, connected.dividendIncomeUsd);
  }

  if (JSON.stringify(manual.holdings) !== JSON.stringify(connected.holdings)) {
    // Soft compare holdings with eps
    if (manual.holdings.length !== connected.holdings.length) {
      push("holdings.length", manual.holdings.length, connected.holdings.length);
    } else {
      for (let i = 0; i < manual.holdings.length; i += 1) {
        const a = manual.holdings[i]!;
        const b = connected.holdings[i]!;
        if (a.symbol !== b.symbol) push(`holdings[${i}].symbol`, a.symbol, b.symbol);
        if (!approxEqual(a.shares, b.shares, QTY_EPS)) push(`holdings[${i}].shares`, a.shares, b.shares);
        if (!approxEqual(a.avgPrice, b.avgPrice, USD_EPS)) push(`holdings[${i}].avgPrice`, a.avgPrice, b.avgPrice);
        if (!approxEqual(a.costBasis, b.costBasis, USD_EPS)) push(`holdings[${i}].costBasis`, a.costBasis, b.costBasis);
        if (!approxEqual(a.currentValue, b.currentValue, USD_EPS)) {
          push(`holdings[${i}].currentValue`, a.currentValue, b.currentValue);
        }
      }
    }
  }

  if (manual.allocation.length !== connected.allocation.length) {
    push("allocation.length", manual.allocation.length, connected.allocation.length);
  } else {
    for (let i = 0; i < manual.allocation.length; i += 1) {
      const a = manual.allocation[i]!;
      const b = connected.allocation[i]!;
      if (a.symbol !== b.symbol) push(`allocation[${i}].symbol`, a.symbol, b.symbol);
      if (!approxEqual(a.weightPct, b.weightPct, PCT_EPS)) {
        push(`allocation[${i}].weightPct`, a.weightPct, b.weightPct);
      }
    }
  }

  if (!opts?.ignoreSources && JSON.stringify(manual.sources) !== JSON.stringify(connected.sources)) {
    // Expected to differ MANUAL vs SNAPTRADE — callers set ignoreSources for economic parity.
  }
  if (!opts?.ignoreExternalIds && JSON.stringify(manual.externalIds) !== JSON.stringify(connected.externalIds)) {
    // Expected to differ — callers set ignoreExternalIds for economic parity.
  }

  return diffs;
}

/** Assert economic parity: ignore provenance / external ids. */
export function assertEconomicParity(
  manualTxs: readonly PortfolioTransaction[],
  connectedTxs: readonly PortfolioTransaction[],
  label: string,
): DownstreamSnapshot {
  const m = captureDownstreamSnapshot(manualTxs);
  const c = captureDownstreamSnapshot(connectedTxs);
  const diffs = diffParitySnapshots(m, c, { ignoreSources: true, ignoreExternalIds: true });
  if (diffs.length > 0) {
    const msg = diffs.map((d) => `${d.field}: manual=${JSON.stringify(d.manual)} connected=${JSON.stringify(d.connected)}`).join("\n");
    throw new Error(`Parity failure [${label}]:\n${msg}`);
  }
  return m;
}

/** Stable workspace-like JSON for determinism checks (economic + provenance ids). */
export function workspaceDeterminismKey(txs: readonly PortfolioTransaction[]): string {
  const { transactions } = migratePortfolioTransactionSequences([...txs]);
  const ordered = sortPortfolioTransactionsCanonical(transactions);
  return JSON.stringify(
    ordered.map((t) => ({
      ...economicFingerprint(t),
      source: transactionSource(t),
      externalId: t.externalId ?? null,
      externalAccountId: t.externalAccountId ?? null,
    })),
  );
}
