import { createResponse, extractOutputText, getAiProvider, providerDisplayName } from "./_ai-provider.mjs";

const DEFAULT_ORIGIN = "https://zoey-0314.github.io";
const CATEGORIES = new Set(["resume_claim", "jd_requirement", "technical_depth", "behavioral"]);

function allowedOrigins(req) {
  const configured = (process.env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(",").map((item) => item.trim()).filter(Boolean);
  const host = req.headers.host ? `https://${req.headers.host}` : "";
  return Array.from(new Set([...configured, host].filter(Boolean)));
}
function headers(origin) { return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }; }
function json(res, status, body, origin) { res.statusCode = status; for (const [key, value] of Object.entries(headers(origin))) res.setHeader(key, value); res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); }
function clean(text) { let raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); const first = raw.indexOf("{"); const last = raw.lastIndexOf("}"); if (first >= 0 && last > first) raw = raw.slice(first, last + 1); return raw.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1"); }
function unique(items) { return Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean))); }

function compactSelectedExperiences(experiences, selectedIds) {
  const selected = new Set(selectedIds);
  return experiences.filter((item) => selected.has(item?.id)).slice(0, 4).map((item) => ({
    id: item.id,
    title: item.title || "",
    organization: item.organization || "",
    actions: item.actions || "",
    tools: item.tools || "",
    outcomes: item.outcomes || "",
    evidence: item.evidence || {},
    aiContext: item.aiContext || {},
    interviewPrep: item.interviewPrep || {},
    rawDescription: item.rawDescription || "",
  }));
}

function compactDebriefs(debriefs) {
  return (Array.isArray(debriefs) ? debriefs : []).slice(0, 5).map((item) => ({
    round: String(item?.round || ""),
    occurredAt: String(item?.occurredAt || ""),
    questionsAsked: unique(item?.questionsAsked).slice(0, 12),
    stumbles: unique(item?.stumbles).slice(0, 10),
    whatWentWell: unique(item?.whatWentWell).slice(0, 10),
    followUps: unique(item?.followUps).slice(0, 10),
    notes: String(item?.notes || "").slice(0, 1200),
  }));
}

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    questions: { type: "array", items: { type: "object", additionalProperties: false, properties: {
      id: { type: "string" }, category: { type: "string", enum: ["resume_claim", "jd_requirement", "technical_depth", "behavioral"] },
      question: { type: "string" }, why: { type: "string" }, experienceId: { anyOf: [{ type: "string" }, { type: "null" }] },
    }, required: ["id", "category", "question", "why", "experienceId"] } },
    reviewTopics: { type: "array", items: { type: "string" } },
    evidenceGaps: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  }, required: ["questions", "reviewTopics", "evidenceGaps", "warnings"],
};

const instructions = `You are CareerVault's interview-preparation planner.
You receive the EXACT resume snapshot that was submitted and the JD snapshot used for that resume. You also receive structured facts for only the selected experiences and, when available, RECENT INTERVIEW DEBRIEFS written by the candidate.

GOAL
Create a concise interview preparation plan for the candidate to review before this specific interview or next round.

RULES
- Do NOT write model answers and do NOT invent facts.
- Questions must be grounded in either a submitted resume bullet, the saved JD, structured facts supplied here, or an actual prior interview question/stumble/follow-up from RECENT INTERVIEW DEBRIEFS.
- Prioritize questions interviewers commonly ask to verify claims: what the candidate personally did, why a design choice was made, project/business value, upstream/downstream dependencies, debugging/failure handling, test/validation approach, and measurable scope/result when already evidenced.
- When aiContext says AI assisted substantially, include a truthful boundary question about what AI did vs what the candidate personally decided/reviewed/debugged/integrated/tested. Do not treat AI use itself as a negative signal.
- RECENT INTERVIEW DEBRIEFS are candidate-reported history, NOT new career achievements. Use actual questions, stumbles and follow-ups to raise the priority of weak topics for the next round. Never convert debrief notes into resume facts or stronger claims.
- `reviewTopics` are concrete topics the candidate should revise; do not pretend the candidate already knows them. Put unresolved prior stumbles/follow-ups near the top when they remain relevant.
- `evidenceGaps` are JD requirements for which the submitted resume snapshot has weak or no direct evidence. Phrase them as preparation risks, not missing achievements.
- Never strengthen ownership. Never create numbers, tools, systems, responsibilities or outcomes not present in the input.
- Generate 6-10 questions total, ordered by interview value.
- category meanings: resume_claim = verify a submitted claim; jd_requirement = probe JD fit; technical_depth = dig into a known technical/product detail; behavioral = decision/collaboration/reflection grounded in known work.
- If experienceId is used, it must match one supplied selected experience id. Otherwise use null.
Return JSON only.`;

