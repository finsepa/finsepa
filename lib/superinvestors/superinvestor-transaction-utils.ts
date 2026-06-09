import type {
  Berkshire13fComparisonRow,
  Holding13fComparisonStatus,
  SuperinvestorQuarterTransactionGroup,
  SuperinvestorQuarterlyTransaction,
  SuperinvestorQuarterlyTransactionKind,
  SuperinvestorTransactionsPayload,
} from "@/lib/superinvestors/types";

const sharePctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatTxPctSigned(pct: number | null, kind: SuperinvestorQuarterlyTransactionKind): string | null {
  if (kind === "exit") return "-100%";
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct > 0) return `+${sharePctFmt.format(pct)}%`;
  if (pct < 0) return `-${sharePctFmt.format(Math.abs(pct))}%`;
  return `${sharePctFmt.format(0)}%`;
}

/** Stable display string (avoids SSR/client drift from legacy `Bought —` copy). */
export function normalizeSuperinvestorActivityHeadline(line: string): string {
  const t = line.trim();
  if (t === "Bought —" || t === "Bought –" || t === "Bought -" || t === "Bought") return "Buy";
  if (t.startsWith("Bought ")) return `Buy ${t.slice("Bought ".length)}`;
  if (t === "Increased on —" || t === "Increased on –") return "Add";
  if (t === "Increased") return "Add";
  if (t.startsWith("Increased on ")) return `Add ${t.slice("Increased on ".length)}`;
  if (t === "Reducing on —" || t === "Reducing on –") return "Reduce";
  if (t === "Reducing") return "Reduce";
  if (t.startsWith("Reducing on ")) return `Reduce ${t.slice("Reducing on ".length)}`;
  return t.replace(/\s+[—–]\s*$/u, "").trim();
}

/** First line of transaction Recent Activity (e.g. `Add +204.0%`, `Reduce -35.2%`). */
export function superinvestorTransactionActivityHeadline(
  kind: SuperinvestorQuarterlyTransactionKind,
  sharesChangePct: number | null,
  sharesDelta: number | null = null,
): string {
  const pct = formatTxPctSigned(sharesChangePct, kind);
  let line: string;
  switch (kind) {
    case "new":
      line = pct ? `Buy ${pct}` : "Buy";
      break;
    case "buy":
      line = pct ? `Add ${pct}` : "Add";
      break;
    case "sell":
      line = pct ? `Reduce ${pct}` : "Reduce";
      break;
    case "exit":
      line = `Sold ${pct ?? "-100%"}`;
      break;
  }
  return normalizeSuperinvestorActivityHeadline(line);
}

function comparisonStatusToTxKind(status: Holding13fComparisonStatus): SuperinvestorQuarterlyTransactionKind | null {
  if (status === "new") return "new";
  if (status === "add") return "buy";
  if (status === "reduce") return "sell";
  return null;
}

export type HoldingRecentActivityDisplay = {
  /** Same copy as Activity tab line 1 (`Add +204.0%`, `Reduce -35.2%`, etc.). */
  headline: string;
  positive: boolean;
};

export function holdingRecentActivityWordFromKind(kind: SuperinvestorQuarterlyTransactionKind): string {
  switch (kind) {
    case "new":
      return "bought";
    case "buy":
      return "increased";
    case "sell":
      return "reduced";
    case "exit":
      return "sold";
  }
}

export function superinvestorTxTradeMarkerSide(kind: SuperinvestorQuarterlyTransactionKind): "buy" | "sell" {
  return kind === "buy" || kind === "new" ? "buy" : "sell";
}

export function superinvestorTransactionIsBuy(kind: SuperinvestorQuarterlyTransactionKind): boolean {
  return kind === "buy" || kind === "new";
}

export function superinvestorTransactionIsSell(kind: SuperinvestorQuarterlyTransactionKind): boolean {
  return kind === "sell" || kind === "exit";
}

