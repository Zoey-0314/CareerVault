# OpenAI + GitHub Pages setup

CareerVault is designed so the public website can live on GitHub Pages without exposing an OpenAI API key.

## Architecture

```text
GitHub Pages (static CareerVault UI)
        |
        | HTTPS
        v
Optional AI proxy (serverless function)
        |
        | OPENAI_API_KEY stays here only
        v
OpenAI Responses API
```

The public site always keeps a local rule-based fallback. If the AI proxy is unavailable or not configured, the core V1 workflow still works.

## Important billing fact

A ChatGPT subscription and the OpenAI API are billed separately. A ChatGPT Plus/Pro subscription does not turn an API key into unlimited or free API usage.

CareerVault minimizes API use by keeping the interview state in structured browser data. It does not resend the entire chat transcript every turn. Each AI request should contain only:

- the compact current experience state;
- the latest user answer;
- the HR extraction instructions.

This keeps the UI conversational without paying repeatedly for a long transcript.

## Recommended model

The proxy defaults to `gpt-6-luna` with low reasoning effort because CareerVault's interview turn is a focused extraction/classification task. Change `OPENAI_MODEL` if later testing shows a stronger model is necessary.

## 1. Create an OpenAI API key

1. Sign in to the OpenAI API Platform.
2. Create a project for CareerVault if desired.
3. Add API billing / prepaid credit.
4. Open the API Keys page and create a new secret key.
5. Copy the secret immediately. The full key is only shown when it is created.
6. Never commit the key to this repository and never put it in a `NEXT_PUBLIC_*` environment variable.

Recommended key name: `CareerVault`

## 2. Deploy the AI proxy

The repository contains a minimal Vercel-compatible proxy under `proxy/`.

Set these server-side environment variables in the proxy deployment:

```text
OPENAI_API_KEY=your_secret_key
OPENAI_MODEL=gpt-6-luna
ALLOWED_ORIGIN=https://zoey-0314.github.io
```

`OPENAI_API_KEY` must stay server-side. The browser must never receive it.

After deployment, the endpoint will look similar to:

```text
https://your-proxy-domain.example/api/interview
```

## 3. Connect GitHub Pages to the proxy

In the GitHub repository, create an Actions/Repository variable named:

```text
CAREERVAULT_AI_URL
```

Set it to the deployed proxy endpoint, for example:

```text
https://your-proxy-domain.example/api/interview
```

This URL is not a secret. The Pages workflow exposes it at build time as:

```text
NEXT_PUBLIC_CAREERVAULT_AI_URL
```

The OpenAI key is never stored in GitHub Pages.

## 4. Enable GitHub Pages

After the V1 PR is merged to `main`:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. The `Deploy GitHub Pages` workflow will build the static Next.js export and publish `out/`.
4. The expected project URL is:

```text
https://zoey-0314.github.io/CareerVault/
```

## 5. Local development

Without a proxy:

```bash
npm install
npm run dev
```

CareerVault uses the local interview analyzer.

With a proxy, create a local `.env.local` file (do not commit it):

```text
NEXT_PUBLIC_CAREERVAULT_AI_URL=https://your-proxy-domain.example/api/interview
```

The public browser still never receives `OPENAI_API_KEY`.

## Cost-control rules

CareerVault should keep API use deliberately small:

- use the local rules before calling a model when possible;
- send compact structured state, not the entire chat history;
- keep model output JSON-only and short;
- cap output tokens;
- use a cost-efficient model for extraction;
- call a stronger model only for final resume rewriting if testing proves it materially better;
- never ask the model to regenerate facts already stored in the experience library;
- fall back to local mode when the proxy is unavailable.

## Security rules

Never:

- commit an API key;
- put an API key in a GitHub Pages JavaScript bundle;
- put an API key in `NEXT_PUBLIC_*` variables;
- paste a secret key into README/issues/screenshots;
- expose unrestricted proxy endpoints without origin/rate controls.

The current proxy template restricts browser origins and keeps the key server-side. Before a large public launch, add authentication and rate limiting so strangers cannot consume the project owner's API balance.
