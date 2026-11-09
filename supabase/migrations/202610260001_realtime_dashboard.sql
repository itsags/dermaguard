-- Apply manually in Supabase SQL Editor after the previous migrations.
-- Enables real-time updates for each signed-in user's existing private records.
do $$ begin
  alter publication supabase_realtime add table public.skin_cases;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.observations;
exception when duplicate_object then null;
end $$;
