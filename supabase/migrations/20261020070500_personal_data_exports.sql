create schema if not exists private;

create sequence if not exists private.personal_data_export_reference_seq;

create or replace function private.next_personal_data_export_reference()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'WD-' ||
         to_char(timezone('Asia/Tokyo', now()), 'YYYYMMDD') || '-' ||
         lpad(nextval('private.personal_data_export_reference_seq')::text, 6, '0');
$$;

revoke all on function private.next_personal_data_export_reference() from public, anon, authenticated;
grant execute on function private.next_personal_data_export_reference() to service_role;

create table if not exists public.personal_data_export_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default private.next_personal_data_export_reference(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'preparing', 'ready', 'downloaded', 'expired', 'cancelled', 'failed')),
  scope text not null default 'all_personal_data'
    check (scope = 'all_personal_data'),
  delivery_method text not null default 'electronic_data'
    check (delivery_method = 'electronic_data'),
  export_format_version integer not null default 1,
  storage_path text,
  file_size_bytes bigint,
  file_sha256 text,
  error_code text,
  requested_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  expires_at timestamptz,
  first_download_url_issued_at timestamptz,
  downloaded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_data_export_ready_fields check (
    status not in ('ready', 'downloaded') or
    (storage_path is not null and ready_at is not null and expires_at is not null)
  )
);

comment on table public.personal_data_export_requests is
  '本人による個人データ開示申請。reference_code は利用者向け管理番号、id は内部識別子。';

create unique index if not exists personal_data_export_one_active_per_user
  on public.personal_data_export_requests(user_id)
  where status in ('requested', 'preparing', 'ready', 'downloaded');

create index if not exists personal_data_export_user_requested_idx
  on public.personal_data_export_requests(user_id, requested_at desc);

alter table public.personal_data_export_requests enable row level security;

drop policy if exists personal_data_export_select_own on public.personal_data_export_requests;
create policy personal_data_export_select_own
  on public.personal_data_export_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.personal_data_export_requests from anon;
revoke insert, update, delete on public.personal_data_export_requests from authenticated;
grant select on public.personal_data_export_requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personal-data-exports',
  'personal-data-exports',
  false,
  209715200,
  array['application/zip']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists personal_data_exports_no_direct_select on storage.objects;

create or replace function public.set_personal_data_export_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_personal_data_export_updated_at() from public, anon, authenticated;

drop trigger if exists personal_data_export_set_updated_at on public.personal_data_export_requests;
create trigger personal_data_export_set_updated_at
before update on public.personal_data_export_requests
for each row execute function public.set_personal_data_export_updated_at();

