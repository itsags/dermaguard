-- Connected application records. Run after the existing migrations.
create table if not exists public.patient_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 display_name text not null default '' check(length(display_name)<=80),
 city text not null default '' check(length(city)<=160),
 phone text not null default '' check(length(phone)<=40),
 street text not null default '' check(length(street)<=240),
 notes text not null default '' check(length(notes)<=2000),
 language text not null default 'EN' check(language in ('EN','TA','TG')),
 avatar_path text,
 updated_at timestamptz not null default now()
);
create table if not exists public.scan_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 case_id uuid not null references public.skin_cases(id) on delete cascade,
 notes text not null default '' check(length(notes)<=2000),
 images jsonb not null check(jsonb_typeof(images)='array' and jsonb_array_length(images) between 1 and 3),
 report jsonb not null default '{}',
 created_at timestamptz not null default now(),
 request_id uuid not null, unique(user_id,request_id)
);
create index if not exists scan_records_user_created on public.scan_records(user_id,created_at desc);
alter table public.patient_profiles enable row level security;
alter table public.scan_records enable row level security;
create policy "Private patient profile" on public.patient_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (avatar_path is null or avatar_path like auth.uid()::text||'/profile/%'));
create policy "Private scan records" on public.scan_records for select to authenticated using(user_id=auth.uid());
-- Writes run through the API after ownership, image, and report validation.
revoke insert, update, delete on public.scan_records from anon, authenticated;
grant select on public.scan_records to authenticated;
grant select,insert,update,delete on public.patient_profiles to authenticated;
-- Persistent chat quota across serverless instances (12/minute, 200/day/user).
create table if not exists public.chat_usage(user_id uuid primary key references auth.users(id) on delete cascade, minute_start timestamptz not null, minute_count int not null, day_start date not null, day_count int not null);
alter table public.chat_usage enable row level security;
create or replace function public.consume_chat_quota(p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.chat_usage;
begin
 insert into public.chat_usage values(p_user_id,date_trunc('minute',now()),0,current_date,0) on conflict do nothing;
 select * into r from public.chat_usage where user_id=p_user_id for update;
 if r.minute_start<>date_trunc('minute',now()) then r.minute_count:=0;end if;
 if r.day_start<>current_date then r.day_count:=0;end if;
 if r.minute_count>=12 or r.day_count>=200 then return false;end if;
 update public.chat_usage set minute_start=date_trunc('minute',now()),minute_count=r.minute_count+1,day_start=current_date,day_count=r.day_count+1 where user_id=p_user_id;
 return true;
end $$;
revoke all on function public.consume_chat_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_chat_quota(uuid) to service_role;
