-- Internal migration ledger (written by scripts/apply-supabase-migrations.mjs).
-- Not app data: block PostgREST / anon / authenticated access; service role + direct SQL only.

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated;
