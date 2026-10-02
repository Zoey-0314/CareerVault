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

function makeFileInput(fileDataUrl, filename) {
  if (typeof fileDataUrl !== "string" || !fileDataUrl.startsWith("data:")) return null;
  if (fileDataUrl.startsWith("data:image/")) {
    return { kind: "image", content: { type: "input_image", image_url: fileDataUrl, detail: "high" } };
  }
  if (fileDataUrl.startsWith("data:application/pdf")) {
    const base64 = fileDataUrl.includes(",") ? fileDataUrl.slice(fileDataUrl.indexOf(",") + 1) : fileDataUrl;
    return { kind: "pdf", content: { type: "input_file", filename: filename || "job-description.pdf", file_data: base64 } };
  }
  return null;
}

const instructions = `You are CareerVault's job-description transcriber.
Read the uploaded recruitment image and extract ONLY text supported by the uploaded document.
Preserve the job title, responsibilities, requirements, preferred qualifications, education/experience requirements, tools/skills and other hiring criteria when visible.
Do not invent missing requirements, company information, salary, seniority, technologies, or wording that is not readable.
Remove obvious app chrome/navigation noise when unrelated to the job posting.
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

  let ai;
  try { ai = getAiProvider(); }
  catch (error) { return json(res, 500, { error: "invalid_ai_provider", detail: error instanceof Error ? error.message : "AI Provider 配置无效。" }, responseOrigin); }
  if (!ai.apiKey) return json(res, 503, { error: "ai_not_configured", detail: "Vercel 尚未配置可用的 AI_API_KEY。" }, responseOrigin);

  const fileDataUrl = req.body?.fileDataUrl || req.body?.imageDataUrl;
  const filename = req.body?.filename || "job-description";
  const fileInput = makeFileInput(fileDataUrl, filename);
  if (!fileInput) return json(res, 400, { error: "file_required", detail: "请上传岗位图片或 PDF。" }, responseOrigin);
  if (fileInput.kind === "image" && !ai.supportsImages) {
    return json(res, 400, { error: "vision_not_supported", detail: `${providerDisplayName(ai.provider)} 当前模型 ${ai.model} 不支持图片输入；DeepSeek 请使用 deepseek-flash。` }, responseOrigin);
  }
  if (fileInput.kind === "pdf" && !ai.supportsPdfInput) {
    return json(res, 400, { error: "pdf_not_supported", detail: "DeepSeek Responses API 当前不支持 PDF 文件输入。请先把 JD PDF 转成图片，或直接复制粘贴 JD 文本。" }, responseOrigin);
  }

  try {
    const { upstream, payload } = await createResponse(ai, {
      model: ai.model,
      reasoning: { effort: "low" },
      instructions,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "请逐项读取上传的岗位/JD文件，只转录其中真实包含的招聘要求。" },
          fileInput.content,
        ],
      }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 2600,
      store: false,
    });

    if (!upstream.ok) return json(res, upstream.status, {
      error: "model_error",
      provider: ai.provider,
      detail: payload?.error?.message || `${providerDisplayName(ai.provider)} request failed`,
      model: ai.model,
    }, responseOrigin);

    const text = extractOutputText(payload);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return json(res, 502, { error: "invalid_model_json", provider: ai.provider, detail: "模型没有返回可解析的 JD 文本。", model: ai.model }, responseOrigin); }
    if (typeof parsed?.jdText !== "string") return json(res, 502, { error: "invalid_model_payload", provider: ai.provider, detail: "模型没有返回 JD 文本。", model: ai.model }, responseOrigin);

    return json(res, 200, {
      provider: ai.provider,
      model: ai.model,
      roleTitle: parsed.roleTitle || "",
      jdText: parsed.jdText,
      visionUsed: true,
      inputKind: fileInput.kind,
    }, responseOrigin);
  } catch (error) {
    return json(res, 502, { error: "upstream_unavailable", provider: ai.provider, detail: error instanceof Error ? error.message : "JD 文件识别服务暂时不可用。", model: ai.model }, responseOrigin);
  }
}
