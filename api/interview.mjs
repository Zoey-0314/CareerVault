import { createResponse, extractOutputText, getAiProvider, providerDisplayName } from "./_ai-provider.mjs";

const DEFAULT_ORIGIN = "https://zoey-0314.github.io";

function allowedOrigins(req) {
  const configured = (process.env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(",").map((item) => item.trim()).filter(Boolean);
  const host = req.headers.host ? `https://${req.headers.host}` : "";
  return Array.from(new Set([...configured, host].filter(Boolean)));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(res, status, body, origin) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(corsHeaders(origin))) res.setHeader(key, value);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function cleanJsonText(text) {
  let raw = String(text || "").trim();
  if (!raw) return "";
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) raw = raw.slice(first, last + 1);
  return raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1");
}

function compactExperience(experience) {
  return {
    type: experience?.type || "",
    title: experience?.title || "",
    organization: experience?.organization || "",
    source: experience?.source || "manual",
    rawDescription: experience?.rawDescription || "",
    actions: experience?.actions || "",
    tools: experience?.tools || "",
    outcomes: experience?.outcomes || "",
    verifiedFacts: Array.isArray(experience?.verifiedFacts) ? experience.verifiedFacts.slice(-24) : [],
  };
}

const instructions = `You are CareerVault's professional resume interview agent. You behave like an experienced recruiter/resume consultant, not a generic chatbot.

YOUR JOB EACH TURN
1. Read ALL existing structured experience facts before asking anything.
2. If latestAnswer is non-empty, extract every useful fact it contains without inventing or strengthening it.
3. Decide the single highest-value next question from the actual gaps in THIS experience.
4. Never repeat a question already answered, skipped, or semantically covered by existing facts.
5. If no high-value question remains, return nextQuestion=null and complete=true.

FACT SAFETY
- Never invent metrics, ownership, tools, dates, outcomes, awards, difficulty, or skill level.
- If a claim is approximate, ambiguous, inferred, or materially stronger than the user's wording, mark needs_confirmation.
- Allowed goals: specificity, tool, scale, result, ownership, difficulty, evidence.
- Allowed targets: actions, tools, outcomes, verifiedFacts.
- For verifiedFacts, use these prefixes when relevant: 规模：, 个人贡献：, AI参与：, 难点：, 证据：, 面试准备：.
- If the user says they do not know / do not remember / did not track something, do not ask the same topic again.

AI-ASSISTED PROJECT RULES
- AI use is NOT automatically a resume bullet and should not be treated as a negative signal.
- When the user states that AI generated substantial code, save the truthful boundary as AI参与：... .
- Also create one or more 面试准备：... verifiedFacts describing concrete topics the user should be ready to explain in a real interview. These are preparation prompts, NOT invented answers or claims.
- Interview-prep prompts should be grounded in modules already present in the experience, e.g. architecture decisions, why a safety mechanism exists, debugging decisions, tests, integration, failure cases, or how the user verified AI-generated code.
- Never fabricate what the user would answer. If their understanding is unknown, phrase it as something to prepare, such as “面试准备：说明 SafeDwgSaver 为什么采用临时文件+验证+替换，以及如何验证失败不会损坏原图”。
- Resume wording should focus on what the user actually reviewed, modified, debugged, integrated, tested, validated, designed or decided, not on hiding or exaggerating authorship.

QUESTION SELECTION RULES
- Questions MUST be generated from the existing information, not from a fixed questionnaire.
- Prefer specific gaps that would materially improve a resume or interview defensibility.
- Do not ask for scale if the experience already has a meaningful scale statement.
- Do not ask for tools if tools are already well evidenced.
- Do not ask for difficulty merely to fill a checklist; ask it only when it may reveal decision-making, debugging, coordination, or problem solving.
- Do not ask for evidence if the user already has obvious evidence or if another missing fact is more valuable.
- For project/coursework/research/coding experiences, if AI involvement is not yet known and the project plausibly used AI coding or generative AI, you MAY ask under goal=ownership whether AI was used, what AI generated, and what the user personally decided, verified, debugged, integrated, or tested.
- When AI involvement is already stated, do not ask again. Instead, if useful, ask a technical understanding question about a specific module so the user can prepare for interviews.
- For a mature experience with enough concrete actions, tools, outcomes and ownership, stop instead of chasing 100% for low-value fields.

PREVIOUS QUESTIONS
- previousQuestion is the exact last question shown to the user.
- askedQuestions contains recent questions already asked. Do not repeat or paraphrase them unless the user's latest answer explicitly asks for clarification.
- If latestAnswer answers previousQuestion, absorb it before choosing the next question.

QUESTION STYLE
- Ask one concise question at a time.
- Explain in one short sentence why it matters to HR/resume quality.
- Options are optional quick replies, maximum 5.
- Make the question specific to the candidate's current project whenever possible.

Return only JSON matching the requested schema.`;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    acknowledgement: { type: "string" },
    extractedFacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          goal: { type: "string", enum: ["specificity", "tool", "scale", "result", "ownership", "difficulty", "evidence"] },
          target: { type: "string", enum: ["actions", "tools", "outcomes", "verifiedFacts"] },
          value: { type: "string" },
          status: { type: "string", enum: ["confirmed", "needs_confirmation"] },
          confidence: { type: "number" },
          sourceText: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "goal", "target", "value", "status", "confidence", "sourceText", "reason"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    suggestedNextGoal: { anyOf: [{ type: "string", enum: ["specificity", "tool", "scale", "result", "ownership", "difficulty", "evidence"] }, { type: "null" }] },
    nextQuestion: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            goal: { type: "string", enum: ["specificity", "tool", "scale", "result", "ownership", "difficulty", "evidence"] },
            question: { type: "string" },
            why: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            placeholder: { type: "string" },
          },
          required: ["id", "goal", "question", "why", "options", "placeholder"],
        },
        { type: "null" },
      ],
    },
    complete: { type: "boolean" },
  },
  required: ["acknowledgement", "extractedFacts", "warnings", "suggestedNextGoal", "nextQuestion", "complete"],
};

