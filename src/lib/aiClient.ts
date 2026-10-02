import { analyzeInterviewTurn, type InterviewAgentAnalysis } from "@/lib/interviewAgent";
import { assessCredentialLocally } from "@/lib/credentials";
import { getNextInterviewQuestion, type InterviewQuestion } from "@/lib/interview";
import type { Credential, CredentialAssessment, Experience } from "@/lib/types";

export type RemoteProvider = "openai" | "deepseek";
export type AiOperation = "interview" | "credential" | "jd";

export type AiInterviewAnalysis = InterviewAgentAnalysis & {
  nextQuestion?: InterviewQuestion | null;
  complete?: boolean;
};

/**
 * `provider` is kept as a compatibility alias for older UI code.
 * `upstreamProvider` is the actual remote provider and must be used for truthful display/telemetry.
 */
export interface AiInterviewResponse {
  provider: "local-v1" | "openai";
  upstreamProvider?: RemoteProvider;
  model?: string;
  analysis: AiInterviewAnalysis;
}

export interface AiCredentialResponse {
  provider: "local-v1" | "openai";
  upstreamProvider?: RemoteProvider;
  model?: string;
  assessment: CredentialAssessment;
  extracted?: Partial<Pick<Credential, "name" | "issuer" | "date" | "rank" | "description" | "type">>;
  visionUsed?: boolean;
  inputKind?: "image" | "pdf" | "text";
  transcriptionUsed?: boolean;
  keyFieldVerificationUsed?: boolean;
  fallbackUsed?: boolean;
}

export interface AiJdResponse {
  provider: "openai";
  upstreamProvider?: RemoteProvider;
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

const DEFAULT_PUBLIC_PROXY = "https://career-vault-sage.vercel.app/api/interview";
const AI_STATUS_EVENT = "careervault:ai-status";

function emitAiStatus(detail: {
  operation: AiOperation;
  stage: "start" | "success" | "error" | "local";
  provider?: RemoteProvider | "local-v1";
  model?: string;
  message?: string;
  visionUsed?: boolean;
  fallbackUsed?: boolean;
  inputKind?: "image" | "pdf" | "text";
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_STATUS_EVENT, { detail }));
}

function configuredProxyUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_CAREERVAULT_AI_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    if (window.location.hostname.endsWith("vercel.app")) return `${window.location.origin}/api/interview`;
    if (window.location.hostname === "zoey-0314.github.io") return DEFAULT_PUBLIC_PROXY;
  }
  return undefined;
}

function endpointFor(kind: "interview" | "credential" | "jd"): string | undefined {
  const base = configuredProxyUrl();
  if (!base) return undefined;
  if (/\/api\/(interview|credential|jd)$/.test(base)) return base.replace(/\/api\/(interview|credential|jd)$/, `/api/${kind}`);
  return `${base}/api/${kind}`;
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as { detail?: string; error?: string; model?: string; provider?: string } | null;
  const provider = payload?.provider ? `${payload.provider}` : "AI";
  const model = payload?.model ? ` · ${payload.model}` : "";
  return new Error(`${payload?.detail || payload?.error || `${fallback}（${response.status}）`} [${provider}${model}]`);
}

function normalizeRemotePayload<T extends { provider?: string; model?: string }>(payload: T): T & { provider: "openai"; upstreamProvider: RemoteProvider } {
  const upstreamProvider: RemoteProvider = payload.provider === "deepseek" ? "deepseek" : "openai";
  return { ...payload, provider: "openai", upstreamProvider } as T & { provider: "openai"; upstreamProvider: RemoteProvider };
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

  return raw;
}

export function isRemoteAiConfigured(): boolean {
  return Boolean(configuredProxyUrl());
}

export async function analyzeInterviewWithProvider(
  answer: string,
  experience: Experience,
  context: InterviewTurnContext = {},
): Promise<AiInterviewResponse> {
  const url = endpointFor("interview");
  if (!url) {
    const local = analyzeInterviewTurn(answer, experience);
    emitAiStatus({ operation: "interview", stage: "local", provider: "local-v1", message: "远程 AI 未配置，使用本地规则。" });
    return {
      provider: "local-v1",
      analysis: {
        ...local,
        nextQuestion: getNextInterviewQuestion(experience),
        complete: !getNextInterviewQuestion(experience),
      },
    };
  }

  emitAiStatus({ operation: "interview", stage: "start", message: answer ? "正在分析本轮回答并决定下一问" : "正在阅读已有经历并决定下一问" });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer,
        experience,
        previousQuestion: context.previousQuestion || null,
        askedQuestions: context.askedQuestions || [],
      }),
    });
    if (!response.ok) throw await readError(response, "AI 面试调用失败");
    const raw = (await response.json()) as Omit<AiInterviewResponse, "provider"> & { provider?: string };
    if (!raw?.analysis?.extractedFacts || !("nextQuestion" in raw.analysis)) throw new Error("AI 面试服务返回了无效结构。");
    const normalized = normalizeRemotePayload(raw) as AiInterviewResponse;
    emitAiStatus({ operation: "interview", stage: "success", provider: normalized.upstreamProvider, model: normalized.model, message: "已分析回答并生成下一步" });
    return normalized;
  } catch (error) {
    emitAiStatus({ operation: "interview", stage: "error", message: error instanceof Error ? error.message : "AI 面试调用失败" });
    throw error;
  }
}

