const DEFAULT_ORIGIN = "https://zoey-0314.github.io";
const DEFAULT_MODEL = "gpt-6-luna";

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

function extractOutputText(payload) {
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function compactExperience(experience) {
  return {
    type: experience?.type || "",
    title: experience?.title || "",
    organization: experience?.organization || "",
    rawDescription: experience?.rawDescription || "",
    actions: experience?.actions || "",
    tools: experience?.tools || "",
    outcomes: experience?.outcomes || "",
    verifiedFacts: Array.isArray(experience?.verifiedFacts) ? experience.verifiedFacts.slice(-12) : [],
  };
}

const instructions = `You are CareerVault's professional resume interview agent.
Return JSON only. Never invent facts. Extract only information supported by the user's words.
If a claim is approximate, ambiguous, inferred, or materially stronger than the user's wording, mark it needs_confirmation.
Allowed goals: specificity, tool, scale, result, ownership, difficulty, evidence.
Allowed targets: actions, tools, outcomes, verifiedFacts.
Output exactly this shape:
{
  "acknowledgement": string,
  "extractedFacts": [{
    "id": string,
    "goal": string,
    "target": string,
    "value": string,
    "status": "confirmed" | "needs_confirmation",
    "confidence": number,
    "sourceText": string,
    "reason": string
  }],
  "warnings": string[],
  "suggestedNextGoal": string | null
}
Do not output markdown. Do not add unsupported metrics, ownership, tools, outcomes, awards, dates, or skill levels.`;

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
  if (requestOrigin && !origins.includes(requestOrigin)) return json(res, 403, { error: "origin_not_allowed" }, responseOrigin);
  if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: "openai_not_configured" }, responseOrigin);

  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const experience = req.body?.experience;
  if (!answer || !experience) return json(res, 400, { error: "answer_and_experience_required" }, responseOrigin);

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const input = JSON.stringify({ experience: compactExperience(experience), latestAnswer: answer });

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, reasoning: { effort: "low" }, instructions, input, max_output_tokens: 900, store: false }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return json(res, upstream.status, { error: "openai_error", detail: payload?.error?.message || "Request failed" }, responseOrigin);
    const text = extractOutputText(payload);
    let analysis;
    try { analysis = JSON.parse(text); } catch { return json(res, 502, { error: "invalid_model_json" }, responseOrigin); }
    return json(res, 200, { provider: "openai", model, analysis }, responseOrigin);
  } catch {
    return json(res, 502, { error: "upstream_unavailable" }, responseOrigin);
  }
}
