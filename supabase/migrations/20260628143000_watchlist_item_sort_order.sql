-- Per-collection ticker order inside a watchlist.

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY collection_id
      ORDER BY created_at ASC, id ASC
    ) - 1 AS rn
  FROM public.watchlist
)
UPDATE public.watchlist AS w
SET sort_order = ranked.rn
FROM ranked
WHERE w.id = ranked.id;

CREATE INDEX IF NOT EXISTS watchlist_collection_sort_order_idx
  ON public.watchlist (collection_id, sort_order);
