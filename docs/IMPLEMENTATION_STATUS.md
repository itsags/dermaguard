# DermaGuard implementation status — 2026-11-09

Current setup and release checklist: [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md).

The production entry is frontend/src/ConnectedApp.tsx. Authenticated users load frontend/src/production/ProductionStudio.tsx; the approved studio layout is adapted by studio.js with no prototype scripts or seeded clinical results. Legacy App/ReferenceUi are retained as reference, not the production entry.

Implemented: Supabase auth calls and Google sign-in, recovery entry, logout; profile save and avatar storage; 1–3 dated photos tied to private cases; scan API with ownership and binary image validation; chronological tracking; dated history and reports; PDF endpoint and browser printing; optional consent-based text chat in English/Tamil/Tanglish with persistent quota; device speech; location-based map/provider search. No clinical classifier or wound detector is active.

Verified locally: production frontend build, eight frontend tests including studio integration and mobile refresh behavior, nineteen backend tests. Local frontend and API health return HTTP 200. Backend tests mock database/provider boundaries; these do not prove hosted account isolation or provider delivery.

User-confirmed local mobile checks: Google login, email flow, profile save, scan save and PDF download. Connected migration and row security were confirmed through dashboard screenshots. Groq multilingual responses were verified. External requirements: create Vercel/Netlify deployments; enter server settings privately; configure final HTTPS redirects and allowed origins; verify two-account isolation and reports; select licensed datasets and evaluate a clinical model. No public deployment has been performed.

Remaining release risks: clinical image inference and scope rejection unavailable; standard-font API PDF Tamil rendering limited (browser print preserves Unicode); public clinic data availability; interrupted upload cleanup/retention; live auth, browser and mobile end-to-end verification; production monitoring, privacy and clinical review.
