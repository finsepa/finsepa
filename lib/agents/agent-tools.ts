/**
 * Cheap Agent tools — Supabase user state + warm hub snapshots only.
 * NEVER import EODHD fetchers or cold stock-page loaders here.
 */
import "server-only";

import { tool } from "ai";
import { z } from "zod";

import {
  loadAgentEarningsWeek,
  loadAgentEconomyWeek,
  loadAgentMacroDashboard,
} from "@/lib/agents/agent-hub-calendars";
import {
  HUB_SNAPSHOT_KEY,
  newsHubSegment,
  readHubSnapshot,
} from "@/lib/agents/agent-hub-snapshot";
import {
  buildAgentPortfolioActivityDigest,
  buildAgentPortfolioAllocation,
  buildAgentPortfolioCash,
  buildAgentPortfolioConcentration,
  buildAgentPortfolioHolding,
  buildAgentPortfolioHoldingsCompare,
  buildAgentPortfolioIncome,
  buildAgentPortfolioList,
  buildAgentPortfolioSummary,
  buildAgentPortfolioTransactions,
  loadAgentPortfolioWorkspace,
} from "@/lib/agents/agent-portfolio-bundle";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listSuperinvestorFollowsForUser } from "@/lib/superinvestors/follow-operations";
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

function labelFromSuperinvestorPath(profilePath: string): { slug: string; name: string; path: string } {
  const path = profilePath.startsWith("/") ? profilePath : `/${profilePath}`;
  const slug = path.replace(/^\/superinvestors\//, "").replace(/\/+$/, "");
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { slug, name: name || slug, path };
}

async function loadFollowedSuperinvestors(userId: string) {
  try {
    const supabase = await getSupabaseServerClient();
    const rows = await listSuperinvestorFollowsForUser(supabase, userId);
    return {
      ok: true as const,
      openInApp: "/superinvestors",
      count: rows.length,
      follows: rows.map((r) => {
        const meta = labelFromSuperinvestorPath(r.profile_path);
        return {
          ...meta,
          followedAt: r.created_at,
        };
      }),
      note: "Followed superinvestors from your Finsepa account — profile list only, no 13F holdings payload.",
    };
  } catch {
    return {
      ok: false as const,
      openInApp: "/superinvestors" as const,
      error: "Could not load followed superinvestors.",
    };
  }
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

    list_portfolios: tool({
      description:
        "List the user's Finsepa portfolios (name, id, kind, holding/transaction counts) from the saved workspace. Use to discover which fund to query or answer 'what portfolios do I have'. No holdings detail and no live prices.",
      inputSchema: z.object({}),
      execute: async () =>
        withPortfolioWorkspace(userId, (workspace) => buildAgentPortfolioList({ workspace })),
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

    get_portfolio_holding: tool({
      description:
        "One portfolio holding by ticker from saved marks: shares, cost, worth, weight, unrealized P/L. Use for 'how much NFLX do I own' or details on a single position. Prefer this over get_portfolio_summary when asking about one symbol.",
      inputSchema: z.object({
        symbol: z.string().trim().min(1).max(24).describe("Ticker symbol, e.g. NFLX or BTC-USD"),
        portfolio: portfolioNameSchema,
      }),
      execute: async ({ symbol, portfolio }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioHolding({
            workspace,
            portfolioQuery: portfolio,
            symbol,
          }),
        ),
    }),

    get_portfolio_activity_digest: tool({
      description:
        "Recent portfolio ledger activity digest: counts by kind (trade/cash/income/expense) plus the latest N rows. Use for 'what did I trade recently' or activity overview. Ledger only — no live prices.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ portfolio, limit }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioActivityDigest({
            workspace,
            portfolioQuery: portfolio,
            limit,
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

    get_portfolio_concentration: tool({
      description:
        "Portfolio concentration from saved marks: cash vs equity weights, stock vs crypto split, top N holdings by weight, top-N combined weight. Use for 'am I concentrated' or 'largest positions'. No live prices.",
      inputSchema: z.object({
        portfolio: portfolioNameSchema,
        topN: z.number().int().min(1).max(20).default(5),
      }),
      execute: async ({ portfolio, topN }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioConcentration({
            workspace,
            portfolioQuery: portfolio,
            topN,
          }),
        ),
    }),

    compare_portfolio_holdings: tool({
      description:
        "Compare holdings between two portfolios (overlap / only-in-A / only-in-B) and/or check whether specific tickers are held. Use for 'do I own NFLX and AAPL' or 'overlap between R1 and OOO'. Symbols from saved holdings only.",
      inputSchema: z.object({
        portfolioA: portfolioNameSchema.describe("First portfolio (defaults to selected)."),
        portfolioB: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .optional()
          .describe("Second portfolio name or id for overlap compare."),
        symbols: z
          .array(z.string().trim().min(1).max(24))
          .max(40)
          .optional()
          .describe("Optional tickers to check ownership for."),
      }),
      execute: async ({ portfolioA, portfolioB, symbols }) =>
        withPortfolioWorkspace(userId, (workspace) =>
          buildAgentPortfolioHoldingsCompare({
            workspace,
            portfolioA,
            portfolioB,
            symbols,
          }),
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

    get_followed_superinvestors: tool({
      description:
        "List superinvestors the user follows in Finsepa (profile paths). Use for 'who do I follow' on Superinvestors. Does not load 13F holdings.",
      inputSchema: z.object({}),
      execute: async () => loadFollowedSuperinvestors(userId),
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

    get_earnings_week: tool({
      description:
        "This week's (or nearby week's) earnings calendar from the warm Finsepa hub cache — tickers by weekday with timing and estimates when present. Use for 'who reports this week'. If cold, tell the user to open /earnings — do not invent reports.",
      inputSchema: z.object({
        weekOffset: z
          .number()
          .int()
          .min(-2)
          .max(4)
          .default(0)
          .describe("0 = current week, 1 = next week, -1 = prior week."),
        limitPerDay: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ weekOffset, limitPerDay }) =>
        loadAgentEarningsWeek({ weekOffset, limitPerDay }),
    }),

    get_economy_week: tool({
      description:
        "This week's (or nearby week's) economic calendar from the warm Finsepa hub cache — events by weekday (CPI, NFP, FOMC, etc.). Use for 'what's on the economy calendar'. If cold, tell the user to open /economy — do not invent events.",
      inputSchema: z.object({
        weekOffset: z
          .number()
          .int()
          .min(-2)
          .max(4)
          .default(0)
          .describe("0 = current week, 1 = next week, -1 = prior week."),
        country: z.string().trim().min(2).max(3).default("US"),
        limitPerDay: z.number().int().min(1).max(25).default(10),
        minImportance: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .default(1)
          .describe("1 = all, 2 = medium+, 3 = high impact only."),
      }),
      execute: async ({ weekOffset, country, limitPerDay, minImportance }) =>
        loadAgentEconomyWeek({ weekOffset, country, limitPerDay, minImportance }),
    }),

    get_macro_dashboard: tool({
      description:
        "Macro dashboard latest readings from the warm Finsepa hub cache (rates, CAPE, CPI-like series, etc.). Use for 'where is the 10Y' or macro snapshot questions. If cold, tell the user to open /macro — do not invent numbers.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(40).default(24),
      }),
      execute: async ({ limit }) => loadAgentMacroDashboard({ limit }),
    }),

    get_app_links: tool({
      description:
        "Return Finsepa in-app paths for common areas and deep links (watchlist, portfolio, charting, screener, earnings, economy, macro, heatmaps, superinvestors, comparison, agent, account).",
      inputSchema: z.object({}),
      execute: async () => ({
        links: [
          { label: "Watchlist", path: "/watchlist" },
          { label: "Portfolio", path: "/portfolio" },
          { label: "Portfolios directory", path: "/portfolios" },
          { label: "Charting", path: "/charting" },
          { label: "Comparison", path: "/comparison" },
          { label: "Screener", path: "/screener" },
          { label: "Earnings", path: "/earnings" },
          { label: "Economy", path: "/economy" },
          { label: "Macro", path: "/macro" },
          { label: "Heatmaps", path: "/heatmaps" },
          { label: "Superinvestors", path: "/superinvestors" },
          { label: "News", path: "/news" },
          { label: "Agent", path: "/agents" },
          { label: "Account", path: "/account" },
        ],
        note: "Use bare paths in replies (e.g. /portfolio). Prefer these over inventing URLs.",
      }),
    }),
  };
}
