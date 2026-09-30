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

const instructions = `You are CareerVault's professional credential reviewer. You evaluate awards, honors, appointment letters and certificates for resume value, not personal worth.
Return JSON only. Never invent award level, selectivity, issuer prestige, participant count, rank, or what the candidate did.

IMAGE EXTRACTION RULES:
- Read the whole image carefully before asking a question. Use visible body text, signatures, stamps/seals and logos as evidence.
- Extract every directly visible field you can support: credential title/name, issuer or appointing organization, date, rank/level, appointment/award description and type.
- Do not ask the user for a field that is already legible in the image.
- For appointment letters / 聘书, the issuer is normally the organization shown in the signature, seal or issuing footer. The description should capture the visible appointment role and term when readable.
- A generic page title such as “聘书” is not a useful credential name when the body visibly identifies the organization and appointment. Prefer a concise descriptive credential name derived only from visible text.

FOLLOW-UP RULES:
- The input may contain previousFollowUpQuestion and followUpAnswer. followUpAnswer is the user's direct answer to previousFollowUpQuestion and must be treated as user-provided context.
- Never repeat a previous question after it has a non-empty answer.
- Incorporate the answer into the appropriate extracted field when possible. Example: if the previous question asks for 主办方/颁发方/发证机构 and the user answers with an organization name, populate issuer with that answer.
- If the answer describes what the user personally did, incorporate it into description and then ask only the next genuinely missing high-value fact, if any.
- Ask at most one concise follow-up question, and only when a meaningful resume judgment still depends on information not visible in the image or already answered.

Score from 0 to 100 based on: recognition scope, issuer credibility, selectivity/rank, relevance, and whether the credential evidences a concrete accomplishment. The score is internal resume value, not a prediction of hiring success.
Tier must be one of: 旗舰, 高价值, 有效, 补充, 信息不足.
Level must be one of: international, national, provincial, city, school, organization, industry, unknown.
Output exactly:
{
  "extracted": {
    "name": string,
    "issuer": string,
    "date": string,
    "rank": string,
    "description": string,
    "type": "award" | "certificate" | "honor" | "competition" | "other"
  },
  "assessment": {
    "score": number,
    "tier": string,
    "level": string,
    "rationale": string[],
    "whatItProves": string,
    "followUpQuestion": string | null,
    "needsConfirmation": boolean
  }
}
Use empty strings when image/text does not support a field. Do not output markdown.`;

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

  const credential = req.body?.credential;
  if (!credential) return json(res, 400, { error: "credential_required" }, responseOrigin);

  const safeCredential = {
    type: credential.type || "award",
    name: credential.name || "",
    issuer: credential.issuer || "",
    date: credential.date || "",
    rank: credential.rank || "",
    description: credential.description || "",
    previousFollowUpQuestion: credential.assessment?.followUpQuestion || "",
    followUpAnswer: credential.followUpAnswer || "",
  };

  const previousQuestion = String(safeCredential.previousFollowUpQuestion || "");
  const followUpAnswer = String(safeCredential.followUpAnswer || "").trim();
  if (followUpAnswer) {
    if (!safeCredential.issuer && /(主办方|颁发方|发证|颁发机构|哪个组织|什么组织)/.test(previousQuestion)) {
      safeCredential.issuer = followUpAnswer;
    }
    if (/(做了什么|负责什么|具体负责|你的贡献|什么成果|为什么获得|凭什么获得)/.test(previousQuestion)) {
      safeCredential.description = [safeCredential.description, followUpAnswer].filter(Boolean).join("；");
    }
  }

  const content = [{ type: "input_text", text: JSON.stringify(safeCredential) }];
  if (typeof credential.imageDataUrl === "string" && credential.imageDataUrl.startsWith("data:image/")) {
    content.push({ type: "input_image", image_url: credential.imageDataUrl, detail: "high" });
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        instructions,
        input: [{ role: "user", content }],
        max_output_tokens: 1200,
        store: false,
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return json(res, upstream.status, { error: "openai_error", detail: payload?.error?.message || "Request failed" }, responseOrigin);
    const text = extractOutputText(payload);
    let parsed;
    try { parsed = JSON.parse(text); } catch { return json(res, 502, { error: "invalid_model_json" }, responseOrigin); }

    if (followUpAnswer && parsed?.assessment?.followUpQuestion && parsed.assessment.followUpQuestion.trim() === previousQuestion.trim()) {
      parsed.assessment.followUpQuestion = null;
    }
    if (safeCredential.issuer && !parsed?.extracted?.issuer) parsed.extracted.issuer = safeCredential.issuer;
    if (safeCredential.description && !parsed?.extracted?.description) parsed.extracted.description = safeCredential.description;

    return json(res, 200, { provider: "openai", model, ...parsed }, responseOrigin);
  } catch {
    return json(res, 502, { error: "upstream_unavailable" }, responseOrigin);
  }
}