function normalize(value, validExperienceIds) {
  if (!value || typeof value !== "object") return null;
  const questions = [];
  for (const item of Array.isArray(value.questions) ? value.questions : []) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    if (!question) continue;
    const experienceId = validExperienceIds.has(item?.experienceId) ? item.experienceId : undefined;
    questions.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `q-${questions.length + 1}`,
      category: CATEGORIES.has(item.category) ? item.category : "resume_claim",
      question: question.slice(0, 180),
      why: typeof item.why === "string" ? item.why.trim().slice(0, 180) : "这能验证简历中的真实贡献和岗位匹配度。",
      ...(experienceId ? { experienceId } : {}),
    });
    if (questions.length >= 10) break;
  }
  return {
    questions,
    reviewTopics: unique(value.reviewTopics).slice(0, 10),
    evidenceGaps: unique(value.evidenceGaps).slice(0, 8),
    warnings: unique(value.warnings).slice(0, 6),
  };
}

export default async function handler(req, res) {
  const origins = allowedOrigins(req); const requestOrigin = req.headers.origin || ""; const responseOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0] || "*";
  if (req.method === "OPTIONS") { res.statusCode = 204; for (const [key, value] of Object.entries(headers(responseOrigin))) res.setHeader(key, value); res.end(); return; }
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" }, responseOrigin);
  if (requestOrigin && !origins.includes(requestOrigin)) return json(res, 403, { error: "origin_not_allowed" }, responseOrigin);

  let ai;
  try { ai = getAiProvider(); } catch (error) { return json(res, 500, { error: "invalid_ai_provider", detail: error instanceof Error ? error.message : "AI Provider 配置无效。" }, responseOrigin); }
  if (!ai.apiKey) return json(res, 503, { error: "ai_not_configured", provider: ai.provider, model: ai.model }, responseOrigin);

  const resumeVersion = req.body?.resumeVersion;
  const experiences = Array.isArray(req.body?.experiences) ? req.body.experiences : [];
  const debriefs = compactDebriefs(req.body?.debriefs);
  if (!resumeVersion?.id || !resumeVersion?.jdSnapshot) return json(res, 400, { error: "submitted_resume_required", detail: "请先保存并锁定实际投递的简历版本。" }, responseOrigin);
  const selectedIds = Array.isArray(resumeVersion.selectedExperienceIds) ? resumeVersion.selectedExperienceIds : [];
  const selectedExperiences = compactSelectedExperiences(experiences, selectedIds);
  const validIds = new Set(selectedExperiences.map((item) => item.id));

  const input = {
    jdSnapshot: String(resumeVersion.jdSnapshot).slice(0, 16000),
    resumeSnapshot: {
      targetRole: resumeVersion.targetRole || "",
      summary: resumeVersion.summary || "",
      experienceBullets: Array.isArray(resumeVersion.experienceBullets) ? resumeVersion.experienceBullets : [],
    },
    selectedExperiences,
    recentInterviewDebriefs: debriefs,
  };

  try {
    const { upstream, payload } = await createResponse(ai, {
      model: ai.model, reasoning: { effort: "high" }, instructions, input: JSON.stringify(input),
      text: { format: ai.provider === "deepseek" ? { type: "json_object" } : { type: "json_schema", name: "career_interview_prep", schema } },
      max_output_tokens: 2200, store: false,
    });
    if (!upstream.ok) return json(res, upstream.status || 502, { error: "model_error", provider: ai.provider, model: ai.model, detail: payload?.error?.message || `${providerDisplayName(ai.provider)} request failed` }, responseOrigin);
    let parsed; try { parsed = JSON.parse(clean(extractOutputText(payload))); } catch { parsed = null; }
    const plan = normalize(parsed, validIds);
    if (!plan) return json(res, 502, { error: "invalid_model_json", provider: ai.provider, model: ai.model, detail: "面试准备结果无法解析。" }, responseOrigin);
    return json(res, 200, { provider: ai.provider, model: ai.model, ...plan }, responseOrigin);
  } catch (error) {
    return json(res, 502, { error: "upstream_unavailable", provider: ai.provider, model: ai.model, detail: error instanceof Error ? error.message : "面试准备服务暂时不可用。" }, responseOrigin);
  }
}
