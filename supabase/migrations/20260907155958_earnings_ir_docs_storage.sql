-- Public bucket for mirrored IR earnings PDFs (Quartr-style hosted docs).
-- Preview via /api/ir-pdf; vault locks point at these public object URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'earnings-ir-docs',
  'earnings-ir-docs',
  true,
  52428800, -- 50 MB
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public read (bucket is public; policy still required for listing in some setups).
drop policy if exists "Public read earnings-ir-docs" on storage.objects;
create policy "Public read earnings-ir-docs"
on storage.objects
for select
to public
using (bucket_id = 'earnings-ir-docs');

-- Service role manages uploads/overwrites from cron/scripts.
drop policy if exists "Service role full access to earnings-ir-docs" on storage.objects;
create policy "Service role full access to earnings-ir-docs"
on storage.objects
for all
to service_role
using (bucket_id = 'earnings-ir-docs')
with check (bucket_id = 'earnings-ir-docs');
