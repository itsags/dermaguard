# Security notes

Health-related data should be minimized. Do not store names, dates of birth, addresses, contact details, or free-text information that could identify another person.

- Keep the Supabase service-role key in `backend/.env` only. It bypasses RLS.
- Keep `.env` out of version control (the supplied `.gitignore` does this).
- The migration makes the photo bucket private and applies user-scoped RLS.
- Validate MIME type and use a 5 MB storage bucket limit; production should also scan uploads and enforce content length at the edge.
- Use HTTPS, rotate leaked keys, restrict CORS to known origins, and review Supabase Auth controls before production.
- This scaffold does not meet a stated regulatory certification; obtain legal, privacy, and security review before handling real patient data.
