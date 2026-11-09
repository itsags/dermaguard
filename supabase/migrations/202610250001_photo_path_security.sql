-- Apply after the initial Milestone 2 migration.
-- Keeps observation photo references scoped to the signed-in user's storage folder.
drop policy if exists "Users manage their observations" on public.observations;
create policy "Users manage their observations" on public.observations
for all using (
  user_id = auth.uid()
  and exists (select 1 from public.skin_cases c where c.id = case_id and c.user_id = auth.uid())
)
with check (
  user_id = auth.uid()
  and (photo_path is null or photo_path like auth.uid()::text || '/%')
  and exists (select 1 from public.skin_cases c where c.id = case_id and c.user_id = auth.uid())
);
