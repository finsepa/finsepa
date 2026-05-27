import type { PersistedPortfolioState } from "@/lib/portfolio/portfolio-storage";

/** Stable key for deduping live-quote / overview fetches when hydrate re-applies the same ledger. */
export function portfolioLedgerFingerprint(saved: PersistedPortfolioState): string {
  const parts: string[] = [
    saved.selectedPortfolioId ?? "",
    String(saved.savedAt ?? 0),
  ];
  const pids = [...saved.portfolios.map((p) => p.id)].sort();
  for (const pid of pids) {
    const txs = saved.transactionsByPortfolioId[pid] ?? [];
    const txSig = txs
      .map((t) => `${t.id}:${t.date}:${t.kind}:${t.operation}:${t.symbol}:${t.shares}:${t.price}:${t.fee}`)
      .sort()
      .join("|");
    parts.push(`${pid}#${txSig}`);
  }
  return parts.join(";");
}
