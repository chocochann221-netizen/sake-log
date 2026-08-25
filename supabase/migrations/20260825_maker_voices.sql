-- 和酒ログ「造り手へ、ひとこと」保存・郵送管理用
-- 本番DBへ適用する前提の設計ファイル。現時点ではGitHub上に準備のみ。

create table if not exists public.maker_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sake_master_id uuid null,
  brewery_name text not null,
  sake_name text not null,
  message text not null check (char_length(message) between 1 and 1000),
  age_band text null,
  gender text null,
  residence_prefecture text null,
  drinking_place text null,
  share_age_band boolean not null default false,
  share_gender boolean not null default false,
  share_residence boolean not null default false,
  share_drinking_place boolean not null default false,
  delivery_status text not null default 'unsent' check (delivery_status in ('unsent','ready','sent','hold')),
  delivery_batch_id uuid null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists maker_voices_brewery_status_idx
  on public.maker_voices (brewery_name, delivery_status, created_at);

alter table public.maker_voices enable row level security;

-- 利用者は自分の声だけ登録・参照できる。
create policy "maker_voices_insert_own"
on public.maker_voices for insert to authenticated
with check (auth.uid() = user_id);

create policy "maker_voices_select_own"
on public.maker_voices for select to authenticated
using (auth.uid() = user_id);

-- 管理画面での全件参照・送付状態更新は既存 is_admin() を利用。
create policy "maker_voices_admin_select"
on public.maker_voices for select to authenticated
using (public.is_admin());

create policy "maker_voices_admin_update"
on public.maker_voices for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.maker_voice_delivery_batches (
  id uuid primary key default gen_random_uuid(),
  brewery_name text not null,
  period_from date not null,
  period_to date not null,
  status text not null default 'draft' check (status in ('draft','printed','sent')),
  printed_at timestamptz null,
  sent_at timestamptz null,
  admin_note text null,
  created_at timestamptz not null default now()
);

alter table public.maker_voice_delivery_batches enable row level security;

create policy "maker_voice_batches_admin_all"
on public.maker_voice_delivery_batches for all to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.maker_voices is '利用者が造り手へ匿名で預けた非公開メッセージ。共有許可された属性のみ蔵元レポートに使用する。';
comment on table public.maker_voice_delivery_batches is '蔵元ごとのPDF/印刷/郵送単位を管理する。';