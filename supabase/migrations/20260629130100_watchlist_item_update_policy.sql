-- Reorder sync updates sort_order on existing rows; without UPDATE policy PostgREST returns 0 rows.

DROP POLICY IF EXISTS "Users update own watchlist rows" ON public.watchlist;
CREATE POLICY "Users update own watchlist rows"
  ON public.watchlist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT UPDATE ON public.watchlist TO authenticated;
