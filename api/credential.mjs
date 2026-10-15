import { createResponse, extractOutputText, getAiProvider, providerDisplayName } from "./_ai-provider.mjs";

const DEFAULT_ORIGIN = "https://zoey-0314.github.io";
const VALID_TYPES = new Set(["award", "certificate", "honor", "competition", "other"]);

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

function cleanJsonText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const unfenced = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    : raw;
  const first = unfenced.indexOf("{");
  const last = unfenced.lastIndexOf("}");
  if (first >= 0 && last > first) return unfenced.slice(first, last + 1);
  return unfenced;
}

function tryParseJson(text) {
  const cleaned = cleanJsonText(text);
  if (!cleaned) return null;
  try { return JSON.parse(cleaned); } catch {}
  const relaxed = cleaned
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(relaxed); } catch { return null; }
}

function normalizeType(value, evidence = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (VALID_TYPES.has(raw)) return raw;
  const text = `${value || ""} ${evidence}`;
  if (/荣誉证书|荣誉|优秀|先进个人|先进集体|表彰/.test(text)) return "honor";
  if (/竞赛|比赛|一等奖|二等奖|三等奖|金奖|银奖|铜奖|获奖/.test(text)) return "competition";
  if (/证书|certificate|资格|认证/.test(text)) return "certificate";
  if (/聘书|任命|聘任|任职/.test(text)) return "other";
  if (/奖状|奖项|award/.test(text)) return "award";
  return "other";
}

function nonEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

