-- Every account owns its own carbon inventory. No table grants are given to anon.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  payload jsonb not null default '{}'::jsonb,
  significance jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint profiles_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint profiles_significance_object check (jsonb_typeof(significance) = 'object'),
  constraint profiles_payload_size check (length(payload::text) <= 15000),
  constraint profiles_significance_size check (length(significance::text) <= 15000)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  period text not null check (period in ('current', 'base')),
  scope smallint not null check (scope between 1 and 4),
  date date not null,
  title text not null check (length(trim(title)) between 1 and 200),
  quantity numeric not null check (quantity > 0 and quantity <= 1000000000000),
  unit text not null check (length(trim(unit)) between 1 and 100),
  factor numeric not null check (factor >= 0 and factor <= 1000000000),
  factor_name text not null check (length(trim(factor_name)) between 1 and 300),
  factor_source text not null check (length(trim(factor_source)) between 1 and 1500),
  factor_row text not null default '' check (length(factor_row) <= 150),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create index activities_user_date_idx on public.activities (user_id, date desc, created_at desc);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;

revoke all on table public.profiles, public.activities from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles, public.activities to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "activities_select_own" on public.activities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activities_insert_own" on public.activities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activities_update_own" on public.activities
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "activities_delete_own" on public.activities
  for delete to authenticated using ((select auth.uid()) = user_id);
