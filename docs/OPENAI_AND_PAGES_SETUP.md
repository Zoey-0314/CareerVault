# Remote AI + deployment setup

CareerVault keeps AI API keys server-side. Browser clients call Vercel serverless API routes; no client-side or GitHub Pages bundle contains the provider key.

## Architecture

```text
GitHub Pages (static CareerVault UI)
        |
        | HTTPS
        v
Vercel serverless API routes
        |
        | OPENAI_API_KEY stays here only
        v
OpenAI Responses API
```

The public site has **no local AI fallback**. If the remote provider is unavailable, CareerVault shows an explicit failure and does not generate substitute interview, credential, JD, resume, or interview-prep results.

## Current deployment

CareerVault currently uses:

```text
https://career-vault-sage.vercel.app
```

The frontend automatically resolves these API routes:

```text
/api/interview
/api/credential
```

When the frontend itself is running on Vercel, it calls the same-origin API. When running on `zoey-0314.github.io`, it defaults to the deployed Vercel API above. `NEXT_PUBLIC_CAREERVAULT_AI_URL` can still override the endpoint for forks or another deployment.

## Server-side environment variables

Configure these in Vercel:

```text
OPENAI_API_KEY=your_secret_key
OPENAI_MODEL=gpt-6-luna
ALLOWED_ORIGIN=https://zoey-0314.github.io
```

`OPENAI_API_KEY` must never appear in a `NEXT_PUBLIC_*` variable or browser bundle.

## GitHub Pages

1. Open repository **Settings → Pages**.
2. Choose **GitHub Actions** under **Build and deployment**.
3. The included workflow builds the static Next.js export in `out/` and deploys it.
4. Expected URL:

```text
https://zoey-0314.github.io/CareerVault/
```

No AI URL variable is required for this repository because the current Vercel endpoint is built in as the public default. Forks should set `CAREERVAULT_AI_URL` as a repository Actions variable.

## Local development

```bash
npm install
npm run dev
```

Local development also requires a remote AI endpoint. Without one, AI actions are disabled with an explicit configuration error. To use a proxy locally, add `.env.local` (never commit it):

```text
NEXT_PUBLIC_CAREERVAULT_AI_URL=https://your-domain.example/api/interview
```

## Billing and cost control

ChatGPT subscriptions and OpenAI API usage are billed separately. CareerVault reduces API cost by sending compact structured state plus the latest user answer rather than replaying the entire visible chat transcript.

Cost-control rules:

- use GPT-6 Luna for focused extraction/classification by default;
- keep output JSON-only and bounded;
- do not regenerate facts that are already stored;
- send compressed credential images;
- fail explicitly when remote AI fails; never substitute local AI output;
- add authentication/rate limiting before opening unrestricted AI usage to a large public audience.

## Security

Never commit API keys, paste them into issues/screenshots, or expose them through frontend environment variables. Uploaded credential images are compressed in the browser and sent only to the configured AI API when analysis is requested; they are not committed to GitHub.
