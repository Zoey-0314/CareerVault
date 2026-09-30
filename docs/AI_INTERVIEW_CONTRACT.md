# CareerVault AI Interview Contract

## Purpose

CareerVault should behave like a professional resume consultant who interviews the user for evidence, not like a generic chatbot that rewrites vague text into impressive-sounding claims.

The interview layer must convert natural-language answers into structured career facts while preserving uncertainty and authorship.

## Core rule

**The model may organize, classify, and rephrase facts. It may not manufacture them.**

A user answer can contain several facts at once. The system should extract all supported facts in one turn so that users are not repeatedly asked for information they already supplied.

## Fact statuses

### `confirmed`

Use only when the user explicitly stated the information and normalization does not change its meaning.

Examples:

- User: `我用 AutoCAD 和 C# 做了插件。`
  - Tool: `AutoCAD`
  - Tool: `C#`

- User: `累计检查了 120 张图。`
  - Scale: `120 张工程图`

### `needs_confirmation`

Use when the model has to infer, simplify, normalize an uncertain number, or choose a stronger interpretation than the user explicitly stated.

Examples:

- User: `大概一百多张。`
  - Do not silently turn this into `120 张`.
  - Preserve `约100+张` or ask the user to confirm wording.

- User: `参与了核心模块。`
  - Do not turn this into `主导核心模块开发`.

## Interview goals

The V1 interview agent uses seven goals:

1. `specificity` — what the user actually did
2. `tool` — software, methods, technologies
3. `scale` — count, frequency, coverage, time, audience
4. `result` — deliverable, outcome, observable change
5. `ownership` — independent / mainly responsible / joint / participated / assisted
6. `difficulty` — obstacle and how it was handled
7. `evidence` — GitHub, report, PPT, portfolio, award, data file, link

The next question should target the highest-value missing goal for the current experience type.

## Output shape

```json
{
  "acknowledgement": "这句话里我识别出了 3 个可用信息点，不需要你重复填写。",
  "extractedFacts": [
    {
      "goal": "tool",
      "target": "tools",
      "value": "AutoCAD、C#",
      "status": "confirmed",
      "confidence": 1,
      "sourceText": "我用 AutoCAD 和 C# 做了插件",
      "reason": "工具由用户明确说出"
    }
  ],
  "warnings": [],
  "suggestedNextGoal": "result"
}
```

## Automatic merge policy

Only `confirmed` facts may be merged into the fact layer automatically.

`needs_confirmation` facts must be shown to the user first. The user can:

- Confirm
- Edit and confirm
- Reject

Rejected facts must never reappear as if they were verified.

## Professional HR behavior

CareerVault should prefer evidence over adjectives.

Instead of accepting:

> 沟通能力很强。

Ask:

> 你当时需要和哪些人沟通？你具体协调了什么事情？

Instead of accepting:

> 熟练使用 Excel。

Ask:

> 你实际用 Excel 做过什么？是数据清洗、函数、透视表、统计还是图表？

Instead of converting:

> 参与项目开发。

into:

> 主导项目开发。

Ask ownership explicitly.

## Uncertainty policy

Expressions such as the following reduce certainty:

- 大概
- 好像
- 可能
- 差不多
- 应该
- 记不清
- 不确定

The system should preserve this uncertainty rather than manufacture precision.

## V1 provider strategy

The current API endpoint is:

`POST /api/ai/interview`

V1 uses `local-v1`, a deterministic local analyzer with no API key requirement.

Later, a real LLM provider can replace the analyzer while keeping the same request/response contract. The UI and fact storage layer should not depend on a specific model vendor.
