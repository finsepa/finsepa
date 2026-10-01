import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { replayPortfolioLedger } from "@/lib/portfolio/ledger/portfolio-ledger-engine";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

export type DisplayLedgerReplay = {
  holdings: PortfolioHolding[];
  realizedGainUsd: number;
  realizedCostBasisUsd: number;
};

function replayOneDisplay(
  transactions: readonly PortfolioTransaction[],
  asOfYmd: string | undefined,
): DisplayLedgerReplay {
  const { transactions: migrated } = migratePortfolioTransactionSequences([...transactions]);
  const r = replayPortfolioLedger(migrated, { mode: "display", asOfYmd });
  return {
    holdings: r.holdings,
    realizedGainUsd: r.realizedGainUsd,
    realizedCostBasisUsd: r.realizedCostBasisUsd,
  };
}

function mergeReplayHoldings(lists: PortfolioHolding[][]): PortfolioHolding[] {
  const bySymbol = new Map<string, PortfolioHolding>();
  for (const list of lists) {
    for (const h of list) {
      const key = h.symbol.toUpperCase();
      const prev = bySymbol.get(key);
      if (!prev) {
        bySymbol.set(key, { ...h });
        continue;
      }
      const shares = prev.shares + h.shares;
      const costBasis = prev.costBasis + h.costBasis;
      const currentValue = prev.currentValue + h.currentValue;
      bySymbol.set(key, {
        ...prev,
        shares,
        costBasis,
        avgPrice: shares > 0 ? costBasis / shares : 0,
        marketPrice: shares > 0 ? currentValue / shares : prev.marketPrice,
        currentValue,
      });
    }
  }
  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/**
 * Display-mode replay that keeps each portfolio's ledger isolated. Merged ledgers
 * (combined portfolios, home total) must not let one portfolio's split or sell act on
 * another portfolio's shares.
 */
export function replayDisplayLedgerPerPortfolio(
  transactions: readonly PortfolioTransaction[],
  asOfYmd?: string,
): DisplayLedgerReplay {
  const groups = new Map<string, PortfolioTransaction[]>();
  for (const t of transactions) {
    const pid = t.portfolioId ?? "";
    const list = groups.get(pid);
    if (list) list.push(t);
    else groups.set(pid, [t]);
  }
  if (groups.size <= 1) return replayOneDisplay(transactions, asOfYmd);

  const parts = [...groups.values()].map((g) => replayOneDisplay(g, asOfYmd));
  return {
    holdings: mergeReplayHoldings(parts.map((p) => p.holdings)),
    realizedGainUsd: parts.reduce((s, p) => s + p.realizedGainUsd, 0),
    realizedCostBasisUsd: parts.reduce((s, p) => s + p.realizedCostBasisUsd, 0),
  };
}
