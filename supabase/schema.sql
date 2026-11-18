-- Ejecutar en Supabase SQL Editor. No usar service_role en el cliente.
create table if not exists public.user_agendas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_agendas_payload_object check (jsonb_typeof(payload) = 'object')
);
alter table public.user_agendas enable row level security;
revoke all on table public.user_agendas from anon;
grant select, insert, update, delete on table public.user_agendas to authenticated;
drop policy if exists "Users can read their own agenda" on public.user_agendas;
create policy "Users can read their own agenda" on public.user_agendas for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own agenda" on public.user_agendas;
create policy "Users can insert their own agenda" on public.user_agendas for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own agenda" on public.user_agendas;
create policy "Users can update their own agenda" on public.user_agendas for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own agenda" on public.user_agendas;
create policy "Users can delete their own agenda" on public.user_agendas for delete to authenticated using (auth.uid() = user_id);
