# DermaGuard connected app — setup and release status

Active entry: ConnectedApp -> authenticated ProductionStudio. Old App and ReferenceUi are reference-only and excluded from the active imports. Production does not execute demo scripts or allow anonymous studio access. CSS is bundled without the runtime Tailwind CDN.

## Implemented locally
Email/password and Google auth calls, recovery entry, logout, private profile persistence, 1–3 dated photos per scan, same-case tracking, authenticated scan API, ownership checks, image-byte validation, saved history, date-filtered reports, API PDF and browser printing, optional text-only English/Tamil/Tanglish chat with consent and persistent quotas, device read-aloud, location-based Maps and public provider search.

## Not completed or verified
Public deployment and cross-account end-to-end tests remain outstanding. The user confirmed local mobile authentication, email delivery, profile saving, scan saving and PDF download. Groq chat was tested live in English, Tamil and Tanglish. No trained clinical model, skin/wound detector, cancer classification, calibrated measurements or image-based comparison is enabled. Reports explicitly state this. Chat cannot see photos. Kaggle dataset licenses, model artifact and patient-separated clinical validation are required; accuracy cannot be promised. Standard-font API PDFs have limited Tamil glyph support; browser printing preserves Unicode. Interrupted uploads need a retention/cleanup policy before release. No public deployment has happened.

## 1. Supabase
In the existing project SQL Editor apply only migrations not already applied, in filename order. New: supabase/migrations/202611090001_connected_app.sql. This adds profiles, private scan records and database-backed quotas. API validates scan writes; browser writes to scan_records are revoked.

Auth -> Providers: enable email/password and confirmation; enable Google with the OAuth client ID/secret from Google Cloud. In Google Cloud use the Supabase callback URL. Auth -> URL Configuration: set the final Netlify Site URL and add exact local/production redirect origins.

## 2. Vercel — API/backend
Import repository with root directory at repository root. Root requirements.txt includes backend dependencies; Python 3.12 is selected. vercel.json points to backend/api/index.py.
Set Project -> Settings -> Environment Variables:
- SUPABASE_URL
- SUPABASE_ANON_KEY (public publishable/anon key)
- SUPABASE_SERVICE_ROLE_KEY (server secret)
- ALLOWED_ORIGINS (exact Netlify origin, no trailing slash; comma-separated)
- APP_ENV=production
- MODEL_MODE=unavailable
- FREE_SERVICES_ONLY=true
- GROQ_API_KEY (copy privately from your existing local backend settings)
- GROQ_MODEL=openai/gpt-oss-20b
Redeploy. /health is process liveness only; /api/v1/scans without a token must return 401.

## 3. Netlify — frontend
Import same repository. netlify.toml: base=frontend, build=npm run build, publish=dist relative to base.
Set Site configuration -> Environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY (public key only)
- VITE_API_URL (Vercel origin, no /api suffix)
Redeploy, then finish Supabase redirects and Vercel CORS with the actual site URL.

Never share secret keys, passwords, OAuth client secrets or hosting tokens in chat. Put them directly in the provider settings. Never use VITE_ for server secrets.

## 4. Verify before release
Sign up/confirm/login and Google callback; profile save/refresh; 1 and 3 photo saves with dates; invalid bytes/size/date rejection; two accounts isolated; signed images expire/refresh; chronological same-case tracking; report download/print; Tamil content/voice on target devices; chat consent/errors/quota; city changes and provider links. Review privacy, retention/deletion, backups, clinical governance, monitoring, provider limits and accessibility before public release.

Local frontend public configuration was derived without printing server secrets. The user applied the connected-app migration and confirmed row security is enabled. Do not rerun applied migrations blindly. Use the GitHub branch codex/connected-free-demo for both hosting imports until it is merged.

## Local commands
Frontend: cd frontend; npm run dev
Backend: cd backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
