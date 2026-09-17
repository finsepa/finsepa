import type { PersistedPortfolioState } from "@/lib/portfolio/portfolio-storage";
import { persistedGoalUpdatedAt } from "@/components/portfolio/portfolio-types";

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

/**
 * Fingerprint of user-owned workspace data that should sync to the cloud.
 * Excludes live mark fields (`marketPrice` / `currentValue`) and `savedAt` so quote
 * refreshes do not look like newer edits and overwrite remote renames/deletes.
 */
export function portfolioWorkspacePersistFingerprint(saved: PersistedPortfolioState): string {
  const portfolioSig = [...saved.portfolios]
    .map((p) => {
      const st = p.snaptrade;
      const snap =
        st == null ? "" : [
          st.authorizationId,
          [...st.accountIds].sort().join(","),
          st.brokerageName ?? "",
          st.brokerageSlug ?? "",
          st.offline === true ? "1" : "0",
          st.syncedAt,
        ].join("~");
      return [
        p.id,
        p.name,
        p.privacy,
        p.kind ?? "",
        p.isDemo === true ? "1" : "0",
        [...(p.combinedFrom ?? [])].sort().join(","),
        snap,
      ].join(":");
    })
    .sort()
    .join("|");

  const pids = [...saved.portfolios.map((p) => p.id)].sort();
  const holdingParts: string[] = [];
  const txParts: string[] = [];
  const goalParts: string[] = [];

  for (const pid of pids) {
    const holds = saved.holdingsByPortfolioId[pid] ?? [];
    holdingParts.push(
      `${pid}@${[...holds]
        .map((h) => `${h.id}:${h.symbol}:${h.shares}:${h.avgPrice}:${h.costBasis}`)
        .sort()
        .join(",")}`,
    );
    const txs = saved.transactionsByPortfolioId[pid] ?? [];
    txParts.push(
      `${pid}#${[...txs]
        .map(
          (t) =>
            `${t.id}:${t.date}:${t.kind}:${t.operation}:${t.symbol}:${t.shares}:${t.price}:${t.fee}:${t.sequence ?? ""}`,
        )
        .sort()
        .join("|")}`,
    );
    const goal = saved.goalByPortfolioId?.[pid];
    if (goal != null) {
      goalParts.push(`${pid}G${persistedGoalUpdatedAt(goal)}:${JSON.stringify(goal)}`);
    }
  }

  return [
    saved.selectedPortfolioId ?? "",
    portfolioSig,
    holdingParts.join(";"),
    txParts.join(";"),
    goalParts.sort().join(";"),
  ].join("::");
}
