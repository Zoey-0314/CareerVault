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
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) raw = raw.slice(first, last + 1);
  return raw.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1");
}

function clauses(text) {
  return String(text || "")
    .split(/[。；;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
}

function unique(items) {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function buildFactCatalog(experiences) {
  const catalog = [];
  for (const experience of experiences.slice(0, 12)) {
    const facts = [];
    const add = (kind, text) => {
      for (const value of clauses(text)) {
        if (!facts.some((item) => item.text === value)) facts.push({ id: `${experience.id}-f${facts.length + 1}`, kind, text: value });
      }
    };
    add("action", experience.actions);
    add("outcome", experience.outcomes);
    for (const value of experience.evidence?.scale || []) add("scale", value);
    for (const value of experience.evidence?.ownership || []) add("ownership", value);
    for (const value of experience.evidence?.difficulties || []) add("difficulty", value);
    for (const value of experience.evidence?.artifacts || []) add("evidence", value);
    for (const value of experience.aiContext?.userContribution || []) add("userContribution", value);
    // Raw description is allowed only as a fallback source; internal AI contribution/interview-prep is never exposed to the writer.
    if (facts.length < 3) add("rawDescription", experience.rawDescription);
    catalog.push({
      experienceId: experience.id,
      title: experience.title || "",
      organization: experience.organization || "",
      type: experience.type || "project",
      startDate: experience.startDate || "",
      endDate: experience.endDate || "",
      tools: experience.tools || "",
      facts: facts.slice(0, 24),
    });
  }
  return catalog;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    targetRole: { type: "string" },
    selected: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          experienceId: { type: "string" },
          relevanceScore: { type: "number" },
          matchReasons: { type: "array", items: { type: "string" } },
          bullets: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                sourceFactIds: { type: "array", items: { type: "string" } },
              },
              required: ["text", "sourceFactIds"],
            },
          },
        },
        required: ["experienceId", "relevanceScore", "matchReasons", "bullets"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["targetRole", "selected", "warnings"],
};

const instructions = `You are CareerVault's fact-grounded resume editor and semantic JD matcher.

You receive a target JD and a FACT CATALOG. Every catalog fact has an immutable fact id.

RULES
- Select at most 3 experiences that best prove the JD requirements by semantic relevance, not just exact keyword overlap.
- For each selected experience write 1-3 concise Chinese resume bullets.
- Every bullet MUST cite 1-4 sourceFactIds from the SAME experience.
- A bullet may compress, reorder, or professionally rewrite the cited facts, but MUST NOT add any new metric, tool, responsibility level, result, user count, performance claim, award, or technical detail.
- Never infer “主导/独立/负责” unless a cited ownership/userContribution fact explicitly supports it.
- Never add or strengthen numbers. Any number appearing in a bullet must already appear in at least one cited fact.
- Do not mention AI usage, AI contribution, interview preparation, Git branch/PR history, package setup, or repo housekeeping unless the JD explicitly requires such operational work and the fact catalog itself contains the user contribution.
- If an experience has no defensible relevance, do not select it.
- If no experience is sufficiently relevant, return selected=[] rather than padding the resume.
- matchReasons explain why the experience matches the JD; they are UI explanations, not resume claims.
- targetRole should be a short role title extracted from the JD; do not invent a company name.

Return only valid JSON matching the schema.`;

function validateBullet(bullet, factMap) {
  const text = typeof bullet?.text === "string" ? bullet.text.trim() : "";
  const ids = unique(Array.isArray(bullet?.sourceFactIds) ? bullet.sourceFactIds : []).filter((id) => factMap.has(id)).slice(0, 4);
  if (!text || ids.length === 0) return null;
  const sourceText = ids.map((id) => factMap.get(id)?.text || "").join(" ");
  const numbers = text.match(/\d+(?:\.\d+)?%?/g) || [];
  if (numbers.some((number) => !sourceText.includes(number))) return null;
  if (/(独立|主导)/.test(text) && !/(独立|主导)/.test(sourceText)) return null;
  return { text: text.slice(0, 120), sourceFactIds: ids };
}

