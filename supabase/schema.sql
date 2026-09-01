create extension if not exists pgcrypto;

-- Atomic sequence for race-condition safe certificate numbering
create sequence if not exists cert_number_seq start with 1 increment by 1;

-- Ensure documents table exists
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
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

-- Safely add missing columns to pre-existing table in Supabase
alter table public.documents add column if not exists cert_no text;
alter table public.documents add column if not exists or_number text;
alter table public.documents add column if not exists idempotency_key text;

-- Safely add unique constraints if not already attached
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_cert_no_key') then
    alter table public.documents add constraint documents_cert_no_key unique (cert_no);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_idempotency_key_key') then
    alter table public.documents add constraint documents_idempotency_key_key unique (idempotency_key);
  end if;
exception
  when others then null;
end $$;

-- Trigger function for atomic sequential cert_no assignment
create or replace function public.assign_cert_number()
returns trigger
language plpgsql
as $$
declare
  seq_val bigint;
begin
  if new.cert_no is null or new.cert_no = '' then
    seq_val := nextval('cert_number_seq');
    new.cert_no := 'DOC-' || lpad(seq_val::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_assign_cert_number on public.documents;
create trigger trigger_assign_cert_number
before insert on public.documents
for each row
execute function public.assign_cert_number();

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
create index if not exists documents_or_number_idx on public.documents (or_number);
