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
    verifiedFacts: Array.isArray(experience?.verifiedFacts) ? experience.verifiedFacts.slice(-30) : [],
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
- Interview-prep prompts must be grounded in modules already present in the experience: architecture decisions, why a safety mechanism exists, debugging decisions, tests, integration, failure cases, or how the user verified AI-generated code.
- Never fabricate what the user would answer. If understanding is unknown, phrase it as something to prepare.
- Resume wording should focus on what the user actually reviewed, modified, debugged, integrated, tested, validated, designed or decided.

QUESTION SELECTION RULES
- Questions MUST be generated from existing information, not from a fixed questionnaire.
- Prefer a concrete missing fact that materially improves resume quality or interview defensibility.
- Do not ask for scale if a meaningful scale is already known.
- Do not ask for tools if tools are already well evidenced.
- Do not ask for difficulty merely to fill a checklist.
- Do not ask for evidence if there is already obvious evidence or another missing fact is more valuable.
- If AI involvement is unknown and the project plausibly used AI coding, you MAY ask what AI generated and what the user personally decided, verified, debugged, integrated or tested.
- Once AI involvement is known, do not ask the same ownership question again. If useful, ask a technical understanding question about a specific known module.
- For a mature experience with enough concrete actions, tools, outcomes and ownership, stop instead of chasing 100%.

PREVIOUS QUESTIONS
- previousQuestion is the exact last question shown to the user.
- askedQuestions contains recent questions already asked. Do not repeat or paraphrase them unless the user explicitly asks for clarification.
- If latestAnswer answers previousQuestion, absorb it before choosing the next question.

QUESTION STYLE
- Ask exactly one concise question at a time.
- Explain in one short sentence why it matters.
- Options are optional quick replies, maximum 5.
- Make the question specific to the candidate's current project. Mention known modules or facts when useful.
- Do not create a giant multi-part question covering several modules at once. Prefer one narrow question that can be answered in 1-3 sentences.

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

function normalizeFact(fact, index) {
  if (!fact || typeof fact !== "object") return null;
  const value = typeof fact.value === "string" ? fact.value.trim() : "";
  if (!value) return null;
  const goals = new Set(["specificity", "tool", "scale", "result", "ownership", "difficulty", "evidence"]);
  const targets = new Set(["actions", "tools", "outcomes", "verifiedFacts"]);
  return {
    id: typeof fact.id === "string" && fact.id.trim() ? fact.id.trim() : `fact-${Date.now()}-${index}`,
    goal: goals.has(fact.goal) ? fact.goal : "specificity",
    target: targets.has(fact.target) ? fact.target : "verifiedFacts",
    value,
    status: fact.status === "needs_confirmation" ? "needs_confirmation" : "confirmed",
    confidence: Number.isFinite(Number(fact.confidence)) ? Math.max(0, Math.min(1, Number(fact.confidence))) : 0.8,
    sourceText: typeof fact.sourceText === "string" ? fact.sourceText : "",
    reason: typeof fact.reason === "string" ? fact.reason : "",
  };
}

function normalizeAnalysis(value) {
  if (!value || typeof value !== "object") return null;
  const facts = Array.isArray(value.extractedFacts)
    ? value.extractedFacts.map(normalizeFact).filter(Boolean)
    : [];
  const warnings = Array.isArray(value.warnings) ? value.warnings.filter((item) => typeof item === "string") : [];
  let nextQuestion = value.nextQuestion && typeof value.nextQuestion === "object" ? value.nextQuestion : null;
  if (nextQuestion) {
    const question = typeof nextQuestion.question === "string" ? nextQuestion.question.trim() : "";
    if (!question) nextQuestion = null;
    else {
      nextQuestion = {
        id: typeof nextQuestion.id === "string" && nextQuestion.id.trim() ? nextQuestion.id.trim() : `q-${Date.now()}`,
        goal: ["specificity", "tool", "scale", "result", "ownership", "difficulty", "evidence"].includes(nextQuestion.goal) ? nextQuestion.goal : "specificity",
        question,
        why: typeof nextQuestion.why === "string" ? nextQuestion.why : "补充这条信息能提高简历可验证性和面试可解释性。",
        options: Array.isArray(nextQuestion.options) ? nextQuestion.options.filter((item) => typeof item === "string").slice(0, 5) : [],
        placeholder: typeof nextQuestion.placeholder === "string" ? nextQuestion.placeholder : "用你真实做过的事情回答即可。",
      };
    }
  }
  return {
    acknowledgement: typeof value.acknowledgement === "string" ? value.acknowledgement : "已读取这轮回答。",
    extractedFacts: facts,
    warnings,
    suggestedNextGoal: value.suggestedNextGoal || nextQuestion?.goal || null,
    nextQuestion,
    complete: typeof value.complete === "boolean" ? value.complete : !nextQuestion,
  };
}

function parseAnalysis(text) {
  try { return normalizeAnalysis(JSON.parse(cleanJsonText(text))); }
  catch { return null; }
}

async function repairJson(ai, rawText) {
  const { upstream, payload } = await createResponse(ai, {
    model: ai.model,
    reasoning: { effort: "low" },
    instructions: "Convert the supplied malformed model output into valid JSON only. Preserve meaning exactly. Do not invent facts. Return one JSON object and no markdown.",
    input: JSON.stringify({ schema: responseSchema, malformedOutput: rawText }),
    text: { format: { type: "json_object" } },
    max_output_tokens: 1800,
    store: false,
  });
  if (!upstream.ok) return null;
  return parseAnalysis(extractOutputText(payload));
}