const ENGLISH_MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function englishDateToMonth(text) {
  const match = String(text || "").match(/\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (!match) return "";
  return `${match[2]}-${ENGLISH_MONTHS[match[1].toLowerCase()]}`;
}

function looksGenericTitle(value) {
  return /^(certificate|certificate of completion|certificate of achievement|证书|荣誉证书|聘书|奖状)$/i.test(String(value || "").trim());
}

export function fallbackFromEvidence(transcription, visualKeyFields, safeCredential) {
  const text = String(transcription || "").replace(/\[无法辨认\]/g, "").trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const key = visualKeyFields && typeof visualKeyFields === "object" ? visualKeyFields : {};

  const issuer = safeCredential.issuer
    || nonEmpty(key.issuer)
    || lines.find((line) => /(Digital Industries Software|Xcelerator Academy|Academy|University|Institute|College|Corporation|Company|Co\.|Ltd\.?|Inc\.?|大学|学院|学校|学生会|委员会|工作部|处|中心|协会|学会|公司|集团|组织)/i.test(line))
    || "";

  const numericOrChineseDate = text.match(/(20\d{2}[年\-/.]\s*\d{1,2}月?|20\d{2}[年\-/.]\s*\d{1,2}[月\-/.]\s*\d{1,2}日?|二[〇○零一二三四五六七八九]{3}年(?:[一二三四五六七八九十]{1,3}月)?)/)?.[1] || "";
  const date = safeCredential.date || nonEmpty(key.date) || englishDateToMonth(text) || numericOrChineseDate;

  const substantiveName = nonEmpty(key.credentialName)
    || nonEmpty(key.role)
    || lines.find((line) =>
      !looksGenericTitle(line)
      && /(NX\s*CAD|CAD|CAE|CAM|Senior Operator|Operator|Engineer|Specialist|Professional|Practitioner|资格|认证|操作员|工程师|专家)/i.test(line)
    )
    || "";

  const rank = safeCredential.rank
    || nonEmpty(key.rank)
    || nonEmpty(key.role)
    || substantiveName
    || lines.find((line) => /(优秀班委|优秀学生|优秀干部|一等奖|二等奖|三等奖|金奖|银奖|铜奖|骨干|部长|干事|名次|等级)/.test(line))
    || "";

  const documentTitle = nonEmpty(key.title) || lines.find((line) => /荣誉证书|聘书|奖状|证书|CERTIFICATE/i.test(line)) || "";
  const certificateNumber = nonEmpty(key.certificateNumber)
    || lines.find((line) => /\b20\d{2}\s+[A-Z]\d{2}\s+\d{4,}\s+\d{2,}\b/i.test(line))
    || "";

  let name = safeCredential.name || "";
  if (!name) {
    if (substantiveName) name = substantiveName;
    else if (/优秀班委/.test(`${rank} ${text}`)) name = "优秀班委荣誉证书";
    else if (/聘书/.test(`${documentTitle} ${text}`) && rank) name = `${rank}聘书`;
    else if (rank && /荣誉证书|表彰/.test(`${documentTitle} ${text}`)) name = `${rank}荣誉证书`;
    else if (documentTitle && !looksGenericTitle(documentTitle)) name = documentTitle;
    else name = rank || documentTitle || "证书/奖项";
  }

  const type = normalizeType(documentTitle, `${text} ${rank} ${substantiveName}`);
  const description = safeCredential.description || [
    substantiveName ? `认证/证明内容：${substantiveName}` : rank ? `证明/表彰内容：${rank}` : "",
    certificateNumber ? `证书编号：${certificateNumber}` : "",
  ].filter(Boolean).join("；");

  let score = 35;
  if (name && !looksGenericTitle(name)) score += 12;
  if (issuer) score += 8;
  if (date) score += 4;
  if (rank || substantiveName) score += 8;
  if (certificateNumber) score += 3;
  score = Math.min(70, score);

  const tier = score >= 65 ? "有效" : score >= 50 ? "补充" : "信息不足";
  const level = type === "certificate" && issuer ? "industry" : /上海大学/.test(`${text} ${issuer}`) ? "school" : "unknown";
  const rationale = [
    issuer ? `已识别发证/颁发机构：${issuer}。` : "发证/颁发机构仍需人工核对。",
    substantiveName ? `已识别具体认证/资格：${substantiveName}。` : "证书具体认证内容仍不够明确。",
    certificateNumber ? "证书编号已识别，可用于后续人工核验。" : "",
    "结构化模型本轮返回不稳定，当前结果由已转录文字和关键字段安全恢复；请保存前核对。",
  ].filter(Boolean);

  return {
    extracted: { name, issuer, date, rank, description, type },
    assessment: {
      score,
      tier,
      level,
      rationale,
      whatItProves: substantiveName
        ? `证明持证人获得或被认可为“${substantiveName}”；具体能力范围以证书及认证标准为准。`
        : rank || name || "该材料可作为相关任职、荣誉或获奖经历的证明。",
      followUpQuestion: null,
      needsConfirmation: true,
    },
    fallbackUsed: true,
  };
}

const transcriptionInstructions = `You are a document transcription engine for CareerVault.
Your ONLY job is to read the uploaded credential image and transcribe visible text faithfully.
- Do not classify, score, summarize, infer, or rewrite the document.
- Read large title text, body text, printed names, handwritten names when legible, signatures, seals/stamps, logos, organization names, dates, appointment roles and terms.
- Preserve Chinese text as Chinese.
- Pay special attention to small footer text, issuing organization, date, appointment title/rank, and text close to seals.
- If a character or short phrase is genuinely unreadable, write [无法辨认] instead of guessing.
- Keep the natural reading order from top to bottom.
- Return plain text only, no markdown, no JSON, no commentary.`;

const keyFieldInstructions = `You are doing a SECOND visual verification pass on a multilingual credential image.
Look at the image itself, not only at the supplied transcription.
Extract only fields that are directly legible. Never guess obscured or blurry text.
Return JSON only with exactly these keys:
{"title":"","credentialName":"","issuer":"","date":"","rank":"","role":"","recipient":"","certificateNumber":"","bodyEvidence":"","uncertain":[]}
Rules:
- title: generic document title when visible, e.g. CERTIFICATE / 荣誉证书 / 聘书.
- credentialName: the substantive qualification, certification, award or recognized role. For example, if the document says "IS RECOGNIZED AS A NX CAD Senior Operator", credentialName must be "NX CAD Senior Operator", not "CERTIFICATE".
- issuer: issuing / appointing organization. For English certificates, preserve names such as "Siemens Digital Industries Software" exactly when visible.
- date: visible issuing date, preserving the source wording.
- rank: award rank / certification level when explicitly present.
- role: appointed or recognized role when explicitly present.
- recipient: recipient name only when clearly readable.
- certificateNumber: certificate / credential number when directly visible.
- bodyEvidence: one short faithful sentence based only on visible body text.
- uncertain: names of fields that are not confidently readable.
Do not infer prestige, selectivity, award level, or missing characters.`;

const analysisInstructions = `You are CareerVault's professional credential reviewer. You evaluate awards, honors, appointment letters and certificates for resume value, not personal worth.
Return JSON only. Never invent award level, selectivity, issuer prestige, participant count, rank, or what the candidate did.

EVIDENCE PRIORITY:
1. visualKeyFields is a dedicated second visual pass for critical fields.
2. transcribedDocument is the full-document transcription.
3. credential contains user-entered fields.
Use only facts directly supported by at least one source. If visualKeyFields and transcription conflict, do not silently choose the stronger claim; prefer the clearer direct field and set needsConfirmation=true when material uncertainty remains.
Never guess text marked [无法辨认] or a field listed in visualKeyFields.uncertain.

Extract: credential name, issuer/appointing organization, date, rank/role, description and type.
The credential name must be the substantive qualification or recognition, not a generic heading such as "CERTIFICATE". For example, "NX CAD Senior Operator" is the credential name when the document says the holder "IS RECOGNIZED AS A NX CAD Senior Operator".
If a certificate number is directly visible, preserve it in description as "证书编号：..."; never invent one.
For 聘书/任命书 use type "other". For 荣誉证书/表彰 use "honor". For competition awards use "competition". Professional software/skills certifications use type "certificate". Never output Chinese words in the type field.
A generic name like “聘书” should be upgraded to a concise factual name only when the role/organization is directly supported, e.g. “上海大学学生会外联部骨干聘书”.
Do not ask for information already visible. Ask at most one follow-up only when resume value depends on missing evidence.
Score 0-100 based only on recognition scope, issuer credibility, selectivity/rank, relevance, and concrete accomplishment evidence. Do not award a high score merely because a document exists.
Tier: 旗舰 | 高价值 | 有效 | 补充 | 信息不足.
Level: international | national | provincial | city | school | organization | industry | unknown.
Output exactly:
{"extracted":{"name":"","issuer":"","date":"","rank":"","description":"","type":"award|certificate|honor|competition|other"},"assessment":{"score":0,"tier":"信息不足","level":"unknown","rationale":[],"whatItProves":"","followUpQuestion":null,"needsConfirmation":false}}`;

async function transcribeImage(ai, imageContent) {
  const { upstream, payload } = await createResponse(ai, {
    model: ai.model,
    reasoning: { effort: "low" },
    instructions: transcriptionInstructions,
    input: [{ role: "user", content: [{ type: "input_text", text: "请逐行读取这张证书、奖状或聘书图片中的所有可见文字，尤其不要漏掉底部署名、印章附近机构名、日期和岗位/奖项名称。" }, imageContent] }],
    max_output_tokens: 2200,
    store: false,
  });
  if (!upstream.ok) {
    const detail = payload?.error?.message || `${providerDisplayName(ai.provider)} visual transcription failed`;
    const error = new Error(detail); error.status = upstream.status; throw error;
  }
  const text = extractOutputText(payload).trim();
  if (!text) throw new Error("图片已发送给模型，但视觉转录没有返回任何文字。");
  return text;
}

async function verifyCriticalFields(ai, imageContent, transcription) {
  const { upstream, payload } = await createResponse(ai, {
    model: ai.model,
    reasoning: { effort: "low" },
    instructions: keyFieldInstructions,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: `这是第一轮转录，仅用于帮助定位，不代表一定正确：\n${transcription}\n\n请重新查看原图，独立核对关键字段。` },
        imageContent,
      ],
    }],
    text: { format: { type: "json_object" } },
    max_output_tokens: 900,
    store: false,
  });
  if (!upstream.ok) return null;
  return tryParseJson(extractOutputText(payload));
}

