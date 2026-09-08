/**
 * Phase-1 IR vault checklist (top screener mcap names).
 *
 * Usage:
 *   npm run earnings:ir-vault
 *   npm run earnings:ir-vault -- --list
 *   npm run earnings:ir-vault -- --top=35
 *   npm run earnings:ir-vault -- --tickers=NVDA,AAPL,MA
 *
 * Runs IR-only backfill (no SEC), merges into earnings_ir_vault, prints green/yellow/red report.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const { backfillEarningsIrVaultUniverse, formatIrVaultChecklistText } = await import(
    "../lib/market/earnings-ir-vault-backfill"
  );
  const { EARNINGS_IR_VAULT_TOP_N } = await import("../lib/market/earnings-ir-vault-types");

  let topN = EARNINGS_IR_VAULT_TOP_N;
  let tickers: string[] | undefined;
  let listOnly = false;
  for (const a of process.argv.slice(2)) {
    if (a === "--list") listOnly = true;
    if (a.startsWith("--top=")) {
      const n = Number(a.slice("--top=".length));
      if (Number.isFinite(n) && n > 0) topN = Math.min(100, Math.floor(n));
    }
    if (a.startsWith("--tickers=")) {
      tickers = a
        .slice("--tickers=".length)
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
    }
  }

  if (listOnly) {
    const { listEarningsIrVaultUniverse } = await import("../lib/market/earnings-ir-vault-universe");
    const universe = await listEarningsIrVaultUniverse(topN);
    console.log(`IR vault universe top ${topN} (${universe.length}): ${universe.join(",")}`);
    return;
  }

  console.log(
    tickers?.length
      ? `IR vault backfill for ${tickers.join(",")}…`
      : `IR vault backfill for screener top ${topN}…`,
  );
  const result = await backfillEarningsIrVaultUniverse({ topN, tickers });
  console.log(formatIrVaultChecklistText(result));
  const failed = result.perTicker.filter((t) => t.error).length;
  if (failed > 0) process.exitCode = 2;
  else if (result.summary.red === result.tickers.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
