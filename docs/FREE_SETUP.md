# Free-only setup (supersedes paid-provider suggestions in older notes)

FREE_SERVICES_ONLY=true is enabled by default. The app does not use Google Places, and a configured OpenAI key is ignored in this mode. There is no automatic paid provider fallback.

## Working now, without keys
- Supabase authentication/profile/scan storage uses the existing project, subject to its free quotas.
- Nearby care uses cached OpenStreetMap Nominatim searches on demand. A live Chennai lookup returned hospital listings. Specialty/contact information may be missing; the app marks general hospitals for confirmation. Searches are serialized and paced below one request per second per running API instance. Before public scaling, coordinate traffic across all serverless workers or use a compliant alternate provider; this service is intended for moderate demo traffic, not unlimited searching.
- The chat box has an explicit local record guide in English/Tamil/Tanglish. It answers known app tasks and summarizes saved photo counts/dates. This is a rule-based guide, not generative AI or medical inference.
- Browser speech uses installed device voices and may not have Tamil voice support.

## Optional free generative chat
1. Sign up at https://console.groq.com/ and remain on the Free plan. Do not upgrade or enable paid billing.
2. Create a key under API Keys.
3. Enter it privately in backend/.env as GROQ_API_KEY=... (never frontend or chat).
4. GROQ_MODEL is set to openai/gpt-oss-20b. Keep FREE_SERVICES_ONLY=true.
5. Restart the backend. On deployment, enter the same variable in Vercel server settings.
6. Review Groq Data Controls, use test/non-identifying data, and test consent, Tamil/Tanglish output and quotas. Photos are not sent to this text provider. Rate-limit errors stop requests; they never trigger a paid fallback. Limits and model availability can change; verify the account's Free plan settings.

The local Groq connection and English, Tamil and Tanglish responses have been verified with non-identifying test prompts. A key does not itself guarantee that the provider account stays on a free plan; the account owner must keep it on Free.

## Clinical analysis and hosting
Clinical image analysis still requires licensed training data, a trained model and held-out evaluation. No cancer diagnosis or improvement scores are fabricated. Free notebook training and low-volume CPU hosting can be explored, but no free compute availability, uptime or accuracy guarantee is made. Netlify/Vercel/Supabase free-plan eligibility and quotas need review before public deployment. Do not enable a paid plan without an explicit budget decision.