export async function analyzeCredentialWithProvider(credential: Credential): Promise<AiCredentialResponse> {
  const local = assessCredentialLocally(credential);
  const url = endpointFor("credential");
  const hasAttachment = Boolean(credential.attachmentDataUrl || credential.imageDataUrl);
  if (!url) {
    if (hasAttachment) throw new Error("当前部署未配置图片/PDF识别服务，上传文件尚未被读取。请稍后重试或手动填写。");
    emitAiStatus({ operation: "credential", stage: "local", provider: "local-v1", message: "仅使用本地文本规则判断" });
    return { provider: "local-v1", assessment: local, visionUsed: false, inputKind: "text" };
  }
  emitAiStatus({ operation: "credential", stage: "start", message: hasAttachment ? "正在读取证书文件并核对关键字段" : "正在判断证书信息" });
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
    if (!response.ok) throw await readError(response, "奖项/证书识别失败");
    const raw = (await response.json()) as Omit<AiCredentialResponse, "provider"> & { provider?: string };
    if (!raw?.assessment || typeof raw.assessment.score !== "number") throw new Error("识别服务返回了无效结果。");
    if (hasAttachment && !raw.visionUsed) throw new Error("服务端没有确认读取到你上传的图片/PDF，本次结果已丢弃。");
    if (raw.extracted?.date) raw.extracted.date = normalizeCredentialMonth(raw.extracted.date);
    const normalized = normalizeRemotePayload(raw) as AiCredentialResponse;
    emitAiStatus({
      operation: "credential",
      stage: "success",
      provider: normalized.upstreamProvider,
      model: normalized.model,
      visionUsed: normalized.visionUsed,
      fallbackUsed: normalized.fallbackUsed,
      inputKind: normalized.inputKind,
      message: normalized.fallbackUsed ? "文件已读取；结构化结果使用了安全兜底，请人工核对" : "文件已读取并完成关键字段核对",
    });
    return normalized;
  } catch (error) {
    emitAiStatus({ operation: "credential", stage: "error", message: error instanceof Error ? error.message : "奖项/证书文件识别失败" });
    if (hasAttachment) throw error instanceof Error ? error : new Error("奖项/证书文件识别失败。");
    return { provider: "local-v1", assessment: local, visionUsed: false, inputKind: "text" };
  }
}

export async function analyzeJdFileWithProvider(fileDataUrl: string, filename: string): Promise<AiJdResponse> {
  const url = endpointFor("jd");
  if (!url) throw new Error("当前部署未配置文件识别服务，请直接粘贴 JD 文本。");
  emitAiStatus({ operation: "jd", stage: "start", message: "正在读取岗位文件并提取 JD" });
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileDataUrl, filename }) });
    if (!response.ok) throw await readError(response, "JD 文件识别失败");
    const raw = (await response.json()) as Omit<AiJdResponse, "provider"> & { provider?: string };
    if (!raw?.jdText?.trim()) throw new Error("文件中没有识别到可用的岗位职责或任职要求。");
    if (!raw.visionUsed) throw new Error("服务端没有确认读取到上传文件，本次结果已丢弃。");
    const normalized = normalizeRemotePayload(raw) as AiJdResponse;
    emitAiStatus({ operation: "jd", stage: "success", provider: normalized.upstreamProvider, model: normalized.model, visionUsed: normalized.visionUsed, inputKind: normalized.inputKind, message: "已读取岗位文件并提取 JD" });
    return normalized;
  } catch (error) {
    emitAiStatus({ operation: "jd", stage: "error", message: error instanceof Error ? error.message : "JD 文件识别失败" });
    throw error;
  }
}

export async function analyzeJdImageWithProvider(imageDataUrl: string): Promise<AiJdResponse> {
  return analyzeJdFileWithProvider(imageDataUrl, "job-description-image.jpg");
}
