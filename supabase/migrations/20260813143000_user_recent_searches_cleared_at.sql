-- Authoritative clear for cross-device recent-search sync (iOS ↔ web).

ALTER TABLE public.user_recent_searches
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

COMMENT ON COLUMN public.user_recent_searches.cleared_at IS
  'When set, client items with recordedAt older than this are dropped on merge; empty items after clear is authoritative.';
