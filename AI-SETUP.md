# Darsak AI Tutor (staging)

- Frontend: `ai.html`, `ai.css`, `ai.js`
- Cloudflare Worker source: `worker/ai-tutor.js`
- Model: Cloudflare Workers AI `@cf/google/gemma-4-26b-a4b-it`
- Daily quota: 2,000 estimated LLM tokens per authenticated user (UTC day).
- Authentication: verifies the Supabase access token against the existing site's Supabase Auth project.
- Storage: Cloudflare D1 database `darsak-ai-usage`.

## Deployment requirements
Worker bindings:
- `AI`: Workers AI binding
- `DB`: D1 binding to database `darsak-ai-usage`
- `SUPABASE_URL`: existing site's Supabase project URL
- `SUPABASE_ANON_KEY`: existing site's publishable key

Do not change the site's Supabase project just to deploy AI. The frontend sends the user's existing access token; the Worker validates it against the same Supabase project configured in `supabase.js`.

Token accounting is conservative character-based estimation, not tokenizer-reported exact usage. Do not describe it as exact token metering.
