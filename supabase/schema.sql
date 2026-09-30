-- CareerVault cloud-sync schema
-- Run this once in a dedicated Supabase project before enabling NEXT_PUBLIC_SUPABASE_* variables.

create table if not exists public.career_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.career_vaults enable row level security;

create policy "Users can read their own CareerVault"
on public.career_vaults
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own CareerVault"
on public.career_vaults
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own CareerVault"
on public.career_vaults
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own CareerVault"
on public.career_vaults
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists career_vaults_updated_at_idx on public.career_vaults(updated_at desc);
