# DermaGuard — Working model and production-readiness foundation

Privacy-first skin-care tracking starter. An authenticated person can create a private case, securely upload a photo, record non-diagnostic observations, and see their own timeline.

> **Safety:** Not a diagnostic tool or a substitute for professional medical care. Do not use for emergencies.

## Included

- React + TypeScript + Vite + Tailwind UI
- FastAPI token-verifying service and signed-upload endpoint
- Supabase migration: private storage, tables, auth-linked RLS
- Email/password access, private case timeline, upload and symptom notes
- Frontend/backend tests and safe example environment files

The current model includes a responsive dashboard, New Skin Check workflow foundation, private timeline, real-time updates, profile image/location, live map search, password reset, photo quality guidance, assessment API state foundation, and deployment configuration. No ML diagnosis is enabled.

## Setup

1. Open this folder in VS Code.
2. Install the frontend packages, then create its local configuration:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env
   ```

3. Add your Supabase project URL and **anon/publishable key** to `frontend/.env`. Never put a service-role key in this file.
4. In another terminal, prepare the backend:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

5. Add the project URL, anon/publishable key and server-only service-role key to `backend/.env`.
6. In Supabase Dashboard → **SQL Editor**, review and run migrations in filename order. The later assessment migration is required for the API foundation.
7. In Supabase Dashboard → **Authentication → URL Configuration**, add `http://localhost:5173` as a redirect URL and enable Email auth.
8. Run the backend (`uvicorn app.main:app --reload --port 8000`) and frontend (`npm run dev`) in their respective folders.

Open the Vite address (normally `http://localhost:5173`), create a test account, then add a case.

## Checks

```powershell
cd frontend; npm run test; npm run build
cd ..\backend; .\.venv\Scripts\Activate.ps1; pytest
```

## Security model

- Browser uses the Supabase anon key; row-level security protects all user data.
- Tables have `user_id` and policies scoped to `auth.uid()`.
- Photos use a private bucket under `{user_id}/{case_id}/...`.
- The API verifies a Bearer token before issuing a short-lived upload URL.
- The service-role key belongs only in backend `.env`; rotate it if it is exposed.

See [docs/SECURITY.md](docs/SECURITY.md) and [docs/TESTING.md](docs/TESTING.md).

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md), [docs/API.md](docs/API.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the verified status and remaining external steps.

## Connected application update (2026-11-09)

The production entry now requires authentication and connects the studio to private API records. See docs/PRODUCTION_SETUP.md before running migrations or deploying. A clinical inference model is not included; the app must not be described as diagnosing cancer. Local builds and tests do not establish production readiness.
