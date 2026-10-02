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

function attachmentFromCredential(credential) {
  const source = typeof credential?.attachmentDataUrl === "string" && credential.attachmentDataUrl
    ? credential.attachmentDataUrl
    : credential?.imageDataUrl;
  if (typeof source !== "string" || !source.startsWith("data:")) return { kind: "text", content: null };
  if (source.startsWith("data:image/")) {
    return { kind: "image", content: { type: "input_image", image_url: source, detail: "high" } };
  }
  if (source.startsWith("data:application/pdf")) {
    const base64 = source.includes(",") ? source.slice(source.indexOf(",") + 1) : source;
    return {
      kind: "pdf",
      content: {
        type: "input_file",
        filename: credential?.attachmentName || "credential.pdf",
        file_data: base64,
      },
    };
  }
  return { kind: "unsupported", content: null };
}

const instructions = `You are CareerVault's professional credential reviewer. You evaluate awards, honors, appointment letters and certificates for resume value, not personal worth.
Return JSON only. Never invent award level, selectivity, issuer prestige, participant count, rank, or what the candidate did.

DOCUMENT EXTRACTION RULES:
- If an image is attached, READ THAT DOCUMENT FIRST. Do not answer from the generic credential category alone.
- Use visible body text, signatures, stamps/seals, logos and issuing footers as evidence.
- Extract every directly supported field you can: credential title/name, issuer or appointing organization, date, rank/level, appointment/award description and type.
- Do not ask the user for a field that is already legible in the uploaded document.
- For appointment letters / 聘书, the issuer is normally the organization shown in the signature, seal or issuing footer. The description should capture the visible appointment role and term when readable.
- A generic title such as “聘书” is not a useful credential name when the document identifies the organization and appointment. Prefer a concise descriptive name derived only from the document.
- If no document is attached, judge only from the provided text fields.

FOLLOW-UP RULES:
- The input may contain previousFollowUpQuestion and followUpAnswer. followUpAnswer is the user's direct answer to previousFollowUpQuestion and must be treated as user-provided context.
- Never repeat a previous question after it has a non-empty answer.
- Incorporate the answer into the appropriate extracted field when possible.
- If the answer describes what the user personally did, incorporate it into description and then ask only the next genuinely missing high-value fact, if any.
- Ask at most one concise follow-up question, and only when a meaningful resume judgment still depends on information not visible in the document or already answered.

Score from 0 to 100 based on: recognition scope, issuer credibility, selectivity/rank, relevance, and whether the credential evidences a concrete accomplishment. The score is internal resume value, not a prediction of hiring success.
Tier must be one of: 旗舰, 高价值, 有效, 补充, 信息不足.
Level must be one of: international, national, provincial, city, school, organization, industry, unknown.
Output exactly this JSON shape:
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
Use empty strings when the document/text does not support a field. Do not output markdown.`;

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

  const credential = req.body?.credential;
  if (!credential) return json(res, 400, { error: "credential_required" }, responseOrigin);

  const attachment = attachmentFromCredential(credential);
  if (attachment.kind === "unsupported") return json(res, 400, { error: "unsupported_file", detail: "当前只支持 JPG/PNG/WebP 等图片或 PDF。" }, responseOrigin);
  if (attachment.kind === "image" && !ai.supportsImages) {
    return json(res, 400, { error: "vision_not_supported", detail: `${providerDisplayName(ai.provider)} 当前模型 ${ai.model} 不支持图片输入；DeepSeek 请使用 deepseek-flash。` }, responseOrigin);
  }
  if (attachment.kind === "pdf" && !ai.supportsPdfInput) {
    return json(res, 400, { error: "pdf_not_supported", detail: "DeepSeek Responses API 当前不支持 PDF 文件输入。请先把 PDF 转成图片上传，或手动填写证书信息。" }, responseOrigin);
  }

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
    if (!safeCredential.issuer && /(主办方|颁发方|发证|颁发机构|哪个组织|什么组织)/.test(previousQuestion)) safeCredential.issuer = followUpAnswer;
    if (/(做了什么|负责什么|具体负责|你的贡献|什么成果|为什么获得|凭什么获得)/.test(previousQuestion)) {
      safeCredential.description = [safeCredential.description, followUpAnswer].filter(Boolean).join("；");
    }
  }

  const content = [{ type: "input_text", text: JSON.stringify(safeCredential) }];
  if (attachment.content) content.push(attachment.content);

  try {
    const { upstream, payload } = await createResponse(ai, {
      model: ai.model,
      reasoning: { effort: "low" },
      instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 1400,
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
    catch { return json(res, 502, { error: "invalid_model_json", provider: ai.provider, detail: "模型没有返回可解析的证书识别结果。", model: ai.model }, responseOrigin); }

    if (followUpAnswer && parsed?.assessment?.followUpQuestion && parsed.assessment.followUpQuestion.trim() === previousQuestion.trim()) parsed.assessment.followUpQuestion = null;
    if (safeCredential.issuer && !parsed?.extracted?.issuer) parsed.extracted.issuer = safeCredential.issuer;
    if (safeCredential.description && !parsed?.extracted?.description) parsed.extracted.description = safeCredential.description;

    return json(res, 200, {
      provider: ai.provider,
      model: ai.model,
      visionUsed: attachment.kind === "image" || attachment.kind === "pdf",
      inputKind: attachment.kind,
      ...parsed,
    }, responseOrigin);
  } catch (error) {
    return json(res, 502, { error: "upstream_unavailable", provider: ai.provider, detail: error instanceof Error ? error.message : "证书识别服务暂时不可用。", model: ai.model }, responseOrigin);
  }
}
