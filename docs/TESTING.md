# Testing

Run frontend unit tests with `npm run test` and type/build validation with `npm run build` from `frontend/`.

Run backend tests with `pytest` from `backend/` after activating `.venv`.

Manual acceptance checklist:

1. A new user can sign up and sign in.
2. A user can create a case and an observation.
3. A second account cannot read or modify the first account's rows.
4. The `dermaguard-photos` bucket is private in the dashboard.
5. Invalid/non-image upload signing requests are rejected.

The supplied automated tests do not connect to a hosted Supabase project; run the acceptance checklist after applying the migration to a development project.
