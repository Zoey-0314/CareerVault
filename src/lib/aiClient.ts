import type { InterviewAgentAnalysis } from "@/lib/interviewAgent";
import type { InterviewQuestion } from "@/lib/interview";
import type { Credential, CredentialAssessment, Experience } from "@/lib/types";
import { resolveAiEndpoint } from "@/lib/aiEndpoint";

export type RemoteProvider = "openai" | "deepseek";
export type AiOperation = "interview" | "credential" | "jd";

export type AiInterviewAnalysis = InterviewAgentAnalysis & {
  nextQuestion?: InterviewQuestion | null;
  complete?: boolean;
};

export interface AiInterviewResponse {
  provider: RemoteProvider;
  model?: string;
  analysis: AiInterviewAnalysis;
}

export interface AiCredentialResponse {
  provider: RemoteProvider;
  model?: string;
  assessment: CredentialAssessment;
  extracted?: Partial<Pick<Credential, "name" | "issuer" | "date" | "rank" | "description" | "type">>;
  visionUsed?: boolean;
  inputKind?: "image" | "pdf" | "text";
  transcriptionUsed?: boolean;
  keyFieldVerificationUsed?: boolean;
}

export interface AiJdResponse {
  provider: RemoteProvider;
  model?: string;
  jdText: string;
  roleTitle?: string;
  visionUsed?: boolean;
  inputKind?: "image" | "pdf";
}

export interface InterviewTurnContext {
  previousQuestion?: InterviewQuestion | null;
  askedQuestions?: string[];
}

const AI_STATUS_EVENT = "careervault:ai-status";

function emitAiStatus(detail: {
  operation: AiOperation;
  stage: "start" | "success" | "error";
  provider?: RemoteProvider;
  model?: string;
  message?: string;
  visionUsed?: boolean;
  inputKind?: "image" | "pdf" | "text";
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_STATUS_EVENT, { detail }));
}

function endpointFor(kind: "interview" | "credential" | "jd"): string | undefined {
  return resolveAiEndpoint(kind);
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as { detail?: string; error?: string; model?: string; provider?: string } | null;
  const provider = payload?.provider ? `${payload.provider}` : "AI";
  const model = payload?.model ? ` · ${payload.model}` : "";
  return new Error(`${payload?.detail || payload?.error || `${fallback}（${response.status}）`} [${provider}${model}]`);
}


