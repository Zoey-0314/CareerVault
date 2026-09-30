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
}

export interface AiJdResponse {
  provider: "openai";
  model?: string;
  jdText: string;
  roleTitle?: string;
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

export function isRemoteAiConfigured(): boolean {
  return Boolean(configuredProxyUrl());
}

export async function analyzeInterviewWithProvider(answer: string, experience: Experience): Promise<AiInterviewResponse> {
  const url = endpointFor("interview");
  if (!url) return { provider: "local-v1", analysis: analyzeInterviewTurn(answer, experience) };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, experience }),
    });
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
  if (!url) return { provider: "local-v1", assessment: local };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const payload = (await response.json()) as AiCredentialResponse;
    if (!payload?.assessment || typeof payload.assessment.score !== "number") throw new Error("Invalid credential analysis payload");
    return payload;
  } catch {
    return { provider: "local-v1", assessment: local };
  }
}

export async function analyzeJdImageWithProvider(imageDataUrl: string): Promise<AiJdResponse> {
  const url = endpointFor("jd");
  if (!url) throw new Error("当前部署未配置图片识别服务，请直接粘贴 JD 文本。");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || `JD 图片识别失败（${response.status}）`);
  }
  const payload = (await response.json()) as AiJdResponse;
  if (!payload?.jdText?.trim()) throw new Error("图片中没有识别到可用的岗位职责或任职要求。");
  return payload;
}