async function repairStructuredReview(ai, evidence, malformedOutput) {
  const { upstream, payload } = await createResponse(ai, {
    model: ai.model,
    reasoning: { effort: "low" },
    instructions: `Repair a CareerVault credential-review JSON object using ONLY the supplied evidence.
Do not add facts. The original model output may be malformed or incomplete.
Return exactly:
{"extracted":{"name":"","issuer":"","date":"","rank":"","description":"","type":"award|certificate|honor|competition|other"},"assessment":{"score":0,"tier":"旗舰|高价值|有效|补充|信息不足","level":"international|national|provincial|city|school|organization|industry|unknown","rationale":[],"whatItProves":"","followUpQuestion":null,"needsConfirmation":false}}
Use the substantive certification/qualification name instead of a generic word such as CERTIFICATE.
If a visible certificate number exists, preserve it in description.
Never invent prestige, selectivity, results, or candidate contribution.`,
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: JSON.stringify({ evidence, malformedOutput }),
      }],
    }],
    text: { format: { type: "json_object" } },
    max_output_tokens: 1400,
    store: false,
  });
  if (!upstream.ok) return null;
  const repaired = tryParseJson(extractOutputText(payload));
  return repaired?.extracted && repaired?.assessment && typeof repaired.assessment.score === "number" ? repaired : null;
}