/**
 * Recent Activity for the holdings table: only positions changed in the latest 13F
 * (current vs prior filing). Unchanged names return null (empty cell).
 */
export function resolveHoldingRecentActivity(
  row: Pick<Berkshire13fComparisonRow, "status" | "sharesChangePct" | "sharesDelta">,
  hasPriorFiling: boolean,
): HoldingRecentActivityDisplay | null {
  if (!hasPriorFiling || !row.status || row.status === "unchanged") return null;

  const kind = comparisonStatusToTxKind(row.status);
  if (!kind) return null;
  if (row.sharesChangePct == null && row.sharesDelta == null && kind !== "new") return null;
  if (row.sharesChangePct === 0 && (row.sharesDelta == null || row.sharesDelta === 0)) return null;

  const headline = superinvestorTransactionActivityHeadline(kind, row.sharesChangePct, row.sharesDelta ?? null);
  return {
    headline,
    positive: kind === "buy" || kind === "new",
  };
}

export function normalizeSuperinvestorIssuerKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quarterGroupKey(group: Pick<SuperinvestorQuarterTransactionGroup, "reportDate" | "filingDate">): string {
  return `${group.reportDate}|${group.filingDate ?? ""}`;
}

/** New filing quarters first; skip duplicates already stored in the snapshot. */
export function prependSuperinvestorQuarterGroups(
  payload: SuperinvestorTransactionsPayload,
  incoming: readonly SuperinvestorQuarterTransactionGroup[],
): SuperinvestorTransactionsPayload {
  const seen = new Set<string>();
  const quarters: SuperinvestorQuarterTransactionGroup[] = [];

  for (const group of [...incoming, ...payload.quarters]) {
    const key = quarterGroupKey(group);
    if (seen.has(key)) continue;
    seen.add(key);
    quarters.push(group);
  }

  return { ...payload, quarters };
}

/** Keep only txs for names still in the latest 13F comparison table (e.g. BAC, not exited tickers). */
export function filterSuperinvestorTransactionsToCurrentHoldings(
  payload: SuperinvestorTransactionsPayload,
  holdings: readonly Pick<Berkshire13fComparisonRow, "cusip" | "ticker" | "companyName">[],
): SuperinvestorTransactionsPayload {
  if (holdings.length === 0) return { ...payload, quarters: [] };

  const quarters = payload.quarters
    .map((group) => ({
      ...group,
      transactions: group.transactions.filter((tx) =>
        holdings.some((row) => holdingMatchesTransaction(row, tx, row.ticker)),
      ),
    }))
    .filter((group) => group.transactions.length > 0);

  return { ...payload, quarters };
}

export function superinvestorTransactionIdentityKey(
  tx: Pick<SuperinvestorQuarterlyTransaction, "cusip" | "ticker" | "companyName">,
): string {
  const cusip = tx.cusip?.trim().toUpperCase();
  if (cusip && cusip.length >= 6) return cusip;
  const ticker = tx.ticker?.trim().toUpperCase();
  if (ticker) return `TK:${ticker}`;
  return `ISS:${normalizeSuperinvestorIssuerKey(tx.companyName)}`;
}

function shareCountsSimilarForRoundTrip(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / scale <= 0.03;
}

/**
 * Drops adjacent-quarter fake exit + full rebuy pairs (e.g. one missing 13F line).
 * Quarters are newest-first: newer quarter buy vs older quarter exit.
 */
