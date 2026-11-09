# Deployment readiness

Deployment configuration is prepared but not executed.

## Frontend: Netlify

- Configuration: `netlify.toml`.
- Build command: `npm run build` from `frontend`.
- Publish directory: `frontend/dist`.
- Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` in Netlify environment settings.
- Add the final Netlify URL to Supabase Authentication URL Configuration.

## Backend: Vercel

- Configuration: `vercel.json` and `backend/api/index.py`.
- Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, and model settings in Vercel.
- Confirm Python runtime compatibility, request-size limits, and cold-start behavior before using it for any model workload.

No deployment, hosted migration, domain change, or GitHub push has been performed.
