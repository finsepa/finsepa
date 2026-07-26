/**
 * Finsepa Agent — cost & abuse caps.
 *
 * This module must NEVER import lib/market or EODHD. Agent MVP has no tools,
 * so one user cannot burn market-data credits via chat.
 */

export type AgentUsageSnapshot = {
  usageDate: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type AgentMonthlyUsageSnapshot = {
  /** UTC month key `YYYY-MM` */
  usageMonth: string;
  estimatedCostUsd: number;
};

/** gpt-4o-mini list prices (USD per 1M tokens). Update if model changes. */
export const AGENT_MODEL_ID = "gpt-4o-mini";
export const AGENT_INPUT_USD_PER_MTOK = 0.15;
export const AGENT_OUTPUT_USD_PER_MTOK = 0.6;

/** Shown when monthly spend cap is hit — keep generic; do not expose dollar amounts. */
export const AGENT_USAGE_LIMIT_MESSAGE =
  "You've reached your Agent usage limit. Please try again later.";

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const inCost = (Math.max(0, inputTokens) / 1_000_000) * AGENT_INPUT_USD_PER_MTOK;
  const outCost = (Math.max(0, outputTokens) / 1_000_000) * AGENT_OUTPUT_USD_PER_MTOK;
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Hard caps — env-overridable. Defaults keep a single user cheap. */
export function getAgentDailyCaps() {
  return {
    /** Max user messages per UTC day */
    maxMessagesPerDay: envInt("FINSEPA_AGENT_MAX_MESSAGES_PER_DAY", 40),
    /** Max estimated LLM spend per UTC day (USD) */
    maxCostUsdPerDay: envFloat("FINSEPA_AGENT_MAX_COST_USD_PER_DAY", 0.5),
    /** Max characters of conversation history sent to the model */
    maxHistoryChars: envInt("FINSEPA_AGENT_MAX_HISTORY_CHARS", 12_000),
    /** Max characters for a single user message */
    maxUserMessageChars: envInt("FINSEPA_AGENT_MAX_USER_MESSAGE_CHARS", 4_000),
  };
}

/** Per registered user, per UTC calendar month. Override with FINSEPA_AGENT_MAX_COST_USD_PER_MONTH. */
export function getAgentMonthlyCaps() {
  return {
    maxCostUsdPerMonth: envFloat("FINSEPA_AGENT_MAX_COST_USD_PER_MONTH", 15),
  };
}

export function utcUsageDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function utcUsageMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Inclusive UTC date bounds for the current calendar month. */
export function utcMonthDateRange(now = new Date()): { startDate: string; endDate: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startDate = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const endDate = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { startDate, endDate };
}

export function isOverDailyCap(usage: AgentUsageSnapshot): { over: boolean; reason: string | null } {
  const caps = getAgentDailyCaps();
  if (usage.messageCount >= caps.maxMessagesPerDay) {
    return {
      over: true,
      reason: `Daily message limit reached (${caps.maxMessagesPerDay}/day). Try again tomorrow.`,
    };
  }
  if (usage.estimatedCostUsd >= caps.maxCostUsdPerDay) {
    return {
      over: true,
      reason: `Daily AI allowance reached (≈$${caps.maxCostUsdPerDay.toFixed(2)}/day). Try again tomorrow.`,
    };
  }
  return { over: false, reason: null };
}

export function isOverMonthlyCap(
  usage: AgentMonthlyUsageSnapshot,
): { over: boolean; reason: string | null } {
  const { maxCostUsdPerMonth } = getAgentMonthlyCaps();
  if (usage.estimatedCostUsd >= maxCostUsdPerMonth) {
    return { over: true, reason: AGENT_USAGE_LIMIT_MESSAGE };
  }
  return { over: false, reason: null };
}
