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
Structured facts
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
    Adaptive interview questions, readiness, answer extraction

src/lib/hrRules.ts
    HR review rules and evidence-strength logic

src/lib/hrPrompt.ts
    Future LLM behavior contract

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

## Future AI integration point

The deterministic interview engine is intentionally usable before an external model is connected.

A future model adapter should improve:

- extracting structured facts from natural-language answers;
- choosing a more context-aware next question;
- understanding JD semantics;
- rewriting resume bullets with better language.

It must not become the source of truth. Every generated claim still has to trace back to stored user facts.
