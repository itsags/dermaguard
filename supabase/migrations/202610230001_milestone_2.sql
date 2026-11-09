-- DermaGuard Milestone 2: private user-owned health observations.
-- Review before manually running in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.skin_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body_area text not null check (char_length(body_area) between 1 and 80),
  created_at timestamptz not null default now()
);
create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  case_id uuid not null references public.skin_cases(id) on delete cascade,
  symptoms text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 1000),
  photo_path text,
  noted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists skin_cases_user_created on public.skin_cases(user_id, created_at desc);
create index if not exists observations_user_case_noted on public.observations(user_id, case_id, noted_at desc);

alter table public.skin_cases enable row level security;
alter table public.observations enable row level security;
create policy "Users manage their cases" on public.skin_cases for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their observations" on public.observations for all using (user_id = auth.uid() and exists (select 1 from public.skin_cases c where c.id = case_id and c.user_id = auth.uid())) with check (user_id = auth.uid() and exists (select 1 from public.skin_cases c where c.id = case_id and c.user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dermaguard-photos', 'dermaguard-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "Users upload photos in their folder" on storage.objects for insert to authenticated with check (bucket_id = 'dermaguard-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read their photos" on storage.objects for select to authenticated using (bucket_id = 'dermaguard-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete their photos" on storage.objects for delete to authenticated using (bucket_id = 'dermaguard-photos' and (storage.foldername(name))[1] = auth.uid()::text);
