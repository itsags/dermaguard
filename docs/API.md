# API contract

Base URL: `http://127.0.0.1:8000` locally. Private endpoints require `Authorization: Bearer <Supabase access token>`.

## Health

`GET /health` returns `{ "status": "ok" }`.

## Upload boundary

`POST /uploads/sign` validates an authenticated request and returns a short-lived private Storage upload URL. The current browser UI uses authenticated Supabase Storage directly; this endpoint remains available for a future server-mediated upload flow.

`POST /api/v1/uploads/validate` accepts `content_type`, `size_bytes`, and optional `width`/`height`. It rejects unsupported types, empty files, oversized files, and images below 256 by 256 pixels. Scope/lesion detection is explicitly `unavailable` until a validated detector exists.

## Assessments

- `POST /api/v1/assessments` creates an authenticated user's `uploaded` assessment row.
- `GET /api/v1/assessments` lists only that user's rows.
- `GET /api/v1/assessments/{assessment_id}` retrieves only that user's row.
- `POST /api/v1/assessments/{assessment_id}/quality-check` persists a passed/rejected quality status. Valid images move to `queued`, but inference remains unavailable unless `MODEL_MODE` is explicitly configured and supported.

All errors use a safe HTTP detail message and never return tokens, secrets, or stack traces.
