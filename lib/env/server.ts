import "server-only";

/**
 * Server-only provider keys. Import from Route Handlers / Server Actions only.
 * Client code must never read EODHD_API_KEY or FINNHUB_API_KEY.
 */
export function getEodhdApiKey(): string | undefined {
  const v = process.env.EODHD_API_KEY?.trim();
  return v || undefined;
}

export function getFinnhubApiKey(): string | undefined {
  const v = process.env.FINNHUB_API_KEY?.trim();
  return v || undefined;
}

/** Supabase service role key (server-only). Used for privileged reads (e.g. global watchlist counts). */
export function getSupabaseServiceRoleKey(): string | undefined {
  const a = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (a) return a;
  const b = process.env.SUPABASE_SERVICE_KEY?.trim();
  return b || undefined;
}

/** OpenAI API key (server-only). Used for portfolio import column mapping. */
export function getOpenAiApiKey(): string | undefined {
  const v = process.env.OPENAI_API_KEY?.trim();
  return v || undefined;
}