async function callInterview(ai, input, extraInstruction = "") {
  let last = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await createResponse(ai, {
      model: ai.model,
      reasoning: { effort: attempt === 1 ? "high" : "low" },
      instructions: `${instructions}${extraInstruction ? `\n\n${extraInstruction}` : ""}`,
      input,
      text: { format: ai.provider === "deepseek" ? { type: "json_object" } : { type: "json_schema", name: "career_interview_turn", schema: responseSchema } },
      max_output_tokens: 1800,
      store: false,
    });
    last = result;
    if (result.upstream.ok) return { ...result, attempts: attempt };
    if (![429, 500, 502, 503, 504].includes(result.upstream.status)) break;
  }
  return { ...last, attempts: 2 };
}

function questionSignature(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:\s()（）【】\[\]“”"'·#]/g, "")
    .replace(/cadchecktool|chatgpt|copilot|deepseek|ai/g, "");
}

function isRepeatedQuestion(question, previousQuestion, askedQuestions) {
  const sig = questionSignature(question);
  if (!sig) return false;
  const candidates = [previousQuestion?.question, ...askedQuestions].filter(Boolean).map(questionSignature).filter(Boolean);
  return candidates.some((known) => {
    if (sig === known || sig.includes(known) || known.includes(sig)) return true;
    const shorter = sig.length < known.length ? sig : known;
    const longer = sig.length < known.length ? known : sig;
    if (shorter.length < 8) return false;
    let overlap = 0;
    for (let i = 0; i <= shorter.length - 2; i += 1) {
      if (longer.includes(shorter.slice(i, i + 2))) overlap += 1;
    }
    return overlap / Math.max(1, shorter.length - 1) >= 0.72;
  });
}

async function getAlternativeQuestion(ai, baseInput, currentAnalysis, askedQuestions) {
  const extra = `The previous generation proposed a repeated question. Keep all extracted facts unchanged in meaning, but choose a DIFFERENT single next question not semantically covered by askedQuestions. If there is genuinely no other high-value gap, set nextQuestion=null and complete=true.`;
  const input = JSON.stringify({ ...JSON.parse(baseInput), askedQuestions: [...askedQuestions, currentAnalysis?.nextQuestion?.question || ""].filter(Boolean), retryBecause: "repeated_question" });
  const result = await callInterview(ai, input, extra);
  if (!result?.upstream?.ok) return null;
  let parsed = parseAnalysis(extractOutputText(result.payload));
  if (!parsed) parsed = await repairJson(ai, extractOutputText(result.payload));
  return parsed;
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
  const askedQuestions = Array.isArray(req.body?.askedQuestions) ? req.body.askedQuestions.slice(-16) : [];
  if (!experience) return json(res, 400, { error: "experience_required", detail: "缺少经历上下文。" }, responseOrigin);
  if (!experience.rawDescription && !experience.actions && !experience.tools && !experience.outcomes) {
    return json(res, 400, { error: "experience_content_required", detail: "请先写一句经历描述，再让 AI 开始追问。" }, responseOrigin);
  }

  const input = JSON.stringify({ experience: compactExperience(experience), previousQuestion, latestAnswer: answer, askedQuestions });

  try {
    const result = await callInterview(ai, input);
    if (!result?.upstream?.ok) {
      return json(res, result?.upstream?.status || 502, {
        error: "model_error",
        provider: ai.provider,
        detail: result?.payload?.error?.message || `${providerDisplayName(ai.provider)} request failed`,
        model: ai.model,
        attempts: result?.attempts || 1,
      }, responseOrigin);
    }

    const rawText = extractOutputText(result.payload);
    let analysis = parseAnalysis(rawText);
    let parsedVia = "direct";
    if (!analysis) {
      analysis = await repairJson(ai, rawText);
      parsedVia = analysis ? "repair" : "failed";
    }
    if (!analysis) return json(res, 502, {
      error: "invalid_model_json",
      provider: ai.provider,
      detail: "模型返回内容无法解析，自动修复后仍失败。",
      model: ai.model,
      attempts: result.attempts,
    }, responseOrigin);

    if (analysis.nextQuestion?.question && isRepeatedQuestion(analysis.nextQuestion.question, previousQuestion, askedQuestions)) {
      const alternative = await getAlternativeQuestion(ai, input, analysis, askedQuestions);
      if (alternative) {
        analysis = {
          ...alternative,
          extractedFacts: analysis.extractedFacts,
          acknowledgement: analysis.acknowledgement,
          warnings: [...analysis.warnings, ...(alternative.warnings || []), "AI 首次生成的问题与已问内容重复，已自动重新生成下一问。"],
        };
      } else {
        analysis.warnings = [...analysis.warnings, "AI 生成的问题与已问内容重复，本轮没有展示重复问题。请重试生成下一问。"];
        analysis.nextQuestion = null;
        analysis.complete = false;
      }
    }

    return json(res, 200, {
      provider: ai.provider,
      model: ai.model,
      analysis,
      meta: { attempts: result.attempts, parsedVia },
    }, responseOrigin);
  } catch (error) {
    return json(res, 502, {
      error: "upstream_unavailable",
      provider: ai.provider,
      detail: error instanceof Error ? error.message : `${providerDisplayName(ai.provider)} 服务暂时不可用。`,
      model: ai.model,
    }, responseOrigin);
  }
}