# CareerVault AI Evaluation

This directory is the regression-test foundation for AI quality. The goal is to stop judging prompt changes by a few screenshots and instead measure whether a model reads, structures, and grounds information correctly.

## What is measured

### Credential cases

Credential evaluation separates:

1. **Transcription coverage** — did vision actually read the critical text?
2. **Field accuracy** — did the model put the text into the correct semantic fields?
3. **Missing required rate** — did required fields disappear?
4. **Hallucination count** — did the result add claims that the source does not support?

This separation matters. A model can read `NX CAD Senior Operator` perfectly and still incorrectly store `CERTIFICATE` as the credential name. That is a structural failure, not an OCR failure.

### JD cases

JD cases can measure role-title accuracy, required text/section coverage, missing fields, and unsupported additions.

### Interview cases

Interview cases can measure whether required facts are extracted, whether every extracted fact preserves a `sourceText`, and whether forbidden strengthened claims appear.

## Privacy rule

Do **not** commit private screenshots, certificates, resumes, names, portraits, phone numbers, emails, certificate IDs tied to an identifiable person, or private JD files.

Public fixtures contain only the minimum expected facts needed for regression testing.

Original assets go under:

```text
evals/private-assets/
```

That directory is git-ignored.

## Commands

Validate public fixture definitions without calling any model:

```bash
npm run eval:ai:validate
```

Run normal unit tests for the evaluator:

```bash
npm test
```

Run live evaluation against the deployed CareerVault API:

```bash
npm run eval:ai:live
```

Default target:

```text
https://www.career-vault.xyz
```

Run only one case:

```bash
npm run eval:ai:live -- --case=credential-siemens-nx-senior-operator
```

Use another asset directory:

```bash
npm run eval:ai:live -- --asset-dir=/absolute/path/to/private-eval-assets
```

Use another deployment:

```bash
npm run eval:ai:live -- --base-url=https://career-vault-sage.vercel.app
```

Live evaluation consumes the configured provider's API quota. It is intentionally **not** run in CI.

Results are written to:

```text
evals/reports/latest.json
```

Reports are git-ignored by default.

## Adding a credential case

Create a JSON file under `evals/fixtures/credential/`.

Minimum shape:

```json
{
  "id": "credential-example",
  "kind": "credential",
  "assetFile": "credential/example.jpg",
  "request": {
    "credential": {
      "type": "certificate"
    }
  },
  "expected": {
    "fields": {
      "name": { "value": "Expected credential name", "required": true },
      "issuer": { "value": "Expected issuer", "required": true },
      "date": { "value": "2026-09", "match": "month", "required": true }
    },
    "transcriptionMustContain": ["critical visible phrase"],
    "forbiddenPatterns": ["unsupported claim"]
  }
}
```

Put the corresponding private image at:

```text
evals/private-assets/credential/example.jpg
```

## Quality gate targets

Initial recommended targets for mature cases:

- key-field accuracy: **>= 95%**
- critical transcription coverage: **>= 95%**
- missing required fields: **0%**
- unsupported-claim / hallucination count: **0**

Do not weaken a fixture merely to make a model pass. If a source is genuinely ambiguous, encode that ambiguity explicitly in the fixture.
