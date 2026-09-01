-- Documents table policies
alter table public.documents enable row level security;

drop policy if exists "Users can view their own documents" on public.documents;
drop policy if exists "Users can insert their own documents" on public.documents;
drop policy if exists "Users can update their own documents" on public.documents;
drop policy if exists "Users can delete their own documents" on public.documents;
drop policy if exists "Anyone can submit clearance applications" on public.documents;
drop policy if exists "Anyone can view clearance documents for verification" on public.documents;

-- Public applicants can submit clearance requests
create policy "Anyone can submit clearance applications"
on public.documents
for insert
with check (true);

-- Public & Court Staff can lookup/verify documents by cert_no or payment_no
create policy "Anyone can view clearance documents for verification"
on public.documents
for select
using (true);

create policy "Users can update their own documents"
on public.documents
for update
using (auth.uid() = owner_id or auth.role() = 'authenticated')
with check (auth.uid() = owner_id or auth.role() = 'authenticated');

create policy "Users can delete their own documents"
on public.documents
for delete
using (auth.uid() = owner_id or auth.role() = 'authenticated');

-- Storage policies for existing bucket: documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can read their own files" on storage.objects;
drop policy if exists "Users can upload their own files" on storage.objects;
drop policy if exists "Anyone can upload applicant files" on storage.objects;
drop policy if exists "Anyone can view applicant files" on storage.objects;

create policy "Anyone can view applicant files"
on storage.objects
for select
using (bucket_id = 'documents');

create policy "Anyone can upload applicant files"
on storage.objects
for insert
with check (bucket_id = 'documents');
