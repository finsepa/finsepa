-- Agent MVP: per-user daily LLM usage (no market data; metering only).
CREATE TABLE IF NOT EXISTS public.agent_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS agent_usage_daily_date_idx
  ON public.agent_usage_daily (usage_date DESC);

COMMENT ON TABLE public.agent_usage_daily IS
  'Per-user daily LLM token/cost accounting for Finsepa Agent. No EODHD / market-data coupling.';

ALTER TABLE public.agent_usage_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_usage_daily FROM anon, authenticated;

-- Users may read their own usage (UI). Writes go through service role from the API.
DROP POLICY IF EXISTS "Users read own agent usage" ON public.agent_usage_daily;
CREATE POLICY "Users read own agent usage"
  ON public.agent_usage_daily
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
