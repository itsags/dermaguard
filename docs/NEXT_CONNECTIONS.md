# Next connections for the free public college demo

1. Upload the checked release to the `codex/connected-free-demo` GitHub branch, preserving the existing main history. Secret environment files and local outputs are excluded.
2. Import the repository into Vercel at the repository root, selecting that branch. Enter the server variables from PRODUCTION_SETUP.md directly in Vercel. Keep FREE_SERVICES_ONLY=true and your Groq account on Free.
3. Import the same branch into Netlify using netlify.toml. Enter only the public frontend variables and the deployed API origin.
4. Set the final Netlify origin in Vercel ALLOWED_ORIGINS and Supabase Site URL/redirect URLs. Redeploy after environment changes.
5. Test signup/login/logout, two-account record isolation, profile photos, dated uploads, downloads, multilingual chat and real nearby results over HTTPS.

The current nearby list uses free cached OpenStreetMap searches, not Google Places. Keep public traffic moderate; serverless workers need shared rate coordination before scaling. Never invent provider cards to reach a minimum count.

No evaluated clinical image model is connected. Decide the supported photo type, obtain licensed datasets, train and validate with patient-separated data, and add uncertainty/out-of-scope handling before enabling image conclusions. Do not display cancer scores, stages, measurements or healing claims from placeholders. Training does not run inside Vercel requests.

See PRODUCTION_SETUP.md and FREE_SETUP.md for setup details and remaining release limits.
