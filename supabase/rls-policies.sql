-- Documents table policies
alter table public.documents enable row level security;

drop policy if exists "Users can view their own documents" on public.documents;
drop policy if exists "Users can insert their own documents" on public.documents;
drop policy if exists "Users can update their own documents" on public.documents;
drop policy if exists "Users can delete their own documents" on public.documents;

create policy "Users can view their own documents"
on public.documents
for select
using (auth.uid() = owner_id);

create policy "Users can insert their own documents"
on public.documents
for insert
with check (auth.uid() = owner_id);

create policy "Users can update their own documents"
on public.documents
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete their own documents"
on public.documents
for delete
using (auth.uid() = owner_id);

-- Storage policies for existing bucket: documents
-- Bucket creation is included as idempotent safety in case it does not exist.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own files" on storage.objects;
drop policy if exists "Users can upload their own files" on storage.objects;
drop policy if exists "Users can update their own files" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;

create policy "Users can read their own files"
on storage.objects
for select
using (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own files"
on storage.objects
for insert
with check (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own files"
on storage.objects
for update
using (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own files"
on storage.objects
for delete
using (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
