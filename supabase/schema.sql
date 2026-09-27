-- BitLab database setup.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- ─── Projects: saved circuits and CPU programs ───────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('circuit', 'program')),
  name        text not null check (char_length(name) between 1 and 100),
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

-- Row-level security: every user can only see and change their own rows.
alter table public.projects enable row level security;

drop policy if exists "Users can read own projects" on public.projects;
create policy "Users can read own projects" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own projects" on public.projects;
create policy "Users can create own projects" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects" on public.projects
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects" on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ─── Storage: a private bucket, one folder per user (<user id>/filename) ─────
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "Users can read own files" on storage.objects;
create policy "Users can read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload own files" on storage.objects;
create policy "Users can upload own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update own files" on storage.objects;
create policy "Users can update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete own files" on storage.objects;
create policy "Users can delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);