function normalizeAnalysis(value) {
  if (!value || typeof value !== "object") return null;
  if (!Array.isArray(value.extractedFacts)) value.extractedFacts = [];
  if (!Array.isArray(value.warnings)) value.warnings = [];
  if (!("nextQuestion" in value)) value.nextQuestion = null;
  if (!("suggestedNextGoal" in value)) value.suggestedNextGoal = value.nextQuestion?.goal || null;
  if (typeof value.acknowledgement !== "string") value.acknowledgement = "已读取这轮回答。";
  if (typeof value.complete !== "boolean") value.complete = !value.nextQuestion;
  value.extractedFacts = value.extractedFacts.filter((fact) => fact && typeof fact.value === "string" && fact.value.trim());
  return value;
}

async function repairJson(ai, rawText) {
  const { upstream, payload } = await createResponse(ai, {
    model: ai.model,
    reasoning: { effort: "low" },
    instructions: "Convert the supplied malformed model output into valid JSON only. Preserve meaning exactly. Do not invent facts. Return one JSON object and no markdown.",
    input: JSON.stringify({ schema: responseSchema, malformedOutput: rawText }),
    text: { format: { type: "json_object" } },
    max_output_tokens: 1600,
    store: false,
  });
  if (!upstream.ok) return null;
  try { return normalizeAnalysis(JSON.parse(cleanJsonText(extractOutputText(payload)))); }
  catch { return null; }
}

export default async function handler(req, res) {
  const origins = allowedOrigins(req);
  const requestOrigin = req.headers.origin || "";
  const responseOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0] || "*";

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [key, value] of Object.entries(corsHeaders(responseOrigin))) res.setHeader(key, value);
    res.end();
    return;
  }
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" }, responseOrigin);
  if (requestOrigin && !origins.includes(requestOrigin)) return json(res, 403, { error: "origin_not_allowed", detail: `Origin ${requestOrigin} is not allowed.` }, responseOrigin);

  let ai;
  try { ai = getAiProvider(); }
  catch (error) { return json(res, 500, { error: "invalid_ai_provider", detail: error instanceof Error ? error.message : "AI Provider 配置无效。" }, responseOrigin); }
  if (!ai.apiKey) return json(res, 503, { error: "ai_not_configured", detail: `Vercel 未配置 ${ai.provider === "deepseek" ? "AI_API_KEY（DeepSeek）" : "AI_API_KEY / OPENAI_API_KEY"}。` }, responseOrigin);

  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const experience = req.body?.experience;
  const previousQuestion = req.body?.previousQuestion || null;
  const askedQuestions = Array.isArray(req.body?.askedQuestions) ? req.body.askedQuestions.slice(-12) : [];
  if (!experience) return json(res, 400, { error: "experience_required", detail: "缺少经历上下文。" }, responseOrigin);
  if (!experience.rawDescription && !experience.actions && !experience.tools && !experience.outcomes) {
    return json(res, 400, { error: "experience_content_required", detail: "请先写一句经历描述，再让 AI 开始追问。" }, responseOrigin);
  }

  const input = JSON.stringify({ experience: compactExperience(experience), previousQuestion, latestAnswer: answer, askedQuestions });

  try {
    const { upstream, payload } = await createResponse(ai, {
      model: ai.model,
      reasoning: { effort: "high" },
      instructions,
      input,
      text: { format: ai.provider === "deepseek" ? { type: "json_object" } : { type: "json_schema", name: "career_interview_turn", schema: responseSchema } },
      max_output_tokens: 1800,
      store: false,
    });

    if (!upstream.ok) {
      return json(res, upstream.status, { error: "model_error", provider: ai.provider, detail: payload?.error?.message || `${providerDisplayName(ai.provider)} request failed`, model: ai.model }, responseOrigin);
    }

    const rawText = extractOutputText(payload);
    let analysis = null;
    try { analysis = normalizeAnalysis(JSON.parse(cleanJsonText(rawText))); } catch { analysis = null; }
    if (!analysis) analysis = await repairJson(ai, rawText);
    if (!analysis) return json(res, 502, { error: "invalid_model_json", provider: ai.provider, detail: "模型返回内容无法解析，自动修复后仍失败。", model: ai.model }, responseOrigin);

    const answeredText = answer.trim();
    const previousText = previousQuestion?.question?.trim() || "";
    if (answeredText && previousText && analysis?.nextQuestion?.question) {
      const nextText = analysis.nextQuestion.question.trim();
      if (nextText === previousText || askedQuestions.some((q) => typeof q === "string" && q.trim() === nextText)) {
        analysis.nextQuestion = null;
        analysis.complete = true;
        analysis.warnings = [...analysis.warnings, "模型尝试重复已问问题，本轮已阻止重复。"];
      }
    }

    return json(res, 200, { provider: ai.provider, model: ai.model, analysis }, responseOrigin);
  } catch (error) {
    return json(res, 502, { error: "upstream_unavailable", provider: ai.provider, detail: error instanceof Error ? error.message : `${providerDisplayName(ai.provider)} 服务暂时不可用。`, model: ai.model }, responseOrigin);
  }
}
