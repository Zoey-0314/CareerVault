# CareerVault V1 Architecture

## Goal

V1 proves one complete loop:

`Profile -> Experience -> Follow-up -> JD -> Match -> One-page Resume`

The architecture intentionally stays small so the product can be tested before adding authentication, databases, multiple AI providers, job tracking, or document export.

## Current stack

- Next.js App Router
- React
- TypeScript
- plain CSS
- browser localStorage for V1 demo persistence

No backend database is required for the first interactive prototype.

## Current modules

### `src/lib/types.ts`

Canonical V1 data structures.

The `Experience` record is the most important object. It separates original user input, structured fields, and verified facts.

### `src/lib/matching.ts`

Contains:

- transparent JD keyword extraction;
- experience ranking;
- deterministic follow-up-question generation.

This module is deliberately replaceable. Later AI semantic matching should preserve the same input/output contract.

### `src/lib/resume.ts`

Transforms selected verified experience data into resume-ready text.

This is an expression layer, not a source-of-truth layer.

### `src/app/page.tsx`

V1 single-page workspace with four navigation areas:

1. personal profile;
2. experience vault;
3. job match;
4. one-page resume.

The six requested capabilities are implemented across these four screens to keep navigation simple.

## Truth model

CareerVault uses two conceptual layers.

### Fact layer

User-owned source material:

- raw description;
- actions;
- tools;
- outcomes;
- verified facts.

AI must not silently mutate this layer.

### Expression layer

Generated material:

- relevance ranking;
- selected experiences;
- reordered evidence;
- job-specific wording;
- resume summary and bullets.

The expression layer may change per job without changing source facts.

## AI integration boundary

The current V1 uses deterministic local logic so the repository is usable without API keys.

A future model integration should add server-side endpoints for:

- experience interview questions;
- structured extraction from user answers;
- semantic JD analysis;
- job-specific resume wording.

Model output must be validated against stored source facts before it can appear as a factual claim in a generated resume.

## Persistence roadmap

### V1 prototype

Browser localStorage.

Purpose: prove user flow with zero setup.

### Next persistence step

Add authentication and a real database only after the V1 flow is validated. Recommended entities:

- User
- Profile
- Experience
- VerifiedFact
- JobDescription
- MatchRun
- ResumeVersion

`ResumeVersion` should reference source experience/fact IDs so generated content remains traceable.

## Non-goals

Do not expand V1 into a general recruitment platform. In particular, avoid job scraping, auto-apply, social features, application CRM, dozens of templates, and speculative ATS scoring before the six-function core is stable.
