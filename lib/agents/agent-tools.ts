/**
 * Cheap Agent tools — Supabase user state + warm hub snapshots only.
 * NEVER import EODHD fetchers or cold stock-page loaders here.
 */
import "server-only";

import { tool } from "ai";
import { z } from "zod";

import {
  HUB_SNAPSHOT_KEY,
  newsHubSegment,
  readHubSnapshot,
} from "@/lib/agents/agent-hub-snapshot";
import {
  buildAgentPortfolioAllocation,
  buildAgentPortfolioCash,
  buildAgentPortfolioIncome,
  buildAgentPortfolioSummary,
  buildAgentPortfolioTransactions,
  loadAgentPortfolioWorkspace,
} from "@/lib/agents/agent-portfolio-bundle";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getWatchlistSnapshot } from "@/lib/watchlist/operations";
import type { NewsItem, NewsTab } from "@/lib/news/news-types";

async function loadWatchlistSummary(userId: string) {
  const supabase = await getSupabaseServerClient();
  const snapshot = await getWatchlistSnapshot(supabase, userId);
  const collections = snapshot.collections.map((c) => ({
    id: c.id,
    name: c.name,
    tickers: c.tickers,
    tickerCount: c.tickers.length,
  }));
  const active = collections.find((c) => c.id === snapshot.activeCollectionId) ?? collections[0] ?? null;
  return {
    activeCollection: active,
    collections,
    openInApp: "/watchlist",
    note: "Tickers only — no live prices (Agent does not call market-data APIs).",
  };
}

async function withPortfolioWorkspace<T>(
  userId: string,
  run: (workspace: import("@/lib/agents/agent-portfolio-bundle").AgentPortfolioWorkspace) => T,
): Promise<T | Awaited<ReturnType<typeof loadAgentPortfolioWorkspace>>> {
  const loaded = await loadAgentPortfolioWorkspace(userId);
  if (!loaded.ok) return loaded;
  if ("empty" in loaded && loaded.empty) return loaded;
  if (!("workspace" in loaded) || !loaded.workspace) return loaded;
  return run(loaded.workspace);
}

async function loadNewsHeadlines(tab: NewsTab, limit: number) {
  const segment = newsHubSegment(tab);
  const key =
    tab === "crypto"
      ? HUB_SNAPSHOT_KEY.newsCrypto
      : tab === "indices"
        ? HUB_SNAPSHOT_KEY.newsIndices
        : HUB_SNAPSHOT_KEY.newsStocks;

  const payload = await readHubSnapshot<NewsItem[] | { items?: NewsItem[] }>(key, segment);
  if (!payload) {
    return {
      ok: false as const,
      tab,
      openInApp: "/news",
      note: "News hub snapshot is not warm. Open News in Finsepa — Agent will not cold-fetch market news APIs.",
    };
  }

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : [];

  return {
    ok: true as const,
    tab,
    openInApp: "/news",
    headlines: items.slice(0, limit).map((n) => ({
      title: n.title,
      symbol: n.assetSymbol ?? null,
      publishedAt: n.publishedAt ?? null,
      source: n.source ?? null,
      url: n.url ?? null,
    })),
    note: "From Finsepa hub cache only — not a live EODHD pull.",
  };
}

const portfolioNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional()
  .describe("Portfolio name or id. Defaults to the user's last selected portfolio.");

export function createCheapAgentTools(userId: string) {
  return {
    get_watchlist: tool({
      description:
        "Load the signed-in user's Finsepa watchlist collections and tickers from Supabase. Use when they ask what is on their watchlist or which tickers they follow. Does not include live prices.",
      inputSchema: z.object({}),
      execute: async () => loadWatchlistSummary(userId),
    }),

    get_portfolio_summary: tool({
      description:
        "Portfolio overview + holdings from saved workspace: net worth, cash, invested cost, unrealized/realized/lifetime profit (saved marks), stock vs crypto split, turnover approx, and holdings with shares/cost/worth/weight. Use for portfolio summary, holdings, P/L from saved marks, top positions. Optional portfolio name.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
        holdingsLimit: z.number().int().min(1).max(60).default(40),
      }),
      execute: async ({ portfolio, holdingsLimit }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioSummary({
            workspace,
            portfolioQuery: portfolio,
            holdingsLimit,
          }),
        ),
    }),

    get_portfolio_cash: tool({
      description:
        "Cash balance and recent Cash In/Out movements from the portfolio ledger. Use when the user asks about cash, deposits, or withdrawals.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
        limit: z.number().int().min(1).max(80).default(30),
      }),
      execute: async ({ portfolio, limit }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioCash({ workspace, portfolioQuery: portfolio, limit }),
        ),
    }),

    get_portfolio_transactions: tool({
      description:
        "Transaction ledger rows (trades, cash, income, expenses). Filter by kind and/or symbol. Use for trade history, buys/sells, recent activity.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
        kind: z.enum(["all", "trade", "cash", "income", "expense"]).default("all"),
        symbol: z.string().trim().min(1).max(24).optional(),
        limit: z.number().int().min(1).max(100).default(40),
      }),
      execute: async ({ portfolio, kind, symbol, limit }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioTransactions({
            workspace,
            portfolioQuery: portfolio,
            kind,
            symbol,
            limit,
          }),
        ),
    }),

    get_portfolio_allocation: tool({
      description:
        "Allocation weights by holding (+ cash) from saved marks. Use for 'how is my portfolio allocated' or concentration / weights.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
      }),
      execute: async ({ portfolio }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioAllocation({ workspace, portfolioQuery: portfolio }),
        ),
    }),

    get_portfolio_income: tool({
      description:
        "Recorded dividends/income and expenses from the ledger (not an upcoming dividend calendar). Use for dividend history or expenses already booked.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
        limit: z.number().int().min(1).max(80).default(40),
      }),
      execute: async ({ portfolio, limit }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioIncome({ workspace, portfolioQuery: portfolio, limit }),
        ),
    }),

    get_news_headlines: tool({
      description:
        "Load recent Finsepa news hub headlines from the warm cache (stocks, crypto, or indices). Use for 'what's in the news'. If the cache is cold, tell the user to open News — do not invent headlines.",
      inputSchema: z.object({
        tab: z.enum(["stocks", "crypto", "indices"]).default("stocks"),
        limit: z.number().int().min(1).max(15).default(8),
      }),
      execute: async ({ tab, limit }) => loadNewsHeadlines(tab, limit),
    }),

    get_app_links: tool({
      description:
        "Return Finsepa in-app paths the user can open for common areas (watchlist, portfolio, screener, earnings, news, macro, agent).",
      inputSchema: z.object({}),
      execute: async () => ({
        links: [
          { label: "Watchlist", path: "/watchlist" },
          { label: "Portfolio", path: "/portfolio" },
          { label: "Screener", path: "/screener" },
          { label: "Earnings", path: "/earnings" },
          { label: "News", path: "/news" },
          { label: "Macro", path: "/macro" },
          { label: "Agent", path: "/agents" },
        ],
      }),
    }),
  };
}
