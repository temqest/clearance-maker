create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text,
  full_name text,
  purpose text,
  cert_no text,
  form_data jsonb not null default '{}'::jsonb,
  photo_path text,
  signature_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

create index if not exists documents_owner_id_idx on public.documents (owner_id);
create index if not exists documents_updated_at_idx on public.documents (updated_at desc);
create index if not exists documents_full_name_idx on public.documents (full_name);
create index if not exists documents_purpose_idx on public.documents (purpose);
create index if not exists documents_cert_no_idx on public.documents (cert_no);