export function pruneSpuriousExitReentryTransactions(
  payload: SuperinvestorTransactionsPayload,
): SuperinvestorTransactionsPayload {
  const quarters = payload.quarters.map((g) => ({ ...g, transactions: [...g.transactions] }));
  const drop = new Set<string>();

  for (let qi = 0; qi < quarters.length - 1; qi++) {
    const newerQ = quarters[qi]!;
    const olderQ = quarters[qi + 1]!;

    for (let ti = 0; ti < newerQ.transactions.length; ti++) {
      const buyTx = newerQ.transactions[ti]!;
      if (buyTx.kind !== "buy" && buyTx.kind !== "new") continue;

      const key = superinvestorTransactionIdentityKey(buyTx);
      const buyShares = Math.abs(buyTx.sharesDelta ?? 0);
      if (buyShares <= 0) continue;

      for (let ej = 0; ej < olderQ.transactions.length; ej++) {
        const exitTx = olderQ.transactions[ej]!;
        if (exitTx.kind !== "exit") continue;
        if (superinvestorTransactionIdentityKey(exitTx) !== key) continue;

        const exitShares = Math.abs(exitTx.sharesDelta ?? 0);
        if (exitShares <= 0 || !shareCountsSimilarForRoundTrip(buyShares, exitShares)) continue;

        drop.add(`${qi}:${ti}`);
        drop.add(`${qi + 1}:${ej}`);
      }
    }
  }

  const trimmed = quarters
    .map((g, qi) => ({
      ...g,
      transactions: g.transactions.filter((_, ti) => !drop.has(`${qi}:${ti}`)),
    }))
    .filter((g) => g.transactions.length > 0);

  return { ...payload, quarters: trimmed };
}

export function flattenSuperinvestorTransactions(
  quarters: SuperinvestorTransactionsPayload["quarters"],
): SuperinvestorQuarterlyTransaction[] {
  const out: SuperinvestorQuarterlyTransaction[] = [];
  for (const group of quarters) {
    for (const tx of group.transactions) out.push(tx);
  }
  return out.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

export function holdingMatchesTransaction(
  row: Pick<Berkshire13fComparisonRow, "cusip" | "ticker" | "companyName">,
  tx: Pick<SuperinvestorQuarterlyTransaction, "cusip" | "ticker" | "companyName">,
  resolvedTicker?: string | null,
): boolean {
  const cusip = row.cusip?.trim().toUpperCase() ?? "";
  const txCusip = tx.cusip?.trim().toUpperCase() ?? "";
  if (cusip.length >= 6 && txCusip.length >= 6 && cusip === txCusip) return true;

  const ticker = (row.ticker?.trim() || resolvedTicker?.trim() || "").toUpperCase();
  const txTicker = tx.ticker?.trim().toUpperCase() ?? "";
  // Same listing symbol (e.g. GOOGL) even when SEC CUSIPs differ across filings.
  if (ticker && txTicker) return ticker === txTicker;

  // 13F lines are per CUSIP — do not merge GOOG / GOOGL (etc.) via issuer name alone.
  if (cusip.length >= 6 || txCusip.length >= 6) return false;

  const issuer = normalizeSuperinvestorIssuerKey(row.companyName);
  const txIssuer = normalizeSuperinvestorIssuerKey(tx.companyName);
  if (!issuer || !txIssuer) return false;
  return issuer === txIssuer || issuer.includes(txIssuer) || txIssuer.includes(issuer);
}

export function transactionsForHolding(
  all: SuperinvestorQuarterlyTransaction[],
  row: Pick<Berkshire13fComparisonRow, "cusip" | "ticker" | "companyName">,
  resolvedTicker: string | null,
  limit = 5,
): SuperinvestorQuarterlyTransaction[] {
  const matched = all.filter((tx) => holdingMatchesTransaction(row, tx, resolvedTicker));
  if (!Number.isFinite(limit) || limit <= 0) return matched;
  return matched.slice(0, limit);
}

/** Expanded holding panel: chart + sub-table window (matches standard profile load). */
export const SUPERINVESTOR_HOLDING_PANEL_YEARS = 5;
/** Activity rows in the expanded holding table before "Show all activity". */
export const SUPERINVESTOR_HOLDING_PANEL_TABLE_LIMIT = 5;

export function cutoffYmdYearsAgo(years: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export function filterSuperinvestorTransactionsSince(
  txs: readonly SuperinvestorQuarterlyTransaction[],
  cutoffYmd: string,
): SuperinvestorQuarterlyTransaction[] {
  const cutoff = cutoffYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) return [...txs];
  return txs.filter((tx) => tx.reportDate.trim() >= cutoff);
}

/** Quarterly txs for a holding within the panel window (newest first). */
export function holdingPanelTransactions(
  all: SuperinvestorQuarterlyTransaction[],
  row: Pick<Berkshire13fComparisonRow, "cusip" | "ticker" | "companyName">,
  resolvedTicker: string | null,
  years = SUPERINVESTOR_HOLDING_PANEL_YEARS,
): SuperinvestorQuarterlyTransaction[] {
  const matched = transactionsForHolding(all, row, resolvedTicker, 0);
  return filterSuperinvestorTransactionsSince(matched, cutoffYmdYearsAgo(years)).sort((a, b) =>
    b.reportDate.localeCompare(a.reportDate),
  );
}

export type HoldingEarlierActivitySummary = {
  purchaseCount: number;
  sellCount: number;
};

/** Activity before the holdings chart window (e.g. before the 5Y cutoff ≈ pre-2021). */
export function summarizeEarlierHoldingActivity(
  txs: readonly SuperinvestorQuarterlyTransaction[],
  chartWindowStartYmd: string,
): HoldingEarlierActivitySummary | null {
  const cutoff = chartWindowStartYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) return null;

  let purchaseCount = 0;
  let sellCount = 0;
  for (const tx of txs) {
    if (tx.reportDate.trim() >= cutoff) continue;
    if (superinvestorTransactionIsBuy(tx.kind)) purchaseCount += 1;
    else if (superinvestorTransactionIsSell(tx.kind)) sellCount += 1;
  }
  if (purchaseCount === 0 && sellCount === 0) return null;
  return { purchaseCount, sellCount };
}

