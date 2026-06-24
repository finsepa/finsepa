-- watchlist item rows: table grants for authenticated API access (RLS policies alone are not enough).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
