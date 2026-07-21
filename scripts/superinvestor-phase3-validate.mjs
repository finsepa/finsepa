#!/usr/bin/env node
/**
 * Superinvestors Phase 3 — automated validation (PASS/FAIL matrix).
 * Thin wrapper around the parity audit that prints a checklist table.
 *
 * Usage: npm run superinvestors:phase3-validate
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const audit = spawnSync(
  "node",
  ["--env-file=.env.local", "scripts/superinvestor-phase3-parity-audit.mjs", ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() },
);

const path = "docs/SUPERINVESTORS-PHASE-3-PARITY-AUDIT.json";
if (!existsSync(path)) {
  console.error("Audit JSON missing");
  process.exit(1);
}

const summary = JSON.parse(readFileSync(path, "utf8"));

const CHECK_IDS = [
  "filing_freshness",
  "holdings_count",
  "weights_sum",
  "ticker_resolution",
  "duplicate_rows",
  "portfolio_value",
  "shares_values_spot",
];

console.log("\n=== PHASE 3 VALIDATION MATRIX ===\n");
console.log(
  "Manager".padEnd(20) +
    CHECK_IDS.map((c) => c.slice(0, 10).padEnd(11)).join("") +
    "VERDICT",
);

let hardFails = 0;
for (const r of summary.results) {
  const byId = new Map((r.checks ?? []).map((c) => [c.id, c]));
  const cells = CHECK_IDS.map((id) => {
    const c = byId.get(id);
    if (!c) return "—".padEnd(11);
    return (c.pass ? "PASS" : "FAIL").padEnd(11);
  }).join("");
  if (r.verdict === "FAIL") hardFails++;
  console.log(`${(r.name ?? r.slug).padEnd(20)}${cells}${r.verdict}`);
}

console.log(
  `\nOverall: PASS=${summary.pass} WATCH=${summary.watch} FAIL=${summary.fail}`,
);

process.exit(audit.status === 0 && hardFails === 0 ? 0 : 1);