export default async function handler(req, res) {
  const origins = allowedOrigins(req);
  const requestOrigin = req.headers.origin || "";
  const responseOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0] || "*";
  if (req.method === "OPTIONS") { res.statusCode = 204; for (const [key, value] of Object.entries(corsHeaders(responseOrigin))) res.setHeader(key, value); res.end(); return; }
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
  if (attachment.kind === "image" && !ai.supportsImages) return json(res, 400, { error: "vision_not_supported", detail: `${providerDisplayName(ai.provider)} 当前模型 ${ai.model} 不支持图片输入；DeepSeek 请使用 deepseek-flash。` }, responseOrigin);
  if (attachment.kind === "pdf" && !ai.supportsPdfInput) return json(res, 400, { error: "pdf_not_supported", detail: "DeepSeek Responses API 当前不支持 PDF 文件输入。请先把 PDF 转成图片上传，或手动填写证书信息。" }, responseOrigin);

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
    if (/(做了什么|负责什么|具体负责|你的贡献|什么成果|为什么获得|凭什么获得)/.test(previousQuestion)) safeCredential.description = [safeCredential.description, followUpAnswer].filter(Boolean).join("；");
  }

  try {
    let transcribedDocument = "";
    let visualKeyFields = null;
    if (attachment.kind === "image" && attachment.content) {
      transcribedDocument = await transcribeImage(ai, attachment.content);
      visualKeyFields = await verifyCriticalFields(ai, attachment.content, transcribedDocument);
    }

    const analysisContent = [{ type: "input_text", text: JSON.stringify({ credential: safeCredential, transcribedDocument, visualKeyFields }) }];
    if (attachment.kind === "pdf" && attachment.content) analysisContent.push(attachment.content);
    const { upstream, payload } = await createResponse(ai, {
      model: ai.model,
      reasoning: { effort: "low" },
      instructions: analysisInstructions,
      input: [{ role: "user", content: analysisContent }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 1800,
      store: false,
    });

    if (!upstream.ok) return json(res, upstream.status, {
      error: "model_error",
      provider: ai.provider,
      detail: payload?.error?.message || `${providerDisplayName(ai.provider)} request failed`,
      model: ai.model,
      transcription: transcribedDocument,
      visualKeyFields,
    }, responseOrigin);

    const rawText = extractOutputText(payload);
    let parsed = tryParseJson(rawText);
    let fallbackUsed = false;
    if (!parsed?.extracted || !parsed?.assessment || typeof parsed.assessment.score !== "number") {
      const repaired = await repairStructuredReview(ai, {
        credential: safeCredential,
        transcribedDocument,
        visualKeyFields,
      }, rawText);
      if (repaired) {
        parsed = repaired;
      } else if (transcribedDocument || visualKeyFields) {
        parsed = fallbackFromEvidence(transcribedDocument, visualKeyFields, safeCredential);
        fallbackUsed = true;
      } else {
        return json(res, 502, { error: "invalid_model_payload", provider: ai.provider, detail: "第二阶段识别结果缺少必要字段。", model: ai.model }, responseOrigin);
      }
    }

    parsed.extracted = parsed.extracted || {};
    parsed.extracted.type = normalizeType(parsed.extracted.type, `${parsed.extracted.name || ""} ${transcribedDocument}`);
    parsed.extracted.name = String(parsed.extracted.name || safeCredential.name || "");
    parsed.extracted.issuer = String(parsed.extracted.issuer || safeCredential.issuer || "");
    parsed.extracted.date = String(parsed.extracted.date || safeCredential.date || "");
    parsed.extracted.rank = String(parsed.extracted.rank || safeCredential.rank || "");
    parsed.extracted.description = String(parsed.extracted.description || safeCredential.description || "");
    if (followUpAnswer && parsed.assessment.followUpQuestion && parsed.assessment.followUpQuestion.trim() === previousQuestion.trim()) parsed.assessment.followUpQuestion = null;

    return json(res, 200, {
      provider: ai.provider,
      model: ai.model,
      visionUsed: attachment.kind === "image" || attachment.kind === "pdf",
      inputKind: attachment.kind,
      transcriptionUsed: Boolean(transcribedDocument),
      transcription: transcribedDocument,
      keyFieldVerificationUsed: Boolean(visualKeyFields),
      visualKeyFields,
      fallbackUsed: fallbackUsed || Boolean(parsed.fallbackUsed),
      ...parsed,
    }, responseOrigin);
  } catch (error) {
    return json(res, Number.isInteger(error?.status) ? error.status : 502, {
      error: "upstream_unavailable",
      provider: ai.provider,
      detail: error instanceof Error ? error.message : "证书识别服务暂时不可用。",
      model: ai.model,
    }, responseOrigin);
  }
}