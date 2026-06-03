import type {
  Berkshire13fComparisonRow,
  Holding13fComparisonStatus,
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
  if (t === "Bought —" || t === "Bought –" || t === "Bought -") return "Bought";
  if (t === "Increased on —" || t === "Increased on –") return "Increased";
  if (t === "Reducing on —" || t === "Reducing on –") return "Reducing";
  return t.replace(/\s+[—–]\s*$/u, "").trim();
}

/** First line of transaction Recent Activity (e.g. `Reducing on -4.3%`). */
export function superinvestorTransactionActivityHeadline(
  kind: SuperinvestorQuarterlyTransactionKind,
  sharesChangePct: number | null,
  sharesDelta: number | null = null,
): string {
  const pct = formatTxPctSigned(sharesChangePct, kind);
  let line: string;
  switch (kind) {
    case "new":
      line = pct ? `Bought ${pct}` : "Bought";
      break;
    case "buy":
      line = pct ? `Increased on ${pct}` : "Increased";
      break;
    case "sell":
      line = pct ? `Reducing on ${pct}` : "Reducing";
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
  quarterLabel: string;
  /** Same copy as transactions table line 1 (`Reducing on -4.3%`, etc.). */
  activityDetail: string;
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

/** Latest quarter + action for the holdings table Recent Activity column. */
export function resolveHoldingRecentActivity(
  row: Pick<
    Berkshire13fComparisonRow,
    "cusip" | "ticker" | "companyName" | "status" | "sharesChangePct" | "sharesDelta"
  >,
  all: SuperinvestorQuarterlyTransaction[],
  resolvedTicker: string | null,
  currentQuarterLabel: string | null,
  hasPriorFiling: boolean,
): HoldingRecentActivityDisplay | null {
  const [latest] = transactionsForHolding(all, row, resolvedTicker, 1);
  if (latest) {
    return {
      quarterLabel: latest.quarterLabel,
      activityDetail: superinvestorTransactionActivityHeadline(
        latest.kind,
        latest.sharesChangePct,
        latest.sharesDelta,
      ),
      positive: latest.kind === "buy" || latest.kind === "new",
    };
  }

  if (!hasPriorFiling || !row.status || row.status === "unchanged") return null;
  const pct = row.sharesChangePct;
  if (pct == null || !Number.isFinite(pct) || pct === 0) return null;
  const kind = comparisonStatusToTxKind(row.status);
  if (!kind || !currentQuarterLabel?.trim()) return null;

  return {
    quarterLabel: currentQuarterLabel.trim(),
    activityDetail: superinvestorTransactionActivityHeadline(kind, pct, row.sharesDelta ?? null),
    positive: pct > 0,
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
  const ticker = (row.ticker?.trim() || resolvedTicker?.trim() || "").toUpperCase();
  const txTicker = tx.ticker?.trim().toUpperCase() ?? "";
  if (ticker && txTicker && ticker === txTicker) return true;

  const cusip = row.cusip?.trim().toUpperCase() ?? "";
  const txCusip = tx.cusip?.trim().toUpperCase() ?? "";
  if (cusip.length >= 6 && txCusip.length >= 6 && cusip === txCusip) return true;

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
  return filterSuperinvestorTransactionsSince(matched, cutoffYmdYearsAgo(years));
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
