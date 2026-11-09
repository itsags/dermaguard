-- Apply manually in Supabase SQL Editor after the existing DermaGuard migrations.
-- This stores the honest assessment workflow boundary; no ML inference is enabled by this migration.
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  case_id uuid not null references public.skin_cases(id) on delete cascade,
  photo_path text not null,
  status text not null default 'draft' check (status in ('draft','uploaded','quality_check','queued','processing','completed','rejected','failed','cancelled')),
  quality_status text not null default 'pending' check (quality_status in ('pending','passed','rejected','unavailable')),
  model_status text not null default 'unavailable' check (model_status in ('unavailable','demo_only','ready','failed')),
  model_version text,
  error_code text,
  client_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assessments_user_created on public.assessments(user_id, created_at desc);
create unique index if not exists assessments_user_request on public.assessments(user_id, client_request_id) where client_request_id is not null;
alter table public.assessments enable row level security;
drop policy if exists "Users manage their assessments" on public.assessments;
create policy "Users manage their assessments" on public.assessments for all using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.skin_cases c where c.id = case_id and c.user_id = auth.uid()));
do $$ begin alter publication supabase_realtime add table public.assessments; exception when duplicate_object then null; end $$;
