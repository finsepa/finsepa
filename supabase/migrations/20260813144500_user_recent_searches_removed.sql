-- Tombstones for single-item recent-search deletes (cross-device).
-- Map: { "stock:PYPL.US": "2026-08-13T12:00:00.000Z", ... }

ALTER TABLE public.user_recent_searches
  ADD COLUMN IF NOT EXISTS removed jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_recent_searches.removed IS
  'id → ISO removedAt; items with recordedAt older than tombstone are dropped on merge.';
