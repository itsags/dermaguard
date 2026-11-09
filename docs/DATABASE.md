# Database and storage

Applied migrations are append-only and must be reviewed before execution:

1. `202610230001_milestone_2.sql` creates `skin_cases`, `observations`, and the private `dermaguard-photos` bucket.
2. `202610250001_photo_path_security.sql` scopes observation photo paths to the authenticated user's folder.
3. `202610260001_realtime_dashboard.sql` enables Realtime for cases and observations.
4. `202610260002_assessments.sql` creates the persisted assessment state boundary and enables Realtime for assessments.

All user-owned tables have RLS policies based on `auth.uid()`. The backend assessment endpoints use a server-only service key only after independently validating the Supabase access token and always filter by the authenticated user id.