function recognitionMetadata(result: AiCredentialResponse, hasAttachment: boolean): CredentialAssessment | null {
  if (!hasAttachment || !result.visionUsed) return null;
  let confidence = 68;
  const notes: string[] = [];

  if (result.transcriptionUsed) {
    confidence += 12;
    notes.push("已完成全文文字转录");
  }
  if (result.keyFieldVerificationUsed) {
    confidence += 13;
    notes.push("已重新查看原图核对关键字段");
  }
  if (result.assessment.needsConfirmation) {
    confidence -= 5;
    notes.push("仍有关键字段或价值判断需要确认");
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  const recognitionLabel: "高" | "中" | "低" = confidence >= 85 ? "高" : confidence >= 65 ? "中" : "低";
  const recognitionLine = `识别置信度：${confidence}%（${recognitionLabel}）${notes.length ? ` · ${notes[0]}` : ""}`;
  return {
    ...result.assessment,
    recognitionConfidence: confidence,
    recognitionLabel,
    recognitionNotes: notes,
    rationale: [recognitionLine, ...result.assessment.rationale.filter((item) => !item.startsWith("识别置信度："))].slice(0, 5),
  };
}

function chineseDigit(char: string): number | null {
  const digits: Record<string, number> = { "〇": 0, "○": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
  return char in digits ? digits[char] : null;
}

function parseChineseMonth(value: string): number | null {
  const text = value.trim();
  if (text === "十") return 10;
  if (text === "十一") return 11;
  if (text === "十二") return 12;
  if (text.length === 1) return chineseDigit(text);
  return null;
}

function parseChineseYear(value: string): number | null {
  const digits = [...value].map(chineseDigit);
  if (digits.length !== 4 || digits.some((digit) => digit === null)) return null;
  return Number(digits.join(""));
}

function normalizeCredentialMonth(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const alreadyIso = raw.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (alreadyIso) return raw;
  const arabic = raw.match(/(20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})(?:\s*(?:月|[-/.]\d{1,2}(?:日)?))?/);
  if (arabic) {
    const month = Number(arabic[2]);
    if (month >= 1 && month <= 12) return `${arabic[1]}-${String(month).padStart(2, "0")}`;
  }
  const chinese = raw.match(/([二〇○零一二三四五六七八九]{4})年\s*([一二三四五六七八九十]{1,2})月/);
  if (chinese) {
    const year = parseChineseYear(chinese[1]);
    const month = parseChineseMonth(chinese[2]);
    if (year && month && month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}`;
  }
  const englishMonths: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };
  const english = raw.match(/\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (english) return `${english[2]}-${englishMonths[english[1].toLowerCase()]}`;
  return raw;
}

export function isRemoteAiConfigured(): boolean {
  return Boolean(resolveAiEndpoint("interview"));
}

export async function analyzeInterviewWithProvider(answer: string, experience: Experience, context: InterviewTurnContext = {}): Promise<AiInterviewResponse> {
  const url = endpointFor("interview");
  if (!url) throw new Error("当前部署未配置 AI 服务。CareerVault 不再使用本地规则兜底。");
  emitAiStatus({ operation: "interview", stage: "start", message: answer ? "正在分析本轮回答并决定下一问" : "正在阅读已有经历并决定下一问" });
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, experience, previousQuestion: context.previousQuestion || null, askedQuestions: context.askedQuestions || [] }) });
    if (!response.ok) throw await readError(response, "AI 面试调用失败");
    const raw = (await response.json()) as Omit<AiInterviewResponse, "provider"> & { provider?: string };
    if (!raw?.analysis?.extractedFacts || !("nextQuestion" in raw.analysis)) throw new Error("AI 面试服务返回了无效结构。");
    const normalized = raw as AiInterviewResponse;
    emitAiStatus({ operation: "interview", stage: "success", provider: normalized.provider, model: normalized.model, message: "已分析回答并生成下一步" });
    return normalized;
  } catch (error) {
    emitAiStatus({ operation: "interview", stage: "error", message: error instanceof Error ? error.message : "AI 面试调用失败" });
    throw error;
  }
}

export async function analyzeCredentialWithProvider(credential: Credential): Promise<AiCredentialResponse> {
  const url = endpointFor("credential");
  const hasAttachment = Boolean(credential.attachmentDataUrl || credential.imageDataUrl);
  if (!url) throw new Error(hasAttachment
    ? "当前部署未配置 AI 文件识别服务，上传文件没有被读取。"
    : "当前部署未配置 AI 证书判断服务。");
  emitAiStatus({ operation: "credential", stage: "start", message: hasAttachment ? "正在读取证书文件并核对关键字段" : "正在判断证书信息" });
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
    if (!response.ok) throw await readError(response, "奖项/证书识别失败");
    const raw = (await response.json()) as Omit<AiCredentialResponse, "provider"> & { provider?: string };
    if (!raw?.assessment || typeof raw.assessment.score !== "number") throw new Error("识别服务返回了无效结果。");
    if (hasAttachment && !raw.visionUsed) throw new Error("服务端没有确认读取到你上传的图片/PDF，本次结果已丢弃。");
    if (raw.extracted?.date) raw.extracted.date = normalizeCredentialMonth(raw.extracted.date);
    const normalized = raw as AiCredentialResponse;
    const recognition = recognitionMetadata(normalized, hasAttachment);
    if (recognition) normalized.assessment = recognition;
    emitAiStatus({ operation: "credential", stage: "success", provider: normalized.provider, model: normalized.model, visionUsed: normalized.visionUsed, inputKind: normalized.inputKind, message: "文件已读取并完成关键字段核对" });
    return normalized;
  } catch (error) {
    emitAiStatus({ operation: "credential", stage: "error", message: error instanceof Error ? error.message : "奖项/证书文件识别失败" });
    throw error instanceof Error ? error : new Error("奖项/证书 AI 判断失败。");
  }
}

export async function analyzeJdFileWithProvider(fileDataUrl: string | string[], filename: string): Promise<AiJdResponse> {
  const url = endpointFor("jd");
  if (!url) throw new Error("当前部署未配置文件识别服务，请直接粘贴 JD 文本。");
  emitAiStatus({ operation: "jd", stage: "start", message: "正在读取岗位文件并提取 JD" });
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileDataUrls: Array.isArray(fileDataUrl) ? fileDataUrl : [fileDataUrl], filename }) });
    if (!response.ok) throw await readError(response, "JD 文件识别失败");
    const raw = (await response.json()) as Omit<AiJdResponse, "provider"> & { provider?: string };
    if (!raw?.jdText?.trim()) throw new Error("文件中没有识别到可用的岗位职责或任职要求。");
    if (!raw.visionUsed) throw new Error("服务端没有确认读取到上传文件，本次结果已丢弃。");
    const normalized = raw as AiJdResponse;
    emitAiStatus({ operation: "jd", stage: "success", provider: normalized.provider, model: normalized.model, visionUsed: normalized.visionUsed, inputKind: normalized.inputKind, message: "已读取岗位文件并提取 JD" });
    return normalized;
  } catch (error) {
    emitAiStatus({ operation: "jd", stage: "error", message: error instanceof Error ? error.message : "JD 文件识别失败" });
    throw error;
  }
}

export async function analyzeJdImageWithProvider(imageDataUrl: string): Promise<AiJdResponse> {
  return analyzeJdFileWithProvider(imageDataUrl, "job-description-image.jpg");
}
