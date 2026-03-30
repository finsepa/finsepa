-- Optional: enables global watchlist counts without the service role key (RPC is callable with the anon key).
-- Apply in Supabase SQL Editor or via CLI if you use migrations.

CREATE OR REPLACE FUNCTION public.count_watchlist_for_ticker(p_ticker text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.watchlist
  WHERE ticker = upper(trim(p_ticker));
$$;

REVOKE ALL ON FUNCTION public.count_watchlist_for_ticker(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_watchlist_for_ticker(text) TO anon, authenticated, service_role;
