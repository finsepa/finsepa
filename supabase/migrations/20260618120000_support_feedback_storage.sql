-- Private bucket for Help modal attachments (signed URLs in support emails).
insert into storage.buckets (id, name, public, file_size_limit)
values ('support-feedback', 'support-feedback', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- Service role (API route) manages objects; no public access.
create policy "Service role full access to support-feedback"
on storage.objects
for all
to service_role
using (bucket_id = 'support-feedback')
with check (bucket_id = 'support-feedback');
