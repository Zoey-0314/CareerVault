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

const instructions = `You are CareerVault's professional credential reviewer. You evaluate awards, honors and certificates for resume value, not personal worth.
Return JSON only. Never invent award level, selectivity, issuer prestige, participant count, rank, or what the candidate did.
If the credential image or text does not reveal enough information, explicitly ask one concise follow-up question.
Score from 0 to 100 based on: recognition scope, issuer credibility, selectivity/rank, relevance, and whether the award evidences a concrete accomplishment. The score is internal resume value, not a prediction of hiring success.
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
    followUpAnswer: credential.followUpAnswer || "",
  };
  const content = [{ type: "input_text", text: JSON.stringify(safeCredential) }];
  if (typeof credential.imageDataUrl === "string" && credential.imageDataUrl.startsWith("data:image/")) {
    content.push({ type: "input_image", image_url: credential.imageDataUrl, detail: "low" });
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
        max_output_tokens: 1000,
        store: false,
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return json(res, upstream.status, { error: "openai_error", detail: payload?.error?.message || "Request failed" }, responseOrigin);
    const text = extractOutputText(payload);
    let parsed;
    try { parsed = JSON.parse(text); } catch { return json(res, 502, { error: "invalid_model_json" }, responseOrigin); }
    return json(res, 200, { provider: "openai", model, ...parsed }, responseOrigin);
  } catch {
    return json(res, 502, { error: "upstream_unavailable" }, responseOrigin);
  }
}
