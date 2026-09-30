# CareerVault

> Tell your story once. Tailor it for every opportunity.

CareerVault is a local-first career memory and resume tailoring workspace. It helps people build a verified experience library, preserve the facts behind their work, evaluate credentials, import evidence from AI-coding workspaces, match the strongest evidence to a target role, and generate a concise one-page resume without inventing achievements.

## What CareerVault does

- **Personal profile** — keeps only useful resume information.
- **Experience vault** — internship, work, project, campus, competition, research, coursework and volunteer experiences.
- **HR-style interview** — asks one high-value follow-up question at a time and separates confirmed facts from model inference.
- **Vibe Coding workspace import** — copy one prompt into the original coding workspace and paste the returned `CAREERVAULT_IMPORT_V1` JSON back into CareerVault.
- **Awards & credentials** — upload a certificate image or enter it manually; CareerVault evaluates level, issuer, rank/selectivity and what the credential actually proves, then asks when information is missing.
- **Job evidence matching** — ranks stored experiences against a pasted JD without pretending the result is a magical ATS score.
- **One-page resume** — selects defensible, role-relevant evidence and keeps the layout restrained.

## Data model

CareerVault is **local-first**. V2 browser storage uses IndexedDB instead of relying only on `localStorage`, and users can export/restore a complete JSON backup. This survives normal browser restarts, but browser data can still be cleared and it does not automatically follow a user to another device.

Optional Supabase cloud sync is supported through email magic-link authentication and row-level security. See `supabase/schema.sql` before enabling the public Supabase variables.

## AI architecture

The public frontend never contains an OpenAI API key.

```text
GitHub Pages / Vercel frontend
          ↓
CareerVault server-side API routes
          ↓
OpenAI Responses API
```

The frontend sends compact structured context instead of replaying the entire visible chat transcript on every turn. If the AI proxy is unavailable, the core experience remains usable through local deterministic rules.

## Core principle

**Facts are the source of truth. AI may extract, rank and reframe verified experiences, but it must not invent metrics, ownership, tools, outcomes, dates, awards or skill levels.**

Approximate or inferred claims remain pending until the user explicitly confirms or edits them.

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm run build
```

The repository includes GitHub Actions for CI and GitHub Pages static deployment.