export function formatEarlierActivityLines(summary: HoldingEarlierActivitySummary): string[] {
  const lines: string[] = [];
  if (summary.purchaseCount > 0) {
    const n = summary.purchaseCount;
    lines.push(`${n} purchase${n === 1 ? "" : "s"}`);
  }
  if (summary.sellCount > 0) {
    const n = summary.sellCount;
    lines.push(`${n} sell${n === 1 ? "" : "s"}`);
  }
  return lines;
}

/** Last N activity rows for the holding expand table (chart still uses full {@link holdingPanelTransactions}). */
export function holdingPanelTableTransactions(
  panelTransactions: readonly SuperinvestorQuarterlyTransaction[],
  limit = SUPERINVESTOR_HOLDING_PANEL_TABLE_LIMIT,
): SuperinvestorQuarterlyTransaction[] {
  if (!Number.isFinite(limit) || limit <= 0) return [...panelTransactions];
  return panelTransactions.slice(0, limit);
}

export function superinvestorTransactionsHasCompanySearchMatch(
  payload: SuperinvestorTransactionsPayload,
  query: string,
): boolean {
  const q = query.trim();
  if (q.length < 2) return true;
  return flattenSuperinvestorTransactions(payload.quarters).some((tx) =>
    transactionMatchesCompanySearch(tx, q),
  );
}

export function transactionMatchesCompanySearch(
  tx: SuperinvestorQuarterlyTransaction,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (tx.ticker?.trim().toLowerCase().includes(q)) return true;
  if (tx.cusip?.trim().toLowerCase().includes(q)) return true;
  if (normalizeSuperinvestorIssuerKey(tx.companyName).includes(q)) return true;
  if (tx.companyName.trim().toLowerCase().includes(q)) return true;
  if (tx.quarterLabel.trim().toLowerCase().includes(q)) return true;
  return false;
}

/** Search string for Transactions tab when drilling down from a holding row. */
export function companySearchQueryForHolding(
  row: Pick<Berkshire13fComparisonRow, "ticker" | "companyName">,
  resolvedTicker: string | null,
  displayName: string,
): string {
  const sym = row.ticker?.trim() || resolvedTicker?.trim();
  return sym ? sym.toUpperCase() : displayName.trim();
}
