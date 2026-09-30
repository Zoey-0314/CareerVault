# CareerVault V1 Architecture

## Goal

CareerVault V1 is a low-friction career memory and resume tailoring workspace. It deliberately focuses on six capabilities only:

1. Personal profile
2. Experience library
3. AI-style guided experience enrichment
4. Paste a job description
5. Job-to-experience matching
6. One-page resume generation

## Product boundary

V1 does not include authentication, a remote database, auto-apply, job tracking, cover letters, interview simulation, multiple resume templates, or PDF export.

The prototype stores data locally in the browser so the core workflow can be validated before backend complexity is introduced.

## Core design principle: facts and wording are separate

CareerVault treats user-provided experience facts as the source of truth.

The system may:

- choose which verified facts are relevant to a target role;
- reorder facts;
- rewrite wording;
- shorten or combine facts for a one-page resume.

The system must not:

- invent metrics;
- upgrade participation into ownership;
- invent tools or technologies;
- invent outcomes;
- convert approximate data into false precision;
- write unsupported soft-skill claims.

## V1 data flow

```text
Personal profile
      ↓
Experience intake
      ↓
Adaptive HR interview
      ↓
Structured fact extraction
      ↓
Confirmed facts / confirmation needed
      ↓
Experience library
      ↓
Paste JD
      ↓
Transparent matching
      ↓
Select strongest evidence
      ↓
One-page resume
```

## Adaptive HR interview

The interview is not a static questionnaire and does not expose STAR fields to the user.

A user can start with a sentence such as:

> 负责 CAD 图纸检查和修改。

CareerVault evaluates which evidence category is currently missing and asks exactly one next question.

The V1 interview goals are:

- specificity — what the user actually did;
- tool — real tools, software, methods, or technologies used;
- scale — quantity, frequency, coverage, or scope when known;
- result — deliverable, output, change, or outcome;
- ownership — independent / primary / shared / participant / support;
- difficulty — a real obstacle and how it was handled;
- evidence — material that can support recall or credibility.

Question priority changes by experience type. An internship prioritizes concrete work and scale, while a project prioritizes personal ownership and technical contribution.

The interviewer supports three important escape paths:

- `记不清`
- `跳过`
- explicit statements such as `没有统计`

These answers never trigger fabricated replacement data.

## Structured interview agent

`src/lib/interviewAgent.ts` adds a provider-independent analysis layer on top of the question engine.

One natural-language answer can produce several facts at once. For example:

> 我主要用 AutoCAD 检查了一百多张图，后来又用 C# 做了插件。

The analysis layer can identify multiple evidence categories in the same turn instead of asking the user to repeat them later:

- tool: AutoCAD
- tool: C#
- action: drawing inspection / plugin development
- scale: 100+ drawings

Every extracted fact carries:

- target field
- interview goal
- source text
- confidence
- professional reason
- fact status

Fact status is deliberately limited to:

- `confirmed`
- `needs_confirmation`

Only facts explicitly supported by the user's wording may be marked `confirmed` and merged automatically.

If the answer includes uncertainty such as `大概`, `好像`, `可能`, `记不清`, or if the model materially normalizes the meaning, the fact must remain `needs_confirmation` until the user accepts it.

This rule prevents a future LLM from silently turning an approximate memory into fake precision.

## Interview API contract

The provider-independent route is:

```text
POST /api/ai/interview
```

Request:

```json
{
  "answer": "我用 AutoCAD 检查了 120 张工程图",
  "experience": {}
}
```

Response contains:

- provider identifier
- acknowledgement
- extracted facts
- warnings
- suggested next goal

The current provider is `local-v1`, a deterministic local analyzer that requires no API key.

A later LLM provider must keep the same contract so the UI, fact storage and resume generation layers do not depend on OpenAI, Claude, Gemini or any other specific model vendor.

See `docs/AI_INTERVIEW_CONTRACT.md` for the full contract.

## Experience readiness

Each draft has an information-readiness indicator rather than a fake resume score.

The indicator checks whether the system has enough information to write a defensible resume line:

- basic context;
- concrete action;
- tool or method;
- scale;
- result or deliverable;
- personal ownership;
- difficulty / problem solving;
- evidence material.

Readiness labels are intentionally descriptive:

- 信息不足
- 继续补充
- 可生成
- 强经历

They are not predictions of hiring success.

## HR rule layer

`src/lib/hrRules.ts` contains deterministic professional resume rules.

`docs/HR_RULEBOOK.md` documents the reasoning behind these rules.

`src/lib/hrPrompt.ts` defines the behavioral contract for a future LLM provider. A model must follow the fact boundary above rather than acting like a generic writing assistant.

## Current implementation modules

```text
src/lib/types.ts
    Shared profile, experience and matching types

src/lib/interview.ts
    Adaptive interview questions, readiness and answer routing

src/lib/interviewAgent.ts
    Multi-fact extraction, confidence and truth-safety boundary

src/app/api/ai/interview/route.ts
    Provider-independent interview analysis API

src/lib/hrRules.ts
    HR review rules and evidence-strength logic

src/lib/hrPrompt.ts
    LLM behavior and structured-output contract

src/lib/matching.ts
    Transparent JD-to-experience matching

src/lib/resume.ts
    Resume wording from stored facts
```

## Persistence

V1 uses browser `localStorage` under the key:

```text
careervault-v1
```

Only saved profile data, experiences and JD text are persisted. Interview UI state is temporary.

A later release can replace local persistence with an account + database layer without changing the fact model.

## Current AI strategy

The deterministic interview engine and local analyzer are intentionally usable before an external model is connected.

A future model adapter should improve:

- extracting structured facts from natural-language answers;
- choosing a more context-aware next question;
- understanding JD semantics;
- rewriting resume bullets with better language.

It must not become the source of truth. Every generated claim still has to trace back to stored user facts.

## CI

The branch includes a minimal GitHub Actions workflow that runs:

- `npm install`
- `npm run typecheck`
- `npm run build`

This guards the V1 branch against basic TypeScript and production-build regressions.