function normalizeResult(value, catalog) {
  if (!value || typeof value !== "object") return null;
  const catalogMap = new Map(catalog.map((entry) => [entry.experienceId, entry]));
  const selected = [];
  for (const item of Array.isArray(value.selected) ? value.selected : []) {
    const entry = catalogMap.get(item?.experienceId);
    if (!entry) continue;
    const factMap = new Map(entry.facts.map((fact) => [fact.id, fact]));
    const bullets = (Array.isArray(item.bullets) ? item.bullets : [])
      .map((bullet) => validateBullet(bullet, factMap))
      .filter(Boolean)
      .slice(0, 3);
    if (!bullets.length) continue;
    selected.push({
      experienceId: entry.experienceId,
      relevanceScore: Math.max(0, Math.min(100, Number(item.relevanceScore) || 0)),
      matchReasons: unique(Array.isArray(item.matchReasons) ? item.matchReasons : []).slice(0, 4),
      bullets,
    });
    if (selected.length >= 3) break;
  }
  return {
    targetRole: typeof value.targetRole === "string" ? value.targetRole.trim().slice(0, 48) : "",
    selected,
    warnings: unique(Array.isArray(value.warnings) ? value.warnings : []).slice(0, 8),
  };
}

export default async function handler(req, res) {
  const origins = allowedOrigins(req);
  const requestOrigin = req.headers.origin || "";
  const responseOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0] || "*";
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [key, value] of Object.entries(corsHeaders(responseOrigin))) res.setHeader(key, value);
    res.end(); return;
  }
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" }, responseOrigin);
  if (requestOrigin && !origins.includes(requestOrigin)) return json(res, 403, { error: "origin_not_allowed" }, responseOrigin);

  let ai;
  try { ai = getAiProvider(); }
  catch (error) { return json(res, 500, { error: "invalid_ai_provider", detail: error instanceof Error ? error.message : "AI Provider 配置无效。" }, responseOrigin); }
  if (!ai.apiKey) return json(res, 503, { error: "ai_not_configured", provider: ai.provider, model: ai.model }, responseOrigin);

  const jd = typeof req.body?.jd === "string" ? req.body.jd.trim() : "";
  const experiences = Array.isArray(req.body?.experiences) ? req.body.experiences : [];
  if (!jd) return json(res, 400, { error: "jd_required", detail: "请先输入目标岗位 JD。" }, responseOrigin);
  if (!experiences.length) return json(res, 400, { error: "experiences_required", detail: "经历库还没有可供匹配的经历。" }, responseOrigin);

  const catalog = buildFactCatalog(experiences);
  try {
    const { upstream, payload } = await createResponse(ai, {
      model: ai.model,
      reasoning: { effort: "high" },
      instructions,
      input: JSON.stringify({ jd: jd.slice(0, 16000), factCatalog: catalog }),
      text: { format: ai.provider === "deepseek" ? { type: "json_object" } : { type: "json_schema", name: "career_resume_draft", schema } },
      max_output_tokens: 2200,
      store: false,
    });
    if (!upstream.ok) return json(res, upstream.status || 502, {
      error: "model_error", provider: ai.provider, model: ai.model,
      detail: payload?.error?.message || `${providerDisplayName(ai.provider)} request failed`,
    }, responseOrigin);

    let parsed;
    try { parsed = JSON.parse(cleanJsonText(extractOutputText(payload))); }
    catch { parsed = null; }
    const draft = normalizeResult(parsed, catalog);
    if (!draft) return json(res, 502, { error: "invalid_model_json", provider: ai.provider, model: ai.model, detail: "AI 简历结果无法解析。" }, responseOrigin);
    return json(res, 200, { provider: ai.provider, model: ai.model, ...draft }, responseOrigin);
  } catch (error) {
    return json(res, 502, { error: "upstream_unavailable", provider: ai.provider, model: ai.model, detail: error instanceof Error ? error.message : "AI 简历服务暂时不可用。" }, responseOrigin);
  }
}
