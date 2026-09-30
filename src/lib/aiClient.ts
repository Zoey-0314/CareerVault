import { analyzeInterviewTurn, type InterviewAgentAnalysis } from "@/lib/interviewAgent";
import { assessCredentialLocally } from "@/lib/credentials";
import type { Credential, CredentialAssessment, Experience } from "@/lib/types";

export interface AiInterviewResponse {
  provider: "local-v1" | "openai";
  model?: string;
  analysis: InterviewAgentAnalysis;
}

export interface AiCredentialResponse {
  provider: "local-v1" | "openai";
  model?: string;
  assessment: CredentialAssessment;
  extracted?: Partial<Pick<Credential, "name" | "issuer" | "date" | "rank" | "description" | "type">>;
  visionUsed?: boolean;
  inputKind?: "image" | "pdf" | "text";
}

export interface AiJdResponse {
  provider: "openai";
  model?: string;
  jdText: string;
  roleTitle?: string;
  visionUsed?: boolean;
  inputKind?: "image" | "pdf";
}

const DEFAULT_PUBLIC_PROXY = "https://career-vault-sage.vercel.app/api/interview";

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
  const payload = await response.json().catch(() => null) as { detail?: string; error?: string } | null;
  return new Error(payload?.detail || payload?.error || `${fallback}（${response.status}）`);
}

export function isRemoteAiConfigured(): boolean {
  return Boolean(configuredProxyUrl());
}

export async function analyzeInterviewWithProvider(answer: string, experience: Experience): Promise<AiInterviewResponse> {
  const url = endpointFor("interview");
  if (!url) return { provider: "local-v1", analysis: analyzeInterviewTurn(answer, experience) };
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, experience }) });
    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const payload = (await response.json()) as AiInterviewResponse;
    if (!payload?.analysis?.extractedFacts) throw new Error("Invalid AI proxy payload");
    return payload;
  } catch {
    return { provider: "local-v1", analysis: analyzeInterviewTurn(answer, experience) };
  }
}

export async function analyzeCredentialWithProvider(credential: Credential): Promise<AiCredentialResponse> {
  const local = assessCredentialLocally(credential);
  const url = endpointFor("credential");
  const hasAttachment = Boolean(credential.attachmentDataUrl || credential.imageDataUrl);
  if (!url) {
    if (hasAttachment) throw new Error("当前部署未配置图片/PDF识别服务，上传文件尚未被读取。请稍后重试或手动填写。");
    return { provider: "local-v1", assessment: local, visionUsed: false, inputKind: "text" };
  }
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
    if (!response.ok) throw await readError(response, "奖项/证书识别失败");
    const payload = (await response.json()) as AiCredentialResponse;
    if (!payload?.assessment || typeof payload.assessment.score !== "number") throw new Error("识别服务返回了无效结果。");
    if (hasAttachment && !payload.visionUsed) throw new Error("服务端没有确认读取到你上传的图片/PDF，本次结果已丢弃。");
    return payload;
  } catch (error) {
    if (hasAttachment) throw error instanceof Error ? error : new Error("奖项/证书文件识别失败。");
    return { provider: "local-v1", assessment: local, visionUsed: false, inputKind: "text" };
  }
}

export async function analyzeJdFileWithProvider(fileDataUrl: string, filename: string): Promise<AiJdResponse> {
  const url = endpointFor("jd");
  if (!url) throw new Error("当前部署未配置文件识别服务，请直接粘贴 JD 文本。");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileDataUrl, filename }) });
  if (!response.ok) throw await readError(response, "JD 文件识别失败");
  const payload = (await response.json()) as AiJdResponse;
  if (!payload?.jdText?.trim()) throw new Error("文件中没有识别到可用的岗位职责或任职要求。");
  if (!payload.visionUsed) throw new Error("服务端没有确认读取到上传文件，本次结果已丢弃。");
  return payload;
}

export async function analyzeJdImageWithProvider(imageDataUrl: string): Promise<AiJdResponse> {
  return analyzeJdFileWithProvider(imageDataUrl, "job-description-image.jpg");
}
