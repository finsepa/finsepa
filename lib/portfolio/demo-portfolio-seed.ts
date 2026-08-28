import {
  DEFAULT_DEMO_PORTFOLIO_NAME,
  newPortfolioId,
  newTransactionRowId,
  type PortfolioEntry,
  type PortfolioHolding,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import {
  nextPortfolioTransactionSequence,
  sortPortfolioTransactionsCanonical,
} from "@/lib/portfolio/ledger/portfolio-ledger-order";
import {
  replayTradeTransactionsToHoldings,
  replayTradeTransactionsToHoldingsUpTo,
} from "@/lib/portfolio/rebuild-holdings-from-trades";

/** Static illustrative prices (USD) near early-2023 for seeded demo buys.
 * Equity prices are on the **continuous / split-adjusted** scale (same as charts),
 * so later corporate actions (e.g. NFLX 10:1 on 2025-11-17) do not desync P&L.
 */
const DEMO_ASSETS: {
  symbol: string;
  name: string;
  weight: number;
  prices: [number, number, number, number];
}[] = [
  // prices index: Jan / Feb / Mar / Apr 2023 mid-month ballpark
  { symbol: "BTC-USD", name: "Bitcoin", weight: 0.15, prices: [21000, 23500, 27000, 29000] },
  { symbol: "ETH-USD", name: "Ethereum", weight: 0.1, prices: [1550, 1650, 1800, 1900] },
  { symbol: "SOL-USD", name: "Solana", weight: 0.05, prices: [22, 24, 21, 23] },
  { symbol: "QQQ", name: "Invesco QQQ Trust", weight: 0.2, prices: [280, 295, 310, 320] },
  { symbol: "TSLA", name: "Tesla", weight: 0.05, prices: [120, 190, 195, 165] },
  { symbol: "AAPL", name: "Apple", weight: 0.05, prices: [130, 150, 160, 165] },
  // NFLX: continuous scale after Nov 2025 10:1 (as-traded ~320 → ~32)
  { symbol: "NFLX", name: "Netflix", weight: 0.05, prices: [32, 34, 33, 33.3] },
  { symbol: "KO", name: "Coca-Cola", weight: 0.05, prices: [60, 59, 61, 64] },
  { symbol: "META", name: "Meta Platforms", weight: 0.05, prices: [130, 170, 200, 210] },
  { symbol: "COST", name: "Costco", weight: 0.05, prices: [480, 500, 490, 500] },
  { symbol: "SPGI", name: "S&P Global", weight: 0.05, prices: [340, 345, 340, 350] },
  { symbol: "V", name: "Visa", weight: 0.05, prices: [220, 225, 220, 230] },
  { symbol: "UBER", name: "Uber", weight: 0.05, prices: [28, 34, 32, 31] },
];

/**
 * Illustrative cash dividends for demo equities (DPS grows ~4%/yr).
 * Not a full corporate-actions feed — demo / marketing fidelity only.
 */
const DEMO_DIVIDEND_PAYERS: {
  symbol: string;
  name: string;
  /** Base quarterly cash dividend per share in 2023 USD. */
  baseQuarterlyDps: number;
  /** Monthly ETF style (QQQ) vs quarterly common stock. */
  cadence: "quarterly" | "monthly";
  /** First payable period on or after this date. */
  startYmd?: string;
}[] = [
  { symbol: "QQQ", name: "Invesco QQQ Trust", baseQuarterlyDps: 0.2, cadence: "monthly" },
  { symbol: "AAPL", name: "Apple", baseQuarterlyDps: 0.24, cadence: "quarterly" },
  { symbol: "KO", name: "Coca-Cola", baseQuarterlyDps: 0.46, cadence: "quarterly" },
  { symbol: "COST", name: "Costco", baseQuarterlyDps: 1.02, cadence: "quarterly" },
  { symbol: "SPGI", name: "S&P Global", baseQuarterlyDps: 0.9, cadence: "quarterly" },
  { symbol: "V", name: "Visa", baseQuarterlyDps: 0.45, cadence: "quarterly" },
  { symbol: "META", name: "Meta Platforms", baseQuarterlyDps: 0.5, cadence: "quarterly", startYmd: "2024-03-01" },
];

const BUY_DATES = ["2023-01-16", "2023-02-15", "2023-03-15", "2023-04-17"] as const;
const TOTAL_USD = 100_000;
const PER_MONTH_USD = TOTAL_USD / BUY_DATES.length;

const DEMO_DIV_EXTERNAL_PREFIX = "finsepa:demo:div:";
/** Bump when demo buy prices/share math change (e.g. post-split continuous scale). */
export const DEMO_LEDGER_REVISION = 3;
export const DEMO_SEED_EXTERNAL_ID = `finsepa:demo:seed:v${DEMO_LEDGER_REVISION}`;

export type DemoPortfolioSeed = {
  portfolio: PortfolioEntry;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
};

/** True when this demo ledger predates {@link DEMO_LEDGER_REVISION} (or has no seed marker). */
export function demoLedgerNeedsReseed(
  transactions: readonly PortfolioTransaction[],
): boolean {
  return !transactions.some(
    (t) => typeof t.externalId === "string" && t.externalId === DEMO_SEED_EXTERNAL_ID,
  );
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function roundShares(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function dpsForYear(baseQuarterly: number, year: number, cadence: "quarterly" | "monthly"): number {
  const grown = baseQuarterly * Math.pow(1.04, Math.max(0, year - 2023));
  return cadence === "monthly" ? grown / 3 : grown;
}

function demoHasSeededDividends(transactions: readonly PortfolioTransaction[]): boolean {
  return transactions.some(
    (t) =>
      (t.kind === "income" && t.operation.trim().toLowerCase() === "dividend") ||
      (typeof t.externalId === "string" && t.externalId.startsWith(DEMO_DIV_EXTERNAL_PREFIX)),
  );
}

/**
 * Cash dividend rows for demo holdings through {@link asOfYmd} (inclusive).
 * Amount = shares held × illustrative DPS; ledger sum increases cash → portfolio value.
 */
export function buildDemoDividendTransactions(
  portfolioId: string,
  transactions: readonly PortfolioTransaction[],
  asOfYmd: string = ymdUtc(new Date()),
): PortfolioTransaction[] {
  if (demoHasSeededDividends(transactions)) return [];

  const existingIds = new Set(transactions.map((t) => t.id));
  const existingExternal = new Set(
    transactions.map((t) => t.externalId).filter((x): x is string => typeof x === "string"),
  );

  const payEvents: { date: string; symbol: string; name: string; dps: number }[] = [];

  for (const payer of DEMO_DIVIDEND_PAYERS) {
    const start = payer.startYmd ?? "2023-01-01";
    const [sy, sm] = start.split("-").map(Number);
    let y = sy!;
    let m = sm!;

    // Walk months or quarter starts up to asOf.
    while (true) {
      const day = payer.cadence === "monthly" ? 15 : 15;
      const date = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
      if (date > asOfYmd) break;
      if (date >= start) {
        // Quarterly only on Mar/Jun/Sep/Dec
        const okMonth =
          payer.cadence === "monthly" || m === 3 || m === 6 || m === 9 || m === 12;
        if (okMonth) {
          payEvents.push({
            date,
            symbol: payer.symbol,
            name: payer.name,
            dps: dpsForYear(payer.baseQuarterlyDps, y, payer.cadence),
          });
        }
      }
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      // Safety cap (~8y of months)
      if (y > 2032) break;
    }
  }

  payEvents.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));

  const added: PortfolioTransaction[] = [];
  let working = sortPortfolioTransactionsCanonical(transactions);

  for (const ev of payEvents) {
    const externalId = `${DEMO_DIV_EXTERNAL_PREFIX}${ev.symbol}:${ev.date}`;
    if (existingExternal.has(externalId)) continue;

    const holds = replayTradeTransactionsToHoldingsUpTo(working, ev.date);
    const pos = holds.find((h) => h.symbol.trim().toUpperCase() === ev.symbol);
    if (!pos || !(pos.shares > 1e-9)) continue;

    const shares = roundShares(pos.shares);
    const dps = Math.round(ev.dps * 1e4) / 1e4;
    const sum = roundUsd(shares * dps);
    if (!(sum >= 0.01)) continue;

    const id = `tx_demo_div_${portfolioId}_${ev.symbol}_${ev.date}`;
    if (existingIds.has(id)) continue;

    const row: PortfolioTransaction = {
      id,
      portfolioId,
      kind: "income",
      operation: "Dividend",
      symbol: ev.symbol,
      name: ev.name,
      logoUrl: displayLogoUrlForPortfolioSymbol(ev.symbol) || null,
      date: ev.date,
      shares,
      price: dps,
      fee: 0,
      sum,
      profitPct: null,
      profitUsd: null,
      sequence: nextPortfolioTransactionSequence(working),
      note: "Demo dividend",
      externalId,
    };
    added.push(row);
    working = sortPortfolioTransactionsCanonical([...working, row]);
    existingIds.add(id);
    existingExternal.add(externalId);
  }

  return added;
}

/**
 * If this demo ledger has no dividend rows yet, append illustrative cash dividends
 * and return the full next transaction list. Otherwise return null (no-op).
 */
export function ensureDemoDividendTransactions(
  portfolioId: string,
  transactions: readonly PortfolioTransaction[],
  asOfYmd?: string,
): PortfolioTransaction[] | null {
  const added = buildDemoDividendTransactions(portfolioId, transactions, asOfYmd);
  if (added.length === 0) return null;
  return sortPortfolioTransactionsCanonical([...transactions, ...added]);
}

/**
 * Seeds a Free-plan demo portfolio: ~$100k diversified across crypto + mega-caps,
 * with proportional monthly buys over 4 months starting Jan 2023, plus sample cash dividends.
 */
export function buildDemoPortfolioSeed(
  existingPortfolioId?: string,
  options?: { name?: string },
): DemoPortfolioSeed {
  const portfolioId = existingPortfolioId?.trim() || newPortfolioId();
  const name = options?.name?.trim() || DEFAULT_DEMO_PORTFOLIO_NAME;
  const portfolio: PortfolioEntry = {
    id: portfolioId,
    name,
    privacy: "private",
    kind: "demo",
    isDemo: true,
  };

  const transactions: PortfolioTransaction[] = [];
  const weightSum = DEMO_ASSETS.reduce((s, a) => s + a.weight, 0);

  BUY_DATES.forEach((date, monthIdx) => {
    for (const asset of DEMO_ASSETS) {
      const budget = (PER_MONTH_USD * asset.weight) / weightSum;
      const price = asset.prices[monthIdx] ?? asset.prices[0]!;
      if (!(price > 0) || !(budget > 0)) continue;
      const shares = Math.round((budget / price) * 1e6) / 1e6;
      if (!(shares > 0)) continue;
      const gross = shares * price;
      transactions.push({
        id: newTransactionRowId(),
        portfolioId,
        kind: "trade",
        operation: "Buy",
        symbol: asset.symbol,
        name: asset.name,
        logoUrl: displayLogoUrlForPortfolioSymbol(asset.symbol) || null,
        date,
        shares,
        price,
        fee: 0,
        sum: -gross,
        profitPct: null,
        profitUsd: null,
      });
    }
  });

  // Initial cash cover so ledger cash stays non-negative after buys.
  transactions.unshift({
    id: newTransactionRowId(),
    portfolioId,
    kind: "cash",
    operation: "Cash In",
    symbol: "USD",
    name: "US Dollar",
    logoUrl: null,
    date: "2023-01-03",
    shares: TOTAL_USD,
    price: 1,
    fee: 0,
    sum: TOTAL_USD,
    profitPct: null,
    profitUsd: null,
    externalId: DEMO_SEED_EXTERNAL_ID,
  });

  transactions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.kind === "cash" && b.kind !== "cash") return -1;
    if (b.kind === "cash" && a.kind !== "cash") return 1;
    return 0;
  });

  const withDividends =
    ensureDemoDividendTransactions(portfolioId, transactions) ?? transactions;

  // Equity holdings unchanged by cash dividends; cash balance is in the ledger sum.
  const holdings = replayTradeTransactionsToHoldings(withDividends);

  return { portfolio, holdings, transactions: withDividends };
}
