import "server-only";

import {
  portfolioIsBrokerageOrigin,
  portfolioIsCombined,
  portfolioIsDemo,
  type PortfolioEntry,
  type PortfolioGoal,
} from "@/components/portfolio/portfolio-types";
import { buildDemoPortfolioSeed } from "@/lib/portfolio/demo-portfolio-seed";
import type { PersistedPortfolioState } from "@/lib/portfolio/portfolio-storage";

export type SeedDemoPortfolioResult =
  | {
      ok: true;
      state: PersistedPortfolioState;
      portfolioId: string;
      created: boolean;
      converted: boolean;
    }
  | {
      ok: true;
      alreadyExists: true;
      state: PersistedPortfolioState;
      portfolioId: string;
    };

function emptyWorkspaceState(): PersistedPortfolioState {
  return {
    v: 1,
    portfolios: [],
    selectedPortfolioId: null,
    holdingsByPortfolioId: {},
    transactionsByPortfolioId: {},
  };
}

function defaultDemoPortfolioGoal(now = new Date()): PortfolioGoal {
  const year = now.getFullYear();
  return {
    kind: "value",
    targetUsd: 1_000_000,
    // Matches the UX “5 Years” at 2026 -> 2031; remains 5 years from now.
    achieveByYear: year + 5,
    monthlyContributionUsd: 2_000,
    reinvestDividends: true,
    // Keep demo UX stable without running an annual-return provider path at sign-up.
    portfolioAnnualReturnPct: 28.52,
  };
}

function canConvertPortfolioToDemo(
  portfolio: PortfolioEntry,
  transactions: readonly unknown[],
): boolean {
  return (
    !portfolioIsDemo(portfolio) &&
    !portfolioIsCombined(portfolio) &&
    !portfolioIsBrokerageOrigin(portfolio) &&
    transactions.length === 0
  );
}

/**
 * Seeds (or focuses) the single allowed demo portfolio — mirrors web `openTryDemoPortfolio`.
 */
export function seedDemoPortfolioInWorkspace(
  rawState: PersistedPortfolioState | null,
  options?: { convertPortfolioId?: string | null },
): SeedDemoPortfolioResult {
  const state = rawState ?? emptyWorkspaceState();
  const holdingsByPortfolioId = { ...state.holdingsByPortfolioId };
  const transactionsByPortfolioId = { ...state.transactionsByPortfolioId };
  const goalByPortfolioId = { ...(state.goalByPortfolioId ?? {}) };

  const existingDemo = state.portfolios.find((p) => portfolioIsDemo(p));
  if (existingDemo) {
    if (!(existingDemo.id in goalByPortfolioId)) {
      goalByPortfolioId[existingDemo.id] = defaultDemoPortfolioGoal();
    }
    return {
      ok: true,
      alreadyExists: true,
      state: {
        ...state,
        selectedPortfolioId: existingDemo.id,
        goalByPortfolioId,
        savedAt: Date.now(),
      },
      portfolioId: existingDemo.id,
    };
  }

  const convertId = options?.convertPortfolioId?.trim() || null;
  const convertTarget = convertId ? state.portfolios.find((p) => p.id === convertId) : null;
  const convertTxs = convertTarget ? (transactionsByPortfolioId[convertTarget.id] ?? []) : [];

  if (convertTarget && canConvertPortfolioToDemo(convertTarget, convertTxs)) {
    const otherDemoIds = state.portfolios.filter((p) => portfolioIsDemo(p)).map((p) => p.id);
    const seed = buildDemoPortfolioSeed(convertTarget.id, { name: convertTarget.name });

    for (const id of otherDemoIds) {
      delete holdingsByPortfolioId[id];
      delete transactionsByPortfolioId[id];
      delete goalByPortfolioId[id];
    }

    const portfolios = state.portfolios
      .filter((p) => !otherDemoIds.includes(p.id))
      .map((p) => (p.id === convertTarget.id ? seed.portfolio : p));

    holdingsByPortfolioId[seed.portfolio.id] = seed.holdings;
    transactionsByPortfolioId[seed.portfolio.id] = seed.transactions;
    if (goalByPortfolioId[seed.portfolio.id] == null) {
      goalByPortfolioId[seed.portfolio.id] = defaultDemoPortfolioGoal();
    }

    return {
      ok: true,
      state: {
        ...state,
        portfolios,
        selectedPortfolioId: seed.portfolio.id,
        holdingsByPortfolioId,
        transactionsByPortfolioId,
        goalByPortfolioId,
        savedAt: Date.now(),
      },
      portfolioId: seed.portfolio.id,
      created: true,
      converted: true,
    };
  }

  const seed = buildDemoPortfolioSeed();
  const otherDemoIds = state.portfolios.filter((p) => portfolioIsDemo(p)).map((p) => p.id);
  for (const id of otherDemoIds) {
    delete holdingsByPortfolioId[id];
    delete transactionsByPortfolioId[id];
    delete goalByPortfolioId[id];
  }

  const portfolios = [...state.portfolios.filter((p) => !otherDemoIds.includes(p.id)), seed.portfolio];
  holdingsByPortfolioId[seed.portfolio.id] = seed.holdings;
  transactionsByPortfolioId[seed.portfolio.id] = seed.transactions;
  if (goalByPortfolioId[seed.portfolio.id] == null) {
    goalByPortfolioId[seed.portfolio.id] = defaultDemoPortfolioGoal();
  }

  return {
    ok: true,
    state: {
      ...state,
      portfolios,
      selectedPortfolioId: seed.portfolio.id,
      holdingsByPortfolioId,
      transactionsByPortfolioId,
      goalByPortfolioId,
      savedAt: Date.now(),
    },
    portfolioId: seed.portfolio.id,
    created: true,
    converted: false,
  };
}
