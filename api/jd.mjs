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

const instructions = `You are CareerVault's job-description image transcriber.
Read the uploaded recruitment/JD screenshot and extract ONLY text visibly supported by the image.
Preserve the job title, responsibilities, requirements, preferred qualifications, education/experience requirements, tools/skills and other hiring criteria when visible.
Do not invent missing requirements, company information, salary, seniority, technologies, or wording that is not readable.
Remove obvious app chrome/navigation noise when it is unrelated to the job posting.
Return JSON only:
{
  "roleTitle": string,
  "jdText": string
}
Use an empty string if the role title is not visible. jdText should be clean plain text suitable for later matching, with short line breaks between sections. Do not output markdown.`;

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

  const imageDataUrl = req.body?.imageDataUrl;
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return json(res, 400, { error: "image_required", detail: "请上传岗位截图或图片。" }, responseOrigin);
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
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "请逐项读取这张岗位/JD图片，只转录图片真实包含的招聘要求。" },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        }],
        max_output_tokens: 2200,
        store: false,
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return json(res, upstream.status, { error: "openai_error", detail: payload?.error?.message || "Request failed" }, responseOrigin);
    const text = extractOutputText(payload);
    let parsed;
    try { parsed = JSON.parse(text); } catch { return json(res, 502, { error: "invalid_model_json", detail: "模型没有返回可解析的 JD 文本。" }, responseOrigin); }
    if (typeof parsed?.jdText !== "string") return json(res, 502, { error: "invalid_model_payload", detail: "模型没有返回 JD 文本。" }, responseOrigin);
    return json(res, 200, { provider: "openai", model, roleTitle: parsed.roleTitle || "", jdText: parsed.jdText }, responseOrigin);
  } catch {
    return json(res, 502, { error: "upstream_unavailable", detail: "JD 图片识别服务暂时不可用。" }, responseOrigin);
  }
}
